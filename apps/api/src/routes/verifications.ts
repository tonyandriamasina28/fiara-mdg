import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { db } from '../db.js';
import { HttpError } from '../lib/http.js';
import { deleteDocument, readDocument, storeDocument } from '../lib/identity-vault.js';
import { requireAuth } from '../middleware/auth.js';

/**
 * Vérification d'identité en deux temps :
 *  1. l'utilisateur téléverse son passeport → statut « en_attente » (fichier chiffré, dossier privé) ;
 *  2. un administrateur compare le document au nom déclaré → « valide » (badge Vendeur vérifié) ou « refuse » (motif).
 * Le document est supprimé dès la décision ; seules les métadonnées restent.
 */
export const verificationsRouter = Router();
export const adminVerificationsRouter = Router();

const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
// Mémoire uniquement : le fichier en clair ne touche jamais le disque
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) =>
    ACCEPTED.has(file.mimetype) ? cb(null, true) : cb(new HttpError(400, 'Format accepté : photo (JPEG, PNG, WebP) ou PDF')),
}).single('document');

const PUBLIC_FIELDS = `id, document_type, issuing_country, declared_full_name, document_last4, status,
  rejection_reason, submitted_at, reviewed_at`;

/** GET /verifications/me — statut courant et historique de l'utilisateur. */
verificationsRouter.get('/me', requireAuth, async (req, res) => {
  const [user, history] = await Promise.all([
    db.one<{ identity_verified_at: string | null }>('SELECT identity_verified_at FROM users WHERE id = $1', [req.user!.id]),
    db.query(`SELECT ${PUBLIC_FIELDS} FROM identity_verifications WHERE user_id = $1 ORDER BY submitted_at DESC LIMIT 10`, [req.user!.id]),
  ]);
  res.json({ verified_at: user?.identity_verified_at ?? null, current: history[0] ?? null, history });
});

/** POST /verifications — multipart : `document` (fichier), `declared_full_name`, `document_last4`, `document_type`. */
verificationsRouter.post('/', requireAuth, upload, async (req, res) => {
  const file = req.file;
  if (!file) throw new HttpError(422, 'Ajoutez la photo de votre passeport');
  const input = z.object({
    declared_full_name: z.string().trim().min(3, 'Nom complet obligatoire').max(160).transform((v) => v.toUpperCase()),
    document_last4: z.string().trim().regex(/^[A-Z0-9]{4}$/i, '4 derniers caractères du numéro').transform((v) => v.toUpperCase()).optional(),
    document_type: z.enum(['passeport', 'cin']).default('passeport'),
  }).parse(req.body);

  const already = await db.one<{ identity_verified_at: string | null }>('SELECT identity_verified_at FROM users WHERE id = $1', [req.user!.id]);
  if (already?.identity_verified_at) throw new HttpError(409, 'Votre identité est déjà vérifiée');
  const pending = await db.one(`SELECT 1 FROM identity_verifications WHERE user_id = $1 AND status = 'en_attente'`, [req.user!.id]);
  if (pending) throw new HttpError(409, 'Une vérification est déjà en cours d’examen');

  const stored = await storeDocument(file.buffer);
  try {
    const row = await db.one(
      `INSERT INTO identity_verifications
         (user_id, document_type, declared_full_name, document_last4, storage_key, mime_type, file_size, file_sha256, encryption_iv, encryption_tag)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING ${PUBLIC_FIELDS}`,
      [req.user!.id, input.document_type, input.declared_full_name, input.document_last4 ?? null, stored.storageKey,
       file.mimetype, file.size, stored.sha256, stored.iv, stored.tag],
    );
    res.status(201).json(row);
  } catch (err) {
    await deleteDocument(stored.storageKey);
    throw err;
  }
});

// ---------------------------------------------------------------------------
// Back-office (administrateurs)
// ---------------------------------------------------------------------------
function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') throw new HttpError(403, 'Réservé à l’équipe de modération');
  next();
}
adminVerificationsRouter.use(requireAuth, requireAdmin);

adminVerificationsRouter.get('/', async (req, res) => {
  const status = z.enum(['en_attente', 'valide', 'refuse']).default('en_attente').parse(req.query.status || undefined);
  res.json(
    await db.query(
      `SELECT v.id, v.user_id, v.document_type, v.issuing_country, v.declared_full_name, v.document_last4, v.status,
              v.mime_type, v.file_size, v.submitted_at, v.reviewed_at, v.rejection_reason, (v.storage_key IS NOT NULL) AS has_document,
              u.first_name, u.last_name, u.email, u.role, d.company_name,
              (SELECT count(*)::int FROM identity_verifications o WHERE o.file_sha256 = v.file_sha256 AND o.user_id <> v.user_id) AS same_file_other_accounts
         FROM identity_verifications v JOIN users u ON u.id = v.user_id LEFT JOIN dealer_profiles d ON d.user_id = u.id
        WHERE v.status = $1 ORDER BY v.submitted_at`,
      [status],
    ),
  );
});

/** Document déchiffré à la volée, jamais mis en cache, uniquement pour un administrateur. */
adminVerificationsRouter.get('/:id/document', async (req, res) => {
  const v = await db.one<{ storage_key: string | null; mime_type: string; encryption_iv: string; encryption_tag: string }>(
    'SELECT storage_key, mime_type, encryption_iv, encryption_tag FROM identity_verifications WHERE id = $1', [Number(req.params.id)],
  );
  if (!v?.storage_key) throw new HttpError(404, 'Document indisponible (supprimé après décision)');
  const plain = await readDocument(v.storage_key, v.encryption_iv, v.encryption_tag);
  res.set({
    'content-type': v.mime_type,
    'cache-control': 'no-store, private',
    'content-disposition': 'inline',
    'x-content-type-options': 'nosniff',
  });
  res.send(plain);
});

adminVerificationsRouter.post('/:id/decision', async (req, res) => {
  const input = z.discriminatedUnion('decision', [
    z.object({ decision: z.literal('valide') }),
    z.object({ decision: z.literal('refuse'), reason: z.string().trim().min(5, 'Motif obligatoire').max(500) }),
  ]).parse(req.body);

  const result = await db.transaction(async (tx) => {
    const { rows: [v] } = await tx.query<{ id: number; user_id: number; storage_key: string | null }>(
      `SELECT id, user_id, storage_key FROM identity_verifications WHERE id = $1 AND status = 'en_attente' FOR UPDATE`,
      [Number(req.params.id)],
    );
    if (!v) throw new HttpError(404, 'Aucune vérification en attente avec cet identifiant');
    await tx.query(
      `UPDATE identity_verifications
          SET status = $2, rejection_reason = $3, reviewed_by = $4, reviewed_at = now(),
              document_deleted_at = now(), storage_key = NULL
        WHERE id = $1`,
      [v.id, input.decision, input.decision === 'refuse' ? input.reason : null, req.user!.id],
    );
    if (input.decision === 'valide') await tx.query('UPDATE users SET identity_verified_at = now() WHERE id = $1', [v.user_id]);
    return v;
  });

  // Minimisation : le document n'est plus nécessaire une fois la décision prise
  if (result.storage_key) await deleteDocument(result.storage_key);
  res.json({ id: result.id, status: input.decision });
});
