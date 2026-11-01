import { Router } from 'express';
import { db } from '../db.js';
import { HttpError } from '../lib/http.js';
import { messageSchema } from '../lib/schemas.js';
import { bumpStat } from '../lib/stats.js';
import { requireAuth } from '../middleware/auth.js';

/** Messagerie interne acheteur <-> vendeur. Toutes les routes exigent une connexion. */
export const messagesRouter = Router();
messagesRouter.use(requireAuth);

/** POST /conversations/ads/:adId — premier contact depuis une annonce (ou suite de la conversation existante). */
messagesRouter.post('/ads/:adId', async (req, res) => {
  const { body } = messageSchema.parse(req.body);
  const adId = Number(req.params.adId);
  const me = req.user!.id;

  const result = await db.transaction(async (tx) => {
    const { rows: [ad] } = await tx.query<{ seller_id: number }>(
      `SELECT seller_id FROM ads WHERE id = $1 AND status = 'active'`, [adId],
    );
    if (!ad) throw new HttpError(404, 'Annonce introuvable');
    if (ad.seller_id === me) throw new HttpError(422, 'Vous ne pouvez pas vous écrire à vous-même');

    const { rows: [conv] } = await tx.query<{ id: number; created: boolean }>(
      `INSERT INTO conversations (ad_id, buyer_id, seller_id) VALUES ($1, $2, $3)
       ON CONFLICT (ad_id, buyer_id) DO UPDATE SET last_message_at = now()
       RETURNING id, (xmax = 0) AS created`,
      [adId, me, ad.seller_id],
    );
    const { rows: [message] } = await tx.query(
      'INSERT INTO messages (conversation_id, sender_id, body) VALUES ($1, $2, $3) RETURNING id, body, created_at',
      [conv.id, me, body],
    );

    if (conv.created) {
      await bumpStat(adId, 'messages', 1, tx);
      // Vendeur professionnel : le premier message crée un prospect dans le Lead Manager
      await tx.query(
        `INSERT INTO leads (dealer_id, ad_id, buyer_id, conversation_id, name, phone, email, source)
         SELECT d.user_id, $1, u.id, $3, u.first_name || ' ' || u.last_name, u.phone, u.email, 'message'
           FROM dealer_profiles d, users u WHERE d.user_id = $2 AND u.id = $4
         ON CONFLICT (conversation_id) DO NOTHING`,
        [adId, ad.seller_id, conv.id, me],
      );
    }
    return { conversation_id: conv.id, message };
  });

  res.status(201).json(result);
});

/** GET /conversations/unread — pastille de l'onglet « Discussion ». */
messagesRouter.get('/unread', async (req, res) => {
  const row = await db.one<{ total: number }>(
    `SELECT count(*)::int AS total FROM messages m JOIN conversations cv ON cv.id = m.conversation_id
      WHERE $1 IN (cv.buyer_id, cv.seller_id) AND m.sender_id <> $1 AND m.read_at IS NULL`,
    [req.user!.id],
  );
  res.json({ total: row?.total ?? 0 });
});

/** GET /conversations — boîte de réception (acheteur et vendeur). */
messagesRouter.get('/', async (req, res) => {
  const rows = await db.query(
    `SELECT cv.id, cv.ad_id, cv.last_message_at, a.title AS ad_title, a.price_mga,
            (SELECT url FROM ad_photos ph WHERE ph.ad_id = a.id ORDER BY position LIMIT 1) AS cover_url,
            CASE WHEN cv.buyer_id = $1 THEN 'achat' ELSE 'vente' END AS side,
            COALESCE(d.company_name, other.first_name) AS other_name,
            (SELECT body FROM messages m WHERE m.conversation_id = cv.id ORDER BY created_at DESC LIMIT 1) AS last_message,
            (SELECT count(*)::int FROM messages m
              WHERE m.conversation_id = cv.id AND m.sender_id <> $1 AND m.read_at IS NULL) AS unread
       FROM conversations cv
       JOIN ads a ON a.id = cv.ad_id
       JOIN users other ON other.id = CASE WHEN cv.buyer_id = $1 THEN cv.seller_id ELSE cv.buyer_id END
       LEFT JOIN dealer_profiles d ON d.user_id = other.id
      WHERE $1 IN (cv.buyer_id, cv.seller_id)
      ORDER BY cv.last_message_at DESC`,
    [req.user!.id],
  );
  res.json(rows);
});

async function loadConversation(id: number, userId: number) {
  const conv = await db.one<{ id: number }>(
    `SELECT cv.id, cv.ad_id, a.title AS ad_title, a.price_mga, a.status AS ad_status,
            (SELECT url FROM ad_photos ph WHERE ph.ad_id = a.id ORDER BY position LIMIT 1) AS cover_url,
            CASE WHEN cv.buyer_id = $2 THEN 'achat' ELSE 'vente' END AS side,
            COALESCE(d.company_name, other.first_name) AS other_name
       FROM conversations cv
       JOIN ads a ON a.id = cv.ad_id
       JOIN users other ON other.id = CASE WHEN cv.buyer_id = $2 THEN cv.seller_id ELSE cv.buyer_id END
       LEFT JOIN dealer_profiles d ON d.user_id = other.id
      WHERE cv.id = $1 AND $2 IN (cv.buyer_id, cv.seller_id)`,
    [id, userId],
  );
  if (!conv) throw new HttpError(404, 'Conversation introuvable');
  return conv;
}

/** GET /conversations/:id — fil de messages ; marque comme lus les messages reçus. */
messagesRouter.get('/:id', async (req, res) => {
  const conv = await loadConversation(Number(req.params.id), req.user!.id);
  await db.query(
    'UPDATE messages SET read_at = now() WHERE conversation_id = $1 AND sender_id <> $2 AND read_at IS NULL',
    [conv.id, req.user!.id],
  );
  const messages = await db.query(
    `SELECT id, sender_id, body, read_at, created_at, (sender_id = $2) AS mine
       FROM messages WHERE conversation_id = $1 ORDER BY created_at`,
    [conv.id, req.user!.id],
  );
  res.json({ ...conv, messages });
});

messagesRouter.post('/:id/messages', async (req, res) => {
  const { body } = messageSchema.parse(req.body);
  const conv = await loadConversation(Number(req.params.id), req.user!.id);
  const message = await db.transaction(async (tx) => {
    const { rows: [m] } = await tx.query(
      'INSERT INTO messages (conversation_id, sender_id, body) VALUES ($1, $2, $3) RETURNING id, body, created_at',
      [conv.id, req.user!.id, body],
    );
    await tx.query('UPDATE conversations SET last_message_at = now() WHERE id = $1', [conv.id]);
    return m;
  });
  res.status(201).json(message);
});
