import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { categories } from '../lib/schemas.js';

/** Référentiels utilisés par les formulaires de recherche et de dépôt d'annonce. */
export const referenceRouter = Router();

referenceRouter.get('/locations', async (_req, res) => {
  const rows = await db.query(
    `SELECT p.id, p.code, p.name, p.common_name,
            json_agg(json_build_object('id', c.id, 'name', c.name, 'common_name', c.common_name, 'is_capital', c.is_capital, 'latitude', c.latitude::float, 'longitude', c.longitude::float)
                     ORDER BY c.is_capital DESC, c.name) AS cities
       FROM provinces p JOIN cities c ON c.province_id = p.id
      GROUP BY p.id ORDER BY p.id`,
  );
  res.json(rows);
});

const categoryFilter = z.string().optional().transform((v) => v?.split(',').filter((c) => (categories as readonly string[]).includes(c)) ?? []);

/**
 * GET /reference/brands?category=moto,velo_electrique — marques ayant au moins un modèle dans ces catégories.
 * Sans modèle référencé pour la catégorie (ex. vélo électrique au lancement), toutes les marques sont proposées.
 */
referenceRouter.get('/brands', async (req, res) => {
  const cats = categoryFilter.parse(req.query.category);
  const select = (where: string, params: unknown[]) => db.query(
    `SELECT b.id, b.name, b.slug, b.is_popular,
            (SELECT count(*)::int FROM ads a JOIN vehicles v ON v.id = a.vehicle_id
              WHERE v.brand_id = b.id AND a.status = 'active') AS ad_count
       FROM brands b ${where} ORDER BY b.is_popular DESC, b.name`,
    params,
  );
  // Une marque sans aucun modèle référencé (catalogue en cours de remplissage) est traitée comme une marque automobile
  let rows = cats.length
    ? await select(
        `WHERE EXISTS (SELECT 1 FROM models m WHERE m.brand_id = b.id AND m.category::text = ANY($1))
            OR ('voiture' = ANY($1) AND NOT EXISTS (SELECT 1 FROM models m WHERE m.brand_id = b.id))`,
        [cats],
      )
    : [];
  if (!rows.length) rows = await select('', []);
  res.json(rows);
});

/** GET /reference/brands/:brandId/models?category=… — modèles de la marque (dépendance Marque > Modèle). */
referenceRouter.get('/brands/:brandId/models', async (req, res) => {
  const cats = categoryFilter.parse(req.query.category);
  const all = await db.query<{ category: string }>(
    'SELECT id, name, slug, category FROM models WHERE brand_id = $1 ORDER BY name',
    [Number(req.params.brandId)],
  );
  const filtered = cats.length ? all.filter((m) => cats.includes(m.category)) : all;
  res.json(filtered.length ? filtered : all);
});

referenceRouter.get('/equipment', async (_req, res) => {
  res.json(await db.query('SELECT id, code, label, grp FROM equipment ORDER BY grp, label'));
});

referenceRouter.get('/sponsorship-plans', async (_req, res) => {
  res.json(
    await db.query(
      'SELECT id, code, label, description, duration_days, price_mga FROM sponsorship_plans WHERE is_active ORDER BY price_mga',
    ),
  );
});
