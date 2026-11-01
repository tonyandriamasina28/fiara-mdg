import { Router, type Request } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { db, type Queryable } from '../db.js';
import { HttpError } from '../lib/http.js';
import { adSchema, searchSchema, type AdInput, type SearchInput } from '../lib/schemas.js';
import { adPhotosUpload, MAX_PHOTOS, photoUrl, removeFiles, removePhotoByUrl } from '../lib/uploads.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { getDealerContext } from '../lib/pro.js';
import { bumpStat } from '../lib/stats.js';
import { recordSearch } from './me.js';

export const adsRouter = Router();

const AD_LIFETIME_DAYS = 60;

// Champs stockés dans `vehicles` ; le reste d'AdInput va dans `ads`
const VEHICLE_FIELDS = [
  'brand_id', 'model_id', 'version', 'category', 'body', 'year', 'mileage_km', 'fuel', 'gearbox', 'drive',
  'power_hp', 'engine_cc', 'doors', 'seats', 'exterior_color', 'condition', 'origin', 'customs', 'previous_owners', 'vin',
] as const;
const MINOR_FIELDS = new Set(['price_mga', 'price_negotiable', 'show_phone', 'contact_phone', 'whatsapp']);
const AD_FIELDS = ['title', 'description', 'price_mga', 'price_negotiable', 'city_id', 'show_phone', 'contact_phone', 'whatsapp'] as const;

const LIST_COLUMNS = `
  a.id, a.title, a.price_mga, a.price_negotiable, a.published_at,
  COALESCE(a.sponsored_until > now(), FALSE) AS is_sponsored,
  v.year, v.mileage_km, v.fuel, v.gearbox, v.power_hp, v.category, v.origin, v.customs, v.condition,
  b.name AS brand, m.name AS model, v.version,
  c.name AS city, p.name AS province,
  u.role AS seller_type, d.company_name, (u.identity_verified_at IS NOT NULL) AS seller_verified,
  (SELECT url FROM ad_photos ph WHERE ph.ad_id = a.id ORDER BY position LIMIT 1) AS cover_url,
  (SELECT count(*)::int FROM ad_photos ph WHERE ph.ad_id = a.id) AS photo_count`;

const LIST_FROM = `
  FROM ads a
  JOIN vehicles v  ON v.id = a.vehicle_id
  JOIN brands b    ON b.id = v.brand_id
  JOIN models m    ON m.id = v.model_id
  JOIN cities c    ON c.id = a.city_id
  JOIN provinces p ON p.id = c.province_id
  JOIN users u     ON u.id = a.seller_id
  LEFT JOIN dealer_profiles d ON d.user_id = u.id
  LEFT JOIN LATERAL (
    SELECT sp.visibility_level FROM dealer_subscriptions ds JOIN subscription_plans sp ON sp.id = ds.plan_id
     WHERE ds.dealer_id = a.seller_id AND ds.status = 'active' AND ds.ends_at > now() LIMIT 1
  ) sub ON TRUE`;

const SORTS: Record<SearchInput['sort'], string> = {
  // Pertinence : sponsorisées d'abord, puis niveau de visibilité de la formule pro, puis les plus récentes
  pertinence: '(a.sponsored_until > now()) DESC NULLS LAST, COALESCE(sub.visibility_level, 0) DESC, a.published_at DESC',
  prix_asc: 'a.price_mga ASC',
  prix_desc: 'a.price_mga DESC',
  recent: 'a.published_at DESC',
  km_asc: 'v.mileage_km ASC',
  annee_desc: 'v.year DESC',
};

function buildSearch(f: SearchInput) {
  const where = [`a.status = 'active'`];
  const params: unknown[] = [];
  const add = (clause: string, value: unknown) => {
    params.push(value);
    where.push(clause.replace('?', `$${params.length}`));
  };

  if (f.q) add(`a.search_vector @@ plainto_tsquery('simple', ?)`, f.q);
  if (f.brand_id) add('v.brand_id = ?', f.brand_id);
  if (f.model_id) add('v.model_id = ?', f.model_id);
  if (f.category?.length) add('v.category::text = ANY(?)', f.category);
  if (f.price_min) add('a.price_mga >= ?', f.price_min);
  if (f.price_max) add('a.price_mga <= ?', f.price_max);
  if (f.year_min) add('v.year >= ?', f.year_min);
  if (f.year_max) add('v.year <= ?', f.year_max);
  if (f.km_max !== undefined) add('v.mileage_km <= ?', f.km_max);
  if (f.fuel?.length) add('v.fuel::text = ANY(?)', f.fuel);
  if (f.gearbox?.length) add('v.gearbox::text = ANY(?)', f.gearbox);
  if (f.origin?.length) add('v.origin::text = ANY(?)', f.origin);
  if (f.customs?.length) add('v.customs::text = ANY(?)', f.customs);
  if (f.province_id) add('c.province_id = ?', f.province_id);
  if (f.city_id) add('a.city_id = ?', f.city_id);
  if (f.seller_type) add('u.role = ?', f.seller_type);

  return { where: where.join(' AND '), params };
}

/** GET /ads — recherche détaillée paginée. */
adsRouter.get('/', optionalAuth, async (req, res) => {
  const filters = searchSchema.parse(req.query);
  const { where, params } = buildSearch(filters);
  const offset = (filters.page - 1) * filters.per_page;

  const [items, total] = await Promise.all([
    db.query(
      `SELECT ${LIST_COLUMNS} ${LIST_FROM} WHERE ${where}
       ORDER BY ${SORTS[filters.sort]}, a.id DESC
       LIMIT ${filters.per_page} OFFSET ${offset}`,
      params,
    ),
    db.one<{ n: number }>(`SELECT count(*)::int AS n ${LIST_FROM} WHERE ${where}`, params),
  ]);

  if (req.user && filters.page === 1) await recordSearch(req.user.id, req.query as Record<string, unknown>, total?.n ?? 0);
  res.json({ items, total: total?.n ?? 0, page: filters.page, per_page: filters.per_page });
});

/** GET /ads/count — compteur en direct du bouton « X annonces » du moteur de recherche. */
adsRouter.get('/count', async (req, res) => {
  const { where, params } = buildSearch(searchSchema.parse(req.query));
  const row = await db.one<{ n: number }>(`SELECT count(*)::int AS n ${LIST_FROM} WHERE ${where}`, params);
  res.json({ total: row?.n ?? 0 });
});

/** Compte vendeur effectif : le professionnel pour un membre de son équipe, sinon l'utilisateur lui-même. */
async function sellerIdFor(req: Request) {
  const ctx = await getDealerContext(req.user!.id);
  return ctx?.dealerId ?? req.user!.id;
}

/** GET /ads/mine — tableau de bord vendeur. */
adsRouter.get('/mine', requireAuth, async (req, res) => {
  const rows = await db.query(
    `SELECT ${LIST_COLUMNS}, a.status, a.views_count, a.expires_at, a.sponsored_until,
            (SELECT count(*)::int FROM conversations cv WHERE cv.ad_id = a.id) AS conversation_count,
            (SELECT count(*)::int FROM favorites f WHERE f.ad_id = a.id) AS favorite_count
       ${LIST_FROM}
      WHERE a.seller_id = $1 AND a.status <> 'supprimee'
      ORDER BY a.created_at DESC`,
    [await sellerIdFor(req)],
  );
  res.json(rows);
});

/** GET /ads/favorites — annonces mises en favori par l'utilisateur. */
adsRouter.get('/favorites', requireAuth, async (req, res) => {
  res.json(
    await db.query(
      `SELECT ${LIST_COLUMNS}, a.status ${LIST_FROM} JOIN favorites f ON f.ad_id = a.id
        WHERE f.user_id = $1 AND a.status <> 'supprimee' ORDER BY f.created_at DESC`,
      [req.user!.id],
    ),
  );
});

adsRouter.post('/:id/favorite', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const ad = await db.one(`SELECT id FROM ads WHERE id = $1 AND status = 'active'`, [id]);
  if (!ad) throw new HttpError(404, 'Annonce introuvable');
  const inserted = await db.one('INSERT INTO favorites (user_id, ad_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING ad_id', [req.user!.id, id]);
  if (inserted) await bumpStat(id, 'favorites');
  res.status(201).json({ favorite: true });
});

adsRouter.delete('/:id/favorite', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const removed = await db.one('DELETE FROM favorites WHERE user_id = $1 AND ad_id = $2 RETURNING ad_id', [req.user!.id, id]);
  if (removed) await bumpStat(id, 'favorites', -1);
  res.json({ favorite: false });
});

/** GET /ads/:id — fiche détaillée. */
adsRouter.get('/:id', optionalAuth, async (req, res) => {
  const id = Number(req.params.id);
  const ad = await db.one<Record<string, unknown> & { seller_id: number; status: string }>(
    `SELECT ${LIST_COLUMNS}, a.description, a.status, a.seller_id, a.show_phone, a.whatsapp, a.views_count,
            v.body, v.drive, v.engine_cc, v.doors, v.seats, v.exterior_color, v.previous_owners, v.first_registration,
            u.first_name AS seller_first_name, u.created_at AS seller_since, d.is_verified AS dealer_verified,
            c.common_name AS city_common_name,
            -- Pro : position du site (ou du site principal) ; particulier : centre de la ville uniquement
            COALESCE(site.latitude, c.latitude)::float AS latitude,
            COALESCE(site.longitude, c.longitude)::float AS longitude,
            (site.latitude IS NOT NULL) AS precise_location, site.name AS site_name, site.address AS site_address,
            COALESCE((SELECT json_agg(json_build_object('id', ph.id, 'url', ph.url) ORDER BY ph.position)
                        FROM ad_photos ph WHERE ph.ad_id = a.id), '[]') AS photos,
            COALESCE((SELECT json_agg(e.label ORDER BY e.grp, e.label)
                        FROM vehicle_equipment ve JOIN equipment e ON e.id = ve.equipment_id
                       WHERE ve.vehicle_id = v.id), '[]') AS equipment,
            EXISTS (SELECT 1 FROM favorites f WHERE f.ad_id = a.id AND f.user_id = $2) AS is_favorite
       ${LIST_FROM}
       LEFT JOIN LATERAL (
         SELECT s.name, s.address, s.latitude, s.longitude FROM dealer_sites s
          WHERE s.dealer_id = a.seller_id AND s.latitude IS NOT NULL AND (s.id = a.site_id OR a.site_id IS NULL)
          ORDER BY (s.id = a.site_id) DESC, s.is_main DESC LIMIT 1
       ) site ON TRUE
       WHERE a.id = $1`,
    [id, req.user?.id ?? null],
  );
  const isOwner = ad && req.user && (req.user.id === ad.seller_id || (await sellerIdFor(req)) === ad.seller_id);
  if (!ad || (ad.status !== 'active' && !isOwner)) throw new HttpError(404, 'Annonce introuvable');

  if (!isOwner) {
    await db.query('UPDATE ads SET views_count = views_count + 1 WHERE id = $1', [id]);
    await bumpStat(id, 'views');
  }
  res.json({ ...ad, is_owner: Boolean(isOwner) });
});

/** POST /ads/:id/phone — affiche le numéro du vendeur (et trace l'affichage). */
adsRouter.post('/:id/phone', optionalAuth, async (req, res) => {
  const id = Number(req.params.id);
  const row = await db.one<{ phone: string | null; show_phone: boolean }>(
    `SELECT COALESCE(a.contact_phone, u.phone) AS phone, a.show_phone
       FROM ads a JOIN users u ON u.id = a.seller_id WHERE a.id = $1 AND a.status = 'active'`,
    [id],
  );
  if (!row) throw new HttpError(404, 'Annonce introuvable');
  if (!row.show_phone || !row.phone) throw new HttpError(403, 'Ce vendeur préfère être contacté par message');

  const ipHash = crypto.createHash('sha256').update(req.ip ?? '').digest('hex');
  await db.query('INSERT INTO phone_reveals (ad_id, user_id, ip_hash) VALUES ($1, $2, $3)', [id, req.user?.id ?? null, ipHash]);
  await bumpStat(id, 'phone_reveals');
  res.json({ phone: row.phone });
});

function pick<K extends keyof AdInput>(input: Partial<AdInput>, keys: readonly K[]) {
  return keys.filter((k) => input[k] !== undefined).map((k) => [k, input[k]] as const);
}

async function assertModelBelongsToBrand(tx: Queryable, brandId: number, modelId: number) {
  const { rows } = await tx.query('SELECT 1 FROM models WHERE id = $1 AND brand_id = $2', [modelId, brandId]);
  if (!rows.length) throw new HttpError(422, 'Ce modèle ne correspond pas à la marque choisie');
}

async function insertPhotos(tx: Queryable, adId: number, files: Express.Multer.File[], startAt = 0) {
  for (const [i, file] of files.entries()) {
    await tx.query('INSERT INTO ad_photos (ad_id, url, position) VALUES ($1, $2, $3)', [adId, photoUrl(file.filename), startAt + i]);
  }
}

/** Professionnels : abonnement actif obligatoire, nombre de véhicules plafonné par la formule. */
async function assertDealerCapacity(req: Request) {
  const ctx = await getDealerContext(req.user!.id);
  if (!ctx) {
    if (req.user!.role === 'professionnel') throw new HttpError(403, 'Profil professionnel incomplet');
    return req.user!.id;
  }
  if (!ctx.subscription) {
    throw new HttpError(402, 'Choisissez une formule professionnelle pour publier vos véhicules', { upgrade: true });
  }
  const { n } = (await db.one<{ n: number }>(
    `SELECT count(*)::int AS n FROM ads WHERE seller_id = $1 AND status IN ('en_attente', 'active', 'suspendue')`, [ctx.dealerId],
  ))!;
  if (n >= ctx.subscription.max_active_ads) {
    throw new HttpError(403, `Votre formule ${ctx.subscription.plan_name} est limitée à ${ctx.subscription.max_active_ads} véhicules en ligne`, { upgrade: true });
  }
  return ctx.dealerId;
}

/**
 * POST /ads — création d'une annonce (multipart/form-data), pour toutes les catégories de véhicules.
 * Champs : voir adSchema ; fichiers : `photos` (jusqu'à 20).
 * L'annonce est créée « en_attente » (modération) ou « brouillon » si ?draft=1.
 */
adsRouter.post('/', requireAuth, adPhotosUpload, async (req: Request, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  try {
    const input = adSchema.parse(req.body);
    const status = req.query.draft === '1' ? 'brouillon' : 'en_attente';
    const sellerId = await assertDealerCapacity(req);

    const ad = await db.transaction(async (tx) => {
      await assertModelBelongsToBrand(tx, input.brand_id, input.model_id);

      const vehicleCols = pick(input, VEHICLE_FIELDS);
      const { rows: [vehicle] } = await tx.query<{ id: number }>(
        `INSERT INTO vehicles (owner_id, ${vehicleCols.map(([k]) => k).join(', ')})
         VALUES ($1, ${vehicleCols.map((_, i) => `$${i + 2}`).join(', ')}) RETURNING id`,
        [sellerId, ...vehicleCols.map(([, v]) => v)],
      );

      for (const equipmentId of input.equipment) {
        await tx.query('INSERT INTO vehicle_equipment (vehicle_id, equipment_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [vehicle.id, equipmentId]);
      }

      const adCols = pick(input, AD_FIELDS);
      const { rows: [created] } = await tx.query<{ id: number; status: string }>(
        `INSERT INTO ads (vehicle_id, seller_id, status, ${adCols.map(([k]) => k).join(', ')})
         VALUES ($1, $2, $3, ${adCols.map((_, i) => `$${i + 4}`).join(', ')}) RETURNING id, status`,
        [vehicle.id, sellerId, status, ...adCols.map(([, v]) => v)],
      );

      await insertPhotos(tx, created.id, files);
      return created;
    });

    res.status(201).json({ ...ad, photo_count: files.length });
  } catch (err) {
    removeFiles(files);
    throw err;
  }
});

async function loadOwnedAd(adId: number, req: Request) {
  const ad = await db.one<{ id: number; vehicle_id: number; status: string }>(
    `SELECT id, vehicle_id, status FROM ads WHERE id = $1 AND seller_id = $2 AND status <> 'supprimee'`,
    [adId, await sellerIdFor(req)],
  );
  if (!ad) throw new HttpError(404, 'Annonce introuvable');
  return ad;
}

/** PATCH /ads/:id — modification (JSON). Changer le contenu d'une annonce active la renvoie en modération ; pas le prix. */
adsRouter.patch('/:id', requireAuth, async (req, res) => {
  const ad = await loadOwnedAd(Number(req.params.id), req);
  // Ne garder que les champs envoyés : les valeurs par défaut du schéma ne doivent rien écraser
  const parsed = adSchema.partial().parse(req.body);
  const input = Object.fromEntries(Object.entries(parsed).filter(([k]) => k in req.body)) as Partial<AdInput>;

  await db.transaction(async (tx) => {
    if (input.brand_id || input.model_id) {
      const { rows: [current] } = await tx.query<{ brand_id: number; model_id: number }>(
        'SELECT brand_id, model_id FROM vehicles WHERE id = $1', [ad.vehicle_id],
      );
      await assertModelBelongsToBrand(tx, input.brand_id ?? current.brand_id, input.model_id ?? current.model_id);
    }

    const vehicleCols = pick(input, VEHICLE_FIELDS);
    if (vehicleCols.length) {
      await tx.query(
        `UPDATE vehicles SET ${vehicleCols.map(([k], i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`,
        [ad.vehicle_id, ...vehicleCols.map(([, v]) => v)],
      );
    }
    if (input.equipment) {
      await tx.query('DELETE FROM vehicle_equipment WHERE vehicle_id = $1', [ad.vehicle_id]);
      for (const equipmentId of input.equipment) {
        await tx.query('INSERT INTO vehicle_equipment (vehicle_id, equipment_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [ad.vehicle_id, equipmentId]);
      }
    }

    const adCols = pick(input, AD_FIELDS);
    // Prix et coordonnées : l'annonce reste en ligne. Contenu (titre, texte, véhicule) : retour en modération.
    const contentChanged = Object.keys(input).some((k) => !MINOR_FIELDS.has(k));
    const nextStatus = ad.status === 'active' && contentChanged ? 'en_attente' : ad.status;
    await tx.query(
      `UPDATE ads SET status = $2 ${adCols.map(([k], i) => `, ${k} = $${i + 3}`).join('')} WHERE id = $1`,
      [ad.id, nextStatus, ...adCols.map(([, v]) => v)],
    );
  });

  res.json({ id: ad.id, updated: true });
});

/** PATCH /ads/:id/status — le vendeur suspend, réactive ou marque vendue. */
adsRouter.patch('/:id/status', requireAuth, async (req, res) => {
  const ad = await loadOwnedAd(Number(req.params.id), req);
  const allowed: Record<string, string[]> = {
    active: ['suspendue', 'vendue'],
    suspendue: ['active', 'vendue'],
    brouillon: ['en_attente'],
    expiree: ['en_attente'],
  };
  const next = String(req.body?.status ?? '');
  if (!allowed[ad.status]?.includes(next)) {
    throw new HttpError(422, `Passage de « ${ad.status} » à « ${next} » impossible`);
  }
  await db.query('UPDATE ads SET status = $2 WHERE id = $1', [ad.id, next]);
  res.json({ id: ad.id, status: next });
});

/** DELETE /ads/:id — suppression logique (conserve l'historique des messages et paiements). */
adsRouter.delete('/:id', requireAuth, async (req, res) => {
  const ad = await loadOwnedAd(Number(req.params.id), req);
  await db.query(`UPDATE ads SET status = 'supprimee', sponsored_until = NULL WHERE id = $1`, [ad.id]);
  res.status(204).end();
});

/** POST /ads/:id/photos — ajout de photos à une annonce existante. */
adsRouter.post('/:id/photos', requireAuth, adPhotosUpload, async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  try {
    const ad = await loadOwnedAd(Number(req.params.id), req);
    const photos = await db.transaction(async (tx) => {
      const { rows: [stats] } = await tx.query<{ n: number; next: number }>(
        'SELECT count(*)::int AS n, COALESCE(max(position) + 1, 0)::int AS next FROM ad_photos WHERE ad_id = $1', [ad.id],
      );
      if (stats.n + files.length > MAX_PHOTOS) throw new HttpError(400, `${MAX_PHOTOS} photos maximum par annonce`);
      await insertPhotos(tx, ad.id, files, stats.next);
      return (await tx.query('SELECT id, url, position FROM ad_photos WHERE ad_id = $1 ORDER BY position', [ad.id])).rows;
    });
    res.status(201).json(photos);
  } catch (err) {
    removeFiles(files);
    throw err;
  }
});

adsRouter.delete('/:id/photos/:photoId', requireAuth, async (req, res) => {
  const ad = await loadOwnedAd(Number(req.params.id), req);
  const photo = await db.one<{ url: string }>(
    'DELETE FROM ad_photos WHERE id = $1 AND ad_id = $2 RETURNING url', [Number(req.params.photoId), ad.id],
  );
  if (!photo) throw new HttpError(404, 'Photo introuvable');
  removePhotoByUrl(photo.url);
  res.status(204).end();
});

/** GET /ads/:id/edit — valeurs brutes pour le formulaire de modification (propriétaire ou équipe pro). */
adsRouter.get('/:id/edit', requireAuth, async (req, res) => {
  const owned = await loadOwnedAd(Number(req.params.id), req);
  const ad = await db.one(
    `SELECT a.id, a.status, a.title, a.description, a.price_mga, a.price_negotiable, a.city_id, a.show_phone,
            a.contact_phone, a.whatsapp, v.brand_id, v.model_id, b.name AS brand, m.name AS model, v.version,
            v.category, v.year, v.mileage_km, v.fuel, v.gearbox, v.drive, v.power_hp, v.engine_cc, v.doors, v.seats,
            v.exterior_color, v.condition, v.origin, v.customs, v.previous_owners,
            COALESCE((SELECT json_agg(e.equipment_id) FROM vehicle_equipment e WHERE e.vehicle_id = v.id), '[]') AS equipment,
            COALESCE((SELECT json_agg(json_build_object('id', p.id, 'url', p.url, 'position', p.position) ORDER BY p.position)
                        FROM ad_photos p WHERE p.ad_id = a.id), '[]') AS photos
       FROM ads a JOIN vehicles v ON v.id = a.vehicle_id JOIN brands b ON b.id = v.brand_id JOIN models m ON m.id = v.model_id
      WHERE a.id = $1`,
    [owned.id],
  );
  res.json(ad);
});

/**
 * PATCH /ads/:id/photos/order — nouvel ordre des photos (la première devient la couverture).
 * Contrainte UNIQUE (ad_id, position) : passage par des positions négatives temporaires.
 */
adsRouter.patch('/:id/photos/order', requireAuth, async (req, res) => {
  const ad = await loadOwnedAd(Number(req.params.id), req);
  const { ids } = z.object({ ids: z.array(z.coerce.number().int().positive()).min(1).max(MAX_PHOTOS) }).parse(req.body);
  const photos = await db.transaction(async (tx) => {
    const { rows: current } = await tx.query<{ id: number }>('SELECT id FROM ad_photos WHERE ad_id = $1', [ad.id]);
    const known = new Set(current.map((p) => p.id));
    if (ids.length !== known.size || !ids.every((id) => known.has(id))) {
      throw new HttpError(422, 'La liste doit contenir toutes les photos de l’annonce, une seule fois');
    }
    await tx.query('UPDATE ad_photos SET position = -position - 1 WHERE ad_id = $1', [ad.id]);
    for (const [i, id] of ids.entries()) await tx.query('UPDATE ad_photos SET position = $2 WHERE id = $1', [id, i]);
    return (await tx.query('SELECT id, url, position FROM ad_photos WHERE ad_id = $1 ORDER BY position', [ad.id])).rows;
  });
  res.json(photos);
});

/** POST /ads/:id/approve — modération (admin) : publication pour AD_LIFETIME_DAYS jours. */
adsRouter.post('/:id/approve', requireAuth, async (req, res) => {
  if (req.user!.role !== 'admin') throw new HttpError(403, 'Réservé aux modérateurs');
  const ad = await db.one(
    `UPDATE ads SET status = 'active', published_at = COALESCE(published_at, now()),
            expires_at = now() + make_interval(days => $2)
      WHERE id = $1 AND status = 'en_attente' RETURNING id, status, expires_at`,
    [Number(req.params.id), AD_LIFETIME_DAYS],
  );
  if (!ad) throw new HttpError(404, 'Aucune annonce en attente avec cet identifiant');
  res.json(ad);
});
