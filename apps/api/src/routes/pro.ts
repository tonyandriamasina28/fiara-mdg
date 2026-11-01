import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { HttpError } from '../lib/http.js';
import { hasFullAccess, requireDealer, requireTool } from '../lib/pro.js';
import { evaluateQuality, type QualityInput } from '../lib/quality.js';
import { mgPhone, paymentStartSchema, planCodeSchema } from '../lib/schemas.js';
import { requireAuth } from '../middleware/auth.js';
import { createPayment, startCheckout } from '../lib/payment-gateways.js';

/** Espace professionnel : formules, équipe, sites et les 5 outils pro. */
export const proRouter = Router();

// ---------------------------------------------------------------------------
// Formules (public)
// ---------------------------------------------------------------------------
proRouter.get('/plans', async (_req, res) => {
  const plans = await db.query(
    `SELECT p.code, p.tier, p.name, p.tagline, p.price_mga, p.quote_only, p.max_active_ads, p.max_sales_contacts,
            p.visibility_level, p.multi_site, p.exclusive_recommendations,
            COALESCE(json_object_agg(a.tool, json_build_object('access', a.access, 'monthly_quota', a.monthly_quota))
                     FILTER (WHERE a.tool IS NOT NULL), '{}') AS tools
       FROM subscription_plans p LEFT JOIN plan_tool_access a ON a.plan_id = p.id
      WHERE p.is_active GROUP BY p.id ORDER BY p.tier`,
  );
  res.json(plans);
});

proRouter.use(requireAuth, requireDealer);

// ---------------------------------------------------------------------------
// Contexte, abonnement, équipe, sites
// ---------------------------------------------------------------------------
proRouter.get('/me', async (req, res) => {
  const ctx = req.dealer!;
  const usage = await db.one<{ active_ads: number; team: number; sites: number; offers_this_month: number; new_leads: number }>(
    `SELECT
       (SELECT count(*)::int FROM ads WHERE seller_id = $1 AND status IN ('en_attente', 'active', 'suspendue')) AS active_ads,
       (SELECT count(*)::int FROM dealer_members WHERE dealer_id = $1 AND role <> 'proprietaire') AS team,
       (SELECT count(*)::int FROM dealer_sites WHERE dealer_id = $1) AS sites,
       (SELECT count(*)::int FROM direct_offers WHERE dealer_id = $1 AND created_at >= date_trunc('month', now())) AS offers_this_month,
       (SELECT count(*)::int FROM leads WHERE dealer_id = $1 AND status = 'nouveau') AS new_leads`,
    [ctx.dealerId],
  );
  const company = await db.one('SELECT company_name, is_verified FROM dealer_profiles WHERE user_id = $1', [ctx.dealerId]);
  const pending = await db.one(
    `SELECT s.id, p.code AS plan_code, s.payment_id FROM dealer_subscriptions s JOIN subscription_plans p ON p.id = s.plan_id
      WHERE s.dealer_id = $1 AND s.status = 'en_attente_paiement' ORDER BY s.created_at DESC LIMIT 1`,
    [ctx.dealerId],
  );
  res.json({ ...ctx, company, usage, pending_subscription: pending ?? null });
});

/** Souscription ou changement de formule : crée le paiement Mobile Money à valider. */
proRouter.post('/subscribe', async (req, res) => {
  if (req.dealer!.role !== 'proprietaire') throw new HttpError(403, 'Seul le titulaire du compte peut changer de formule');
  const start = paymentStartSchema.parse(req.body);
  const input = planCodeSchema.parse(req.body);

  const result = await db.transaction(async (tx) => {
    const { rows: [plan] } = await tx.query<{ id: number; price_mga: number | null; quote_only: boolean; name: string }>(
      'SELECT id, price_mga, quote_only, name FROM subscription_plans WHERE code = $1 AND is_active', [input.plan_code],
    );
    if (!plan) throw new HttpError(422, 'Formule inconnue');
    if (plan.quote_only || !plan.price_mga) throw new HttpError(422, 'Cette formule est proposée sur devis');

    const payment = await createPayment(tx, {
      userId: req.user!.id, purpose: 'abonnement', start, amount: plan.price_mga, metadata: { plan_code: input.plan_code },
    });
    // Une seule demande en attente à la fois
    await tx.query(`UPDATE dealer_subscriptions SET status = 'annulee' WHERE dealer_id = $1 AND status = 'en_attente_paiement'`, [req.dealer!.dealerId]);
    const { rows: [subscription] } = await tx.query(
      'INSERT INTO dealer_subscriptions (dealer_id, plan_id, payment_id) VALUES ($1, $2, $3) RETURNING id, status',
      [req.dealer!.dealerId, plan.id, payment.id],
    );
    return { payment, subscription, amount_mga: plan.price_mga, plan: plan.name };
  });
  const checkout = await startCheckout(result.payment, `Formule ${result.plan} (1 mois)`);
  res.status(201).json({ ...result, payment: { ...result.payment, ...checkout } });
});

proRouter.get('/team', async (req, res) => {
  res.json(
    await db.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, m.role, m.site_id
         FROM dealer_members m JOIN users u ON u.id = m.user_id WHERE m.dealer_id = $1 ORDER BY m.role, u.first_name`,
      [req.dealer!.dealerId],
    ),
  );
});

/** Ajoute un interlocuteur commercial (compte fiara.mdg existant), dans la limite de la formule. */
proRouter.post('/team', async (req, res) => {
  const ctx = req.dealer!;
  if (ctx.role === 'commercial') throw new HttpError(403, 'Droits insuffisants');
  const input = z.object({ email: z.email(), role: z.enum(['gestionnaire', 'commercial']).default('commercial') }).parse(req.body);
  const max = ctx.subscription?.max_sales_contacts ?? 0;
  const { n } = (await db.one<{ n: number }>(
    `SELECT count(*)::int AS n FROM dealer_members WHERE dealer_id = $1 AND role <> 'proprietaire'`, [ctx.dealerId],
  ))!;
  if (n >= max) {
    throw new HttpError(403, max === 0
      ? 'Votre formule n’inclut pas d’interlocuteur commercial'
      : `Votre formule est limitée à ${max} interlocuteur(s) commercial(aux)`, { upgrade: true });
  }
  const member = await db.one<{ id: number }>('SELECT id FROM users WHERE lower(email) = lower($1)', [input.email]);
  if (!member) throw new HttpError(404, 'Aucun compte fiara.mdg avec cet e-mail : la personne doit d’abord créer son compte');
  await db.query('INSERT INTO dealer_members (dealer_id, user_id, role) VALUES ($1, $2, $3)', [ctx.dealerId, member.id, input.role]);
  res.status(201).json({ user_id: member.id, role: input.role });
});

proRouter.get('/sites', async (req, res) => {
  res.json(
    await db.query(
      `SELECT s.id, s.name, s.address, s.phone, s.is_main, c.name AS city,
              (SELECT count(*)::int FROM ads a WHERE a.site_id = s.id AND a.status = 'active') AS active_ads
         FROM dealer_sites s JOIN cities c ON c.id = s.city_id WHERE s.dealer_id = $1 ORDER BY s.is_main DESC, s.name`,
      [req.dealer!.dealerId],
    ),
  );
});

proRouter.post('/sites', async (req, res) => {
  const ctx = req.dealer!;
  const input = z.object({
    name: z.string().trim().min(2).max(120), city_id: z.coerce.number().int().positive(),
    address: z.string().trim().max(300).optional(), phone: mgPhone.optional(),
  }).parse(req.body);
  const { n } = (await db.one<{ n: number }>('SELECT count(*)::int AS n FROM dealer_sites WHERE dealer_id = $1', [ctx.dealerId]))!;
  if (n >= 1 && !ctx.subscription?.multi_site) throw new HttpError(403, 'La gestion multi-sites est incluse dans la formule Platinum', { upgrade: true });
  const site = await db.one(
    'INSERT INTO dealer_sites (dealer_id, name, city_id, address, phone, is_main) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [ctx.dealerId, input.name, input.city_id, input.address ?? null, input.phone ?? null, n === 0],
  );
  res.status(201).json(site);
});

async function loadDealerAd(adId: number, dealerId: number) {
  const ad = await db.one<Record<string, unknown> & { id: number; model_id: number; year: number; price_mga: number; mileage_km: number }>(
    `SELECT a.id, a.title, a.description, a.price_mga, a.status, v.model_id, v.year, v.mileage_km, v.version,
            v.power_hp, v.exterior_color, v.previous_owners, b.name AS brand, m.name AS model,
            (SELECT count(*)::int FROM ad_photos p WHERE p.ad_id = a.id) AS photo_count,
            (SELECT count(*)::int FROM vehicle_equipment e WHERE e.vehicle_id = v.id) AS equipment_count
       FROM ads a JOIN vehicles v ON v.id = a.vehicle_id JOIN brands b ON b.id = v.brand_id JOIN models m ON m.id = v.model_id
      WHERE a.id = $1 AND a.seller_id = $2 AND a.status <> 'supprimee'`,
    [adId, dealerId],
  );
  if (!ad) throw new HttpError(404, 'Annonce introuvable dans votre stock');
  return ad;
}

// ---------------------------------------------------------------------------
// 1. Analyse de la demande
// ---------------------------------------------------------------------------
proRouter.get('/analytics', requireTool('analyse_demande'), async (req, res) => {
  const full = hasFullAccess(req, 'analyse_demande');
  const ads = await db.query<Record<string, number | string>>(
    `SELECT a.id, a.title, a.price_mga, a.status,
            GREATEST(0, current_date - COALESCE(a.published_at, a.created_at)::date) AS days_in_stock,
            COALESCE(sum(s.views), 0)::int AS views,
            COALESCE(sum(s.views) FILTER (WHERE s.day > current_date - 7), 0)::int AS views_7d,
            COALESCE(sum(s.phone_reveals), 0)::int AS phone_reveals,
            COALESCE(sum(s.messages), 0)::int AS messages,
            COALESCE(sum(s.favorites), 0)::int AS favorites
       FROM ads a LEFT JOIN ad_daily_stats s ON s.ad_id = a.id AND s.day > current_date - 30
      WHERE a.seller_id = $1 AND a.status IN ('active', 'suspendue', 'en_attente')
      GROUP BY a.id ORDER BY views DESC`,
    [req.dealer!.dealerId],
  );
  const rows = ads.map((a) => ({
    ...a,
    contact_rate: Number(a.views) ? Math.round(((Number(a.phone_reveals) + Number(a.messages)) / Number(a.views)) * 1000) / 10 : 0,
  }));

  if (!full) return res.json({ access: 'limite', ads: rows });

  const daily = await db.query(
    `SELECT d::date AS day,
            COALESCE(sum(s.views), 0)::int AS views,
            COALESCE(sum(s.phone_reveals + s.messages), 0)::int AS contacts
       FROM generate_series(current_date - 29, current_date, interval '1 day') d
       LEFT JOIN ad_daily_stats s ON s.day = d::date AND s.ad_id IN (SELECT id FROM ads WHERE seller_id = $1)
      GROUP BY d ORDER BY d`,
    [req.dealer!.dealerId],
  );
  // Référence : vues moyennes sur 30 jours des annonces actives de la plateforme
  const benchmark = await db.one<{ avg_views: number }>(
    `SELECT COALESCE(round(avg(v)), 0)::int AS avg_views FROM (
       SELECT sum(s.views) v FROM ads a JOIN ad_daily_stats s ON s.ad_id = a.id AND s.day > current_date - 30
        WHERE a.status = 'active' GROUP BY a.id) t`,
  );
  res.json({ access: 'complet', ads: rows, daily, benchmark });
});

// ---------------------------------------------------------------------------
// 2. Comparaison du marché
// ---------------------------------------------------------------------------
export async function marketFor(ad: { id: number; model_id: number; year: number; mileage_km: number }) {
  const comparables = await db.query<{ id: number; title: string; price_mga: number; year: number; mileage_km: number; city: string }>(
    `SELECT a.id, a.title, a.price_mga, v.year, v.mileage_km, c.name AS city
       FROM ads a JOIN vehicles v ON v.id = a.vehicle_id JOIN cities c ON c.id = a.city_id
      WHERE a.status = 'active' AND a.id <> $1 AND v.model_id = $2 AND v.year BETWEEN $3 - 2 AND $3 + 2
      ORDER BY abs(v.year - $3), abs(v.mileage_km - $4) LIMIT 30`,
    [ad.id, ad.model_id, ad.year, ad.mileage_km],
  );
  const prices = comparables.map((c) => c.price_mga).sort((a, b) => a - b);
  const median = prices.length ? prices[Math.floor(prices.length / 2)] : null;
  return { comparables, prices, median };
}

proRouter.get('/market/:adId', requireTool('comparaison_marche'), async (req, res) => {
  const ad = await loadDealerAd(Number(req.params.adId), req.dealer!.dealerId);
  const { comparables, prices, median } = await marketFor(ad);
  const stats = prices.length
    ? { count: prices.length, min: prices[0], median, max: prices.at(-1) }
    : { count: 0, min: null, median: null, max: null };
  const position = median == null ? 'inconnu' : ad.price_mga < median * 0.95 ? 'attractif' : ad.price_mga > median * 1.05 ? 'eleve' : 'dans_le_marche';

  if (!hasFullAccess(req, 'comparaison_marche')) {
    return res.json({ access: 'limite', ad: { id: ad.id, title: ad.title, price_mga: ad.price_mga }, stats, position });
  }

  // Maquette de l'estimation IA : médiane ajustée au kilométrage (≈ 1 % par 10 000 km d'écart à la moyenne)
  const avgKm = comparables.length ? comparables.reduce((s, c) => s + c.mileage_km, 0) / comparables.length : ad.mileage_km;
  const estimate = median == null ? null : Math.round((median * (1 - ((ad.mileage_km - avgKm) / 10_000) * 0.01)) / 100_000) * 100_000;
  res.json({
    access: 'complet', ad: { id: ad.id, title: ad.title, price_mga: ad.price_mga }, stats, position, comparables,
    ai_estimate: estimate == null ? null : {
      value_mga: estimate, low_mga: Math.round(estimate * 0.93), high_mga: Math.round(estimate * 1.07),
      confidence: comparables.length >= 5 ? 'moyenne' : 'faible', engine: 'maquette-v0',
    },
  });
});

// ---------------------------------------------------------------------------
// 3. Lead Manager Pro
// ---------------------------------------------------------------------------
const leadStatuses = ['nouveau', 'contacte', 'rdv', 'negociation', 'gagne', 'perdu'] as const;

proRouter.get('/leads', requireTool('lead_manager'), async (req, res) => {
  const status = z.enum(leadStatuses).optional().parse(req.query.status || undefined);
  const leads = await db.query(
    `SELECT l.id, l.name, l.phone, l.email, l.source, l.status, l.next_action_at, l.notes, l.created_at, l.updated_at,
            l.ad_id, a.title AS ad_title, l.conversation_id, l.assigned_to,
            au.first_name AS assigned_name,
            (SELECT body FROM messages m WHERE m.conversation_id = l.conversation_id ORDER BY created_at DESC LIMIT 1) AS last_message
       FROM leads l LEFT JOIN ads a ON a.id = l.ad_id LEFT JOIN users au ON au.id = l.assigned_to
      WHERE l.dealer_id = $1 AND ($2::lead_status IS NULL OR l.status = $2)
      ORDER BY l.updated_at DESC
      LIMIT ${hasFullAccess(req, 'lead_manager') ? 500 : 50}`,
    [req.dealer!.dealerId, status ?? null],
  );
  res.json({ access: req.dealer!.tools.lead_manager!.access, leads });
});

proRouter.post('/leads', requireTool('lead_manager'), async (req, res) => {
  const input = z.object({
    name: z.string().trim().min(2).max(160), phone: mgPhone.optional(), email: z.email().optional(),
    ad_id: z.coerce.number().int().positive().optional(), notes: z.string().max(4000).optional(),
    source: z.enum(['telephone', 'manuel']).default('manuel'),
  }).parse(req.body);
  if (input.ad_id) await loadDealerAd(input.ad_id, req.dealer!.dealerId);
  const lead = await db.one(
    `INSERT INTO leads (dealer_id, ad_id, name, phone, email, source, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [req.dealer!.dealerId, input.ad_id ?? null, input.name, input.phone ?? null, input.email ?? null, input.source, input.notes ?? null],
  );
  res.status(201).json(lead);
});

proRouter.patch('/leads/:id', requireTool('lead_manager'), async (req, res) => {
  const full = hasFullAccess(req, 'lead_manager');
  const input = z.object({
    status: z.enum(leadStatuses).optional(),
    notes: z.string().max(4000).optional(),
    assigned_to: z.coerce.number().int().positive().nullable().optional(),
    next_action_at: z.iso.datetime({ offset: true }).nullable().optional(),
  }).parse(req.body);
  if (!full && (input.assigned_to !== undefined || input.next_action_at !== undefined)) {
    throw new HttpError(403, 'L’attribution et les relances sont incluses à partir de la formule Gold', { upgrade: true });
  }
  if (input.assigned_to) {
    const member = await db.one('SELECT 1 FROM dealer_members WHERE dealer_id = $1 AND user_id = $2', [req.dealer!.dealerId, input.assigned_to]);
    if (!member) throw new HttpError(422, 'Cette personne ne fait pas partie de votre équipe');
  }

  const lead = await db.transaction(async (tx) => {
    const { rows: [current] } = await tx.query<{ status: string }>(
      'SELECT status FROM leads WHERE id = $1 AND dealer_id = $2', [Number(req.params.id), req.dealer!.dealerId],
    );
    if (!current) throw new HttpError(404, 'Prospect introuvable');
    const entries = Object.entries(input).filter(([, v]) => v !== undefined);
    if (entries.length) {
      await tx.query(
        `UPDATE leads SET ${entries.map(([k], i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`,
        [Number(req.params.id), ...entries.map(([, v]) => v)],
      );
    }
    if (input.status && input.status !== current.status) {
      await tx.query(
        `INSERT INTO lead_activities (lead_id, author_id, kind, body) VALUES ($1, $2, 'statut', $3)`,
        [Number(req.params.id), req.user!.id, `${current.status} → ${input.status}`],
      );
    }
    return { id: Number(req.params.id), ...input };
  });
  res.json(lead);
});

proRouter.get('/leads/:id/activities', requireTool('lead_manager'), async (req, res) => {
  res.json(
    await db.query(
      `SELECT la.id, la.kind, la.body, la.created_at, u.first_name AS author
         FROM lead_activities la JOIN leads l ON l.id = la.lead_id LEFT JOIN users u ON u.id = la.author_id
        WHERE la.lead_id = $1 AND l.dealer_id = $2 ORDER BY la.created_at DESC`,
      [Number(req.params.id), req.dealer!.dealerId],
    ),
  );
});

proRouter.post('/leads/:id/activities', requireTool('lead_manager'), async (req, res) => {
  const input = z.object({ kind: z.enum(['note', 'appel', 'email', 'rdv']), body: z.string().trim().min(1).max(4000) }).parse(req.body);
  const lead = await db.one('SELECT id FROM leads WHERE id = $1 AND dealer_id = $2', [Number(req.params.id), req.dealer!.dealerId]);
  if (!lead) throw new HttpError(404, 'Prospect introuvable');
  const activity = await db.one(
    'INSERT INTO lead_activities (lead_id, author_id, kind, body) VALUES ($1, $2, $3, $4) RETURNING id, kind, body, created_at',
    [Number(req.params.id), req.user!.id, input.kind, input.body],
  );
  await db.query('UPDATE leads SET updated_at = now() WHERE id = $1', [Number(req.params.id)]);
  res.status(201).json(activity);
});

// ---------------------------------------------------------------------------
// 4. Offre directe aux utilisateurs ayant mis le véhicule en favori
// ---------------------------------------------------------------------------
proRouter.get('/offers', requireTool('offre_directe'), async (req, res) => {
  const ctx = req.dealer!;
  const [offers, favorites, usage] = await Promise.all([
    db.query(
      `SELECT o.id, o.ad_id, a.title AS ad_title, o.original_price_mga, o.offer_price_mga, o.expires_at, o.created_at,
              (SELECT count(*)::int FROM direct_offer_recipients r WHERE r.offer_id = o.id) AS recipients
         FROM direct_offers o JOIN ads a ON a.id = o.ad_id WHERE o.dealer_id = $1 ORDER BY o.created_at DESC LIMIT 50`,
      [ctx.dealerId],
    ),
    db.query(
      `SELECT a.id, a.title, a.price_mga, count(f.user_id)::int AS favorites,
              count(f.user_id) FILTER (WHERE NOT EXISTS (
                SELECT 1 FROM direct_offer_recipients r JOIN direct_offers o ON o.id = r.offer_id
                 WHERE o.ad_id = a.id AND r.user_id = f.user_id AND o.expires_at > now()))::int AS reachable
         FROM ads a JOIN favorites f ON f.ad_id = a.id
        WHERE a.seller_id = $1 AND a.status = 'active' GROUP BY a.id ORDER BY favorites DESC`,
      [ctx.dealerId],
    ),
    db.one<{ n: number }>(
      `SELECT count(*)::int AS n FROM direct_offers WHERE dealer_id = $1 AND created_at >= date_trunc('month', now())`, [ctx.dealerId],
    ),
  ]);
  res.json({ quota: ctx.tools.offre_directe!.monthly_quota, used_this_month: usage!.n, offers, ads_with_favorites: favorites });
});

proRouter.post('/offers', requireTool('offre_directe'), async (req, res) => {
  const ctx = req.dealer!;
  const input = z.object({
    ad_id: z.coerce.number().int().positive(),
    offer_price_mga: z.coerce.number().int().positive(),
    message: z.string().trim().max(1000).optional(),
    valid_days: z.coerce.number().int().min(1).max(14).default(3),
  }).parse(req.body);

  const quota = ctx.tools.offre_directe!.monthly_quota;
  const { n } = (await db.one<{ n: number }>(
    `SELECT count(*)::int AS n FROM direct_offers WHERE dealer_id = $1 AND created_at >= date_trunc('month', now())`, [ctx.dealerId],
  ))!;
  if (quota != null && n >= quota) throw new HttpError(403, `Quota atteint : ${quota} offres directes par mois avec votre formule`, { upgrade: true });

  const ad = await loadDealerAd(input.ad_id, ctx.dealerId);
  if (ad.status !== 'active') throw new HttpError(422, 'L’annonce doit être en ligne');
  if (input.offer_price_mga >= ad.price_mga) throw new HttpError(422, 'Le prix de l’offre doit être inférieur au prix affiché');

  const result = await db.transaction(async (tx) => {
    const { rows: [offer] } = await tx.query<{ id: number; expires_at: string }>(
      `INSERT INTO direct_offers (ad_id, dealer_id, original_price_mga, offer_price_mga, message, expires_at)
       VALUES ($1, $2, $3, $4, $5, now() + make_interval(days => $6)) RETURNING id, expires_at`,
      [ad.id, ctx.dealerId, ad.price_mga, input.offer_price_mga, input.message ?? null, input.valid_days],
    );
    const { rows: recipients } = await tx.query<{ user_id: number }>(
      `SELECT f.user_id FROM favorites f WHERE f.ad_id = $1 AND f.user_id <> $2 AND NOT EXISTS (
         SELECT 1 FROM direct_offer_recipients r JOIN direct_offers o ON o.id = r.offer_id
          WHERE o.ad_id = $1 AND r.user_id = f.user_id AND o.expires_at > now() AND o.id <> $3)`,
      [ad.id, ctx.dealerId, offer.id],
    );
    if (!recipients.length) throw new HttpError(422, 'Aucun utilisateur à contacter : personne n’a mis cette annonce en favori, ou tous ont déjà reçu une offre en cours');

    const fmt = new Intl.NumberFormat('fr-FR');
    const body = [
      `Offre exclusive sur « ${ad.title} » : ${fmt.format(input.offer_price_mga)} Ar au lieu de ${fmt.format(ad.price_mga)} Ar,`,
      `valable ${input.valid_days} jour(s).`,
      input.message ?? '',
    ].join(' ').trim();

    for (const { user_id } of recipients) {
      const { rows: [conv] } = await tx.query<{ id: number }>(
        `INSERT INTO conversations (ad_id, buyer_id, seller_id) VALUES ($1, $2, $3)
         ON CONFLICT (ad_id, buyer_id) DO UPDATE SET last_message_at = now() RETURNING id`,
        [ad.id, user_id, ctx.dealerId],
      );
      await tx.query('INSERT INTO messages (conversation_id, sender_id, body) VALUES ($1, $2, $3)', [conv.id, req.user!.id, body]);
      await tx.query('INSERT INTO direct_offer_recipients (offer_id, user_id, conversation_id) VALUES ($1, $2, $3)', [offer.id, user_id, conv.id]);
    }
    return { offer_id: offer.id, expires_at: offer.expires_at, recipients: recipients.length };
  });
  res.status(201).json(result);
});

// ---------------------------------------------------------------------------
// 5. Contrôle qualité
// ---------------------------------------------------------------------------
proRouter.get('/quality', requireTool('controle_qualite'), async (req, res) => {
  const ads = await db.query<{ id: number }>(
    `SELECT a.id FROM ads a WHERE a.seller_id = $1 AND a.status IN ('active', 'en_attente', 'suspendue') ORDER BY a.created_at DESC`,
    [req.dealer!.dealerId],
  );
  const full = hasFullAccess(req, 'controle_qualite');
  const reports = [];
  for (const { id } of ads) {
    const ad = await loadDealerAd(id, req.dealer!.dealerId);
    const { median } = await marketFor(ad);
    const report = evaluateQuality({ ...(ad as unknown as QualityInput), market_median: median });
    reports.push({
      ad_id: ad.id, title: ad.title, photo_count: ad.photo_count, score: report.score, grade: report.grade,
      checks: report.checks.map(({ code, label, passed }) => ({ code, label, passed })),
      // Formule limitée : la recommandation prioritaire seulement
      recommendations: full ? report.recommendations : report.recommendations.slice(0, 1),
      engine: report.engine,
    });
    await db.query('INSERT INTO ad_quality_reports (ad_id, score, details) VALUES ($1, $2, $3)', [ad.id, report.score, JSON.stringify(report)]);
  }
  res.json({ access: req.dealer!.tools.controle_qualite!.access, reports });
});
