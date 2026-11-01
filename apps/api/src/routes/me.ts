import { Router } from 'express';
import { z } from 'zod';
import { db, type Queryable } from '../db.js';
import { HttpError } from '../lib/http.js';
import { searchSchema } from '../lib/schemas.js';
import { requireAuth } from '../middleware/auth.js';

/** Données personnelles centralisées dans le profil : recherches récentes, synthèse du compte. */
export const meRouter = Router();
meRouter.use(requireAuth);

const HISTORY_SIZE = 20;
// Critères qui définissent une recherche (pagination et tri exclus)
const CRITERIA_KEYS = Object.keys(searchSchema.shape).filter((k) => !['page', 'per_page', 'sort'].includes(k));

/** Critères normalisés (clés triées, valeurs non vides) : deux recherches identiques donnent la même chaîne. */
export function normalizeCriteria(query: Record<string, unknown>) {
  const entries = CRITERIA_KEYS
    .map((k) => [k, query[k]] as const)
    .filter(([, v]) => typeof v === 'string' && v.trim() !== '')
    .map(([k, v]) => [k, String(v).split(',').filter(Boolean).sort().join(',')] as [string, string])
    .sort(([a], [b]) => a.localeCompare(b));
  return { queryString: new URLSearchParams(entries).toString(), criteria: Object.fromEntries(entries) };
}

/** Appelé par GET /ads quand un utilisateur connecté lance une recherche (page 1, au moins un critère). */
export async function recordSearch(userId: number, query: Record<string, unknown>, resultCount: number, tx?: Queryable) {
  const { queryString, criteria } = normalizeCriteria(query);
  if (!queryString) return;
  const q = tx ?? { query: async (s: string, p?: unknown[]) => ({ rows: await db.query(s, p) }) };
  await q.query(
    `INSERT INTO search_history (user_id, query_string, criteria, result_count) VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, query_string) DO UPDATE
       SET last_run_at = now(), run_count = search_history.run_count + 1, result_count = EXCLUDED.result_count`,
    [userId, queryString, JSON.stringify(criteria), resultCount],
  );
  await q.query(
    `DELETE FROM search_history WHERE user_id = $1 AND id NOT IN (
       SELECT id FROM search_history WHERE user_id = $1 ORDER BY last_run_at DESC LIMIT ${HISTORY_SIZE})`,
    [userId],
  );
}

/**
 * GET /me/searches — recherches récentes, enrichies des libellés (marque, modèle, lieu)
 * et du nombre d'annonces publiées depuis la dernière exécution.
 */
meRouter.get('/searches', async (req, res) => {
  const rows = await db.query<{ id: number; query_string: string; criteria: Record<string, string>; result_count: number; run_count: number; last_run_at: string; alert: boolean }>(
    `SELECT h.id, h.query_string, h.criteria, h.result_count, h.run_count, h.last_run_at,
            EXISTS (SELECT 1 FROM saved_searches s WHERE s.user_id = h.user_id AND s.query_string = h.query_string) AS alert
       FROM search_history h WHERE h.user_id = $1 ORDER BY h.last_run_at DESC`,
    [req.user!.id],
  );
  const ids = (key: string) => [...new Set(rows.map((r) => Number(r.criteria[key])).filter(Boolean))];
  const [brands, models, provinces, cities] = await Promise.all([
    db.query<{ id: number; name: string }>('SELECT id, name FROM brands WHERE id = ANY($1)', [ids('brand_id')]),
    db.query<{ id: number; name: string }>('SELECT id, name FROM models WHERE id = ANY($1)', [ids('model_id')]),
    db.query<{ id: number; name: string }>('SELECT id, name FROM provinces WHERE id = ANY($1)', [ids('province_id')]),
    db.query<{ id: number; name: string }>('SELECT id, name FROM cities WHERE id = ANY($1)', [ids('city_id')]),
  ]);
  const name = (list: { id: number; name: string }[], id?: string) => list.find((x) => x.id === Number(id))?.name;

  res.json(rows.map((r) => ({
    ...r,
    labels: {
      brand: name(brands, r.criteria.brand_id),
      model: name(models, r.criteria.model_id),
      province: name(provinces, r.criteria.province_id),
      city: name(cities, r.criteria.city_id),
    },
  })));
});

meRouter.delete('/searches/:id', async (req, res) => {
  await db.query('DELETE FROM search_history WHERE id = $1 AND user_id = $2', [Number(req.params.id), req.user!.id]);
  res.status(204).end();
});

meRouter.delete('/searches', async (req, res) => {
  await db.query('DELETE FROM search_history WHERE user_id = $1', [req.user!.id]);
  res.status(204).end();
});

/** Active / désactive l'alerte « nouvelles annonces » d'une recherche récente. */
meRouter.put('/searches/:id/alert', async (req, res) => {
  const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
  const h = await db.one<{ query_string: string; criteria: object }>(
    'SELECT query_string, criteria FROM search_history WHERE id = $1 AND user_id = $2', [Number(req.params.id), req.user!.id],
  );
  if (!h) throw new HttpError(404, 'Recherche introuvable');
  if (enabled) {
    await db.query(
      `INSERT INTO saved_searches (user_id, criteria, query_string) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, query_string) WHERE query_string IS NOT NULL DO NOTHING`,
      [req.user!.id, JSON.stringify(h.criteria), h.query_string],
    );
  } else {
    await db.query('DELETE FROM saved_searches WHERE user_id = $1 AND query_string = $2', [req.user!.id, h.query_string]);
  }
  res.json({ alert: enabled });
});

/** GET /me/overview — compteurs du profil. */
meRouter.get('/overview', async (req, res) => {
  res.json(
    await db.one(
      `SELECT
         (SELECT count(*)::int FROM favorites WHERE user_id = $1) AS favorites,
         (SELECT count(*)::int FROM search_history WHERE user_id = $1) AS searches,
         (SELECT count(*)::int FROM conversations WHERE $1 IN (buyer_id, seller_id)) AS conversations,
         (SELECT count(*)::int FROM messages m JOIN conversations c ON c.id = m.conversation_id
           WHERE $1 IN (c.buyer_id, c.seller_id) AND m.sender_id <> $1 AND m.read_at IS NULL) AS unread,
         (SELECT count(*)::int FROM ads WHERE seller_id = $1 AND status <> 'supprimee') AS ads`,
      [req.user!.id],
    ),
  );
});
