import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { HttpError } from '../lib/http.js';
import { capturePaypal, createPayment, paymentOptions, startCheckout, verifyStripeSignature } from '../lib/payment-gateways.js';
import { paymentStartSchema, planCodeSchema } from '../lib/schemas.js';
import { requireAuth } from '../middleware/auth.js';

/**
 * Paiements (sponsorisation d'annonces et abonnements pro) : Mobile Money, carte (Stripe) et PayPal.
 *
 *  1. Création du paiement + de l'objet payé (ad_sponsorships ou dealer_subscriptions)
 *  2. startCheckout : push Mobile Money (à venir) ou page hébergée Stripe / PayPal → statut « en_attente »
 *  3. Confirmation : webhook Stripe signé, capture PayPal au retour, callback opérateur Mobile Money
 *  4. confirmPayment() active ce qui a été payé (idempotent)
 *
 * En développement, POST /payments/:id/simulate remplace le prestataire.
 */
export const paymentsRouter = Router();

paymentsRouter.get('/options', (_req, res) => res.json(paymentOptions()));

paymentsRouter.post('/sponsor/:adId', requireAuth, async (req, res) => {
  const start = paymentStartSchema.parse(req.body);
  const { plan_code } = planCodeSchema.parse(req.body);
  const adId = Number(req.params.adId);

  const result = await db.transaction(async (tx) => {
    const { rows: [ad] } = await tx.query(
      `SELECT id FROM ads WHERE id = $1 AND seller_id = $2 AND status IN ('active', 'en_attente')`,
      [adId, req.user!.id],
    );
    if (!ad) throw new HttpError(404, 'Annonce introuvable');

    const { rows: [plan] } = await tx.query<{ id: number; price_mga: number; label: string }>(
      'SELECT id, price_mga, label FROM sponsorship_plans WHERE code = $1 AND is_active', [plan_code],
    );
    if (!plan) throw new HttpError(422, 'Offre de sponsorisation inconnue');

    const payment = await createPayment(tx, {
      userId: req.user!.id, purpose: 'sponsorisation', start, amount: plan.price_mga, metadata: { ad_id: adId, plan_code },
    });
    const { rows: [sponsorship] } = await tx.query(
      'INSERT INTO ad_sponsorships (ad_id, plan_id, payment_id) VALUES ($1, $2, $3) RETURNING id, status',
      [adId, plan.id, payment.id],
    );
    return { payment, sponsorship, amount_mga: plan.price_mga, plan: plan.label };
  });

  const checkout = await startCheckout(result.payment, `Mise en avant « ${result.plan} »`);
  res.status(201).json({ ...result, payment: { ...result.payment, ...checkout } });
});

/** Statut d'un paiement : interrogé par l'interface pendant la validation. */
paymentsRouter.get('/:id', requireAuth, async (req, res) => {
  const payment = await db.one(
    `SELECT id, purpose, method, provider, status, amount_mga, charge_currency, charge_amount_minor, payer_msisdn,
            checkout_url, card_brand, card_last4, failure_reason, metadata, created_at, confirmed_at
       FROM payments WHERE id = $1 AND user_id = $2`,
    [Number(req.params.id), req.user!.id],
  );
  if (!payment) throw new HttpError(404, 'Paiement introuvable');
  res.json(payment);
});

/** Retour depuis la page Stripe / PayPal. PayPal : capture de la commande ; Stripe : le webhook fait foi. */
paymentsRouter.post('/:id/return', requireAuth, async (req, res) => {
  const p = await db.one<{ id: number; provider: string; status: string; checkout_session_id: string | null }>(
    'SELECT id, provider, status, checkout_session_id FROM payments WHERE id = $1 AND user_id = $2',
    [Number(req.params.id), req.user!.id],
  );
  if (!p) throw new HttpError(404, 'Paiement introuvable');
  if (req.body?.etat === 'annule' && ['initie', 'en_attente'].includes(p.status)) {
    await db.query(`UPDATE payments SET status = 'annule', failure_reason = 'Abandonné sur la page de paiement' WHERE id = $1`, [p.id]);
  } else if (p.provider === 'paypal' && p.checkout_session_id && p.status === 'en_attente') {
    if (await capturePaypal(p.checkout_session_id)) await confirmPayment(p.id, p.checkout_session_id);
  }
  res.json(await db.one('SELECT id, status FROM payments WHERE id = $1', [p.id]));
});

/** Développement uniquement : simule la réponse du prestataire (Mobile Money, carte ou PayPal). */
paymentsRouter.post('/:id/simulate', requireAuth, async (req, res) => {
  if (process.env.NODE_ENV === 'production') throw new HttpError(404, 'Route inconnue');
  const { outcome } = z.object({ outcome: z.enum(['reussi', 'echoue']) }).parse(req.body);
  const id = Number(req.params.id);
  const payment = await db.one<{ method: string }>('SELECT id, method FROM payments WHERE id = $1 AND user_id = $2', [id, req.user!.id]);
  if (!payment) throw new HttpError(404, 'Paiement introuvable');

  if (outcome === 'reussi') {
    if (payment.method === 'carte') await db.query(`UPDATE payments SET card_brand = 'visa', card_last4 = '4242' WHERE id = $1`, [id]);
    await confirmPayment(id, `SIMULATION-${id}-${Date.now()}`);
  } else {
    await db.query(`UPDATE payments SET status = 'echoue', failure_reason = 'Refusé (simulation)' WHERE id = $1 AND status IN ('initie', 'en_attente')`, [id]);
  }
  res.json(await db.one('SELECT id, status, failure_reason, confirmed_at FROM payments WHERE id = $1', [id]));
});

/**
 * Webhook Stripe — monté AVANT express.json() avec le corps brut (voir index.ts),
 * indispensable pour vérifier la signature.
 */
export async function stripeWebhook(req: Request, res: Response) {
  const raw = req.body as Buffer;
  if (!verifyStripeSignature(raw, req.header('stripe-signature'))) throw new HttpError(400, 'Signature Stripe invalide');
  const event = JSON.parse(raw.toString('utf8')) as {
    type: string;
    data: { object: { id: string; client_reference_id?: string; payment_status?: string } };
  };
  const paymentId = Number(event.data.object.client_reference_id) || null;
  await db.query('INSERT INTO payment_events (payment_id, provider, event_type, payload) VALUES ($1, $2, $3, $4)',
    [paymentId, 'stripe', event.type, raw.toString('utf8')]);

  if (paymentId && event.type === 'checkout.session.completed' && event.data.object.payment_status === 'paid') {
    await confirmPayment(paymentId, event.data.object.id);
  }
  if (paymentId && event.type === 'checkout.session.expired') {
    await db.query(`UPDATE payments SET status = 'annule', failure_reason = 'Session expirée' WHERE id = $1 AND status = 'en_attente'`, [paymentId]);
  }
  res.json({ received: true });
}

/**
 * Callbacks Mobile Money et webhook PayPal : journalisés tels quels.
 * Chaque connecteur devra vérifier l'origine (signature opérateur / API verify-webhook-signature de PayPal)
 * avant d'appeler confirmPayment.
 */
paymentsRouter.post('/callback/:provider', async (req, res) => {
  const provider = String(req.params.provider);
  if (!['mvola', 'orange_money', 'airtel_money', 'paypal'].includes(provider)) throw new HttpError(404, 'Prestataire inconnu');
  await db.query('INSERT INTO payment_events (provider, event_type, payload) VALUES ($1, $2, $3)',
    [provider, 'callback', JSON.stringify(req.body ?? {})]);
  res.status(202).json({ received: true });
});

/** Activation de ce qui a été payé (sponsorisation ou abonnement). Idempotent. */
export async function confirmPayment(paymentId: number, providerReference: string) {
  await db.transaction(async (tx) => {
    const { rows: [payment] } = await tx.query<{ id: number; purpose: string }>(
      `UPDATE payments SET status = 'reussi', provider_reference = $2, confirmed_at = now()
        WHERE id = $1 AND status IN ('initie', 'en_attente') RETURNING id, purpose`,
      [paymentId, providerReference],
    );
    if (!payment) return;

    if (payment.purpose === 'abonnement') {
      const { rows: [sub] } = await tx.query<{ id: number; dealer_id: number }>(
        'SELECT id, dealer_id FROM dealer_subscriptions WHERE payment_id = $1', [paymentId],
      );
      // Changement de formule : l'abonnement précédent prend fin, le nouveau démarre aujourd'hui
      await tx.query(
        `UPDATE dealer_subscriptions SET status = 'expiree', ends_at = LEAST(ends_at, now())
          WHERE dealer_id = $1 AND status = 'active'`,
        [sub.dealer_id],
      );
      await tx.query(
        `UPDATE dealer_subscriptions s SET status = 'active', starts_at = now(),
                ends_at = now() + make_interval(days => p.billing_period_days)
           FROM subscription_plans p WHERE s.id = $1 AND p.id = s.plan_id`,
        [sub.id],
      );
      return;
    }

    const { rows: [s] } = await tx.query<{ ad_id: number }>(
      `UPDATE ad_sponsorships s
          SET status = 'active',
              starts_at = now(),
              ends_at = GREATEST(now(), COALESCE(a.sponsored_until, now())) + make_interval(days => p.duration_days)
         FROM sponsorship_plans p, ads a
        WHERE s.payment_id = $1 AND p.id = s.plan_id AND a.id = s.ad_id
        RETURNING s.ad_id, s.ends_at`,
      [paymentId],
    );
    await tx.query(
      `UPDATE ads SET sponsored_until = (SELECT max(ends_at) FROM ad_sponsorships WHERE ad_id = $1 AND status = 'active')
        WHERE id = $1`,
      [s.ad_id],
    );
  });
}
