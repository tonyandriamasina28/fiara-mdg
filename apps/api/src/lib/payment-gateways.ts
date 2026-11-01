import crypto from 'node:crypto';
import { config } from '../config.js';
import { db, type Queryable } from '../db.js';
import { HttpError } from './http.js';
import type { PaymentStart } from './schemas.js';

/**
 * Passerelles de paiement.
 *  - Mobile Money (MVola, Orange Money, Airtel Money) : push USSD sur le téléphone — connecteurs à venir.
 *  - Carte bancaire : Stripe Checkout (page hébergée, fiara.mdg ne voit jamais le numéro de carte).
 *  - PayPal : Orders API v2 (page d'approbation hébergée).
 * Sans identifiants configurés, carte et PayPal passent en simulation (comme le Mobile Money).
 */

type Purpose = 'sponsorisation' | 'abonnement';
const ZERO_DECIMAL = new Set(['MGA', 'XOF', 'JPY']);

function chargeFor(method: PaymentStart['method'], amountMga: number) {
  if (method === 'mobile_money') return { currency: 'MGA', minor: amountMga, rate: null as number | null };
  const currency = method === 'paypal' ? 'EUR' : config.payments.cardCurrency;
  if (currency === 'MGA') return { currency, minor: amountMga, rate: 1 };
  // Arrondi au centime supérieur : le montant en Ariary n'est jamais sous-facturé
  return { currency, minor: Math.ceil((amountMga / config.payments.mgaPerEur) * 100), rate: config.payments.mgaPerEur };
}

export function paymentOptions() {
  return {
    mga_per_eur: config.payments.mgaPerEur,
    card_currency: config.payments.cardCurrency,
    card_live: Boolean(config.payments.stripeSecretKey),
    paypal_live: Boolean(config.payments.paypalClientId && config.payments.paypalClientSecret),
  };
}

/** Insère le paiement (dans la transaction de l'achat). L'ouverture de la page de paiement se fait après COMMIT. */
export async function createPayment(
  tx: Queryable,
  p: { userId: number; purpose: Purpose; start: PaymentStart; amount: number; metadata: object },
) {
  const provider = p.start.method === 'mobile_money' ? p.start.provider : p.start.method === 'carte' ? 'stripe' : 'paypal';
  const charge = chargeFor(p.start.method, p.amount);
  const { rows: [payment] } = await tx.query<{ id: number; idempotency_key: string }>(
    `INSERT INTO payments (user_id, purpose, method, provider, amount_mga, payer_msisdn, charge_currency, charge_amount_minor, exchange_rate, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, idempotency_key`,
    [p.userId, p.purpose, p.start.method, provider, p.amount, p.start.method === 'mobile_money' ? p.start.payer_msisdn : null,
     charge.currency, charge.minor, charge.rate, JSON.stringify(p.metadata)],
  );
  return { id: payment.id, idempotency_key: payment.idempotency_key, method: p.start.method, provider, charge };
}

type Created = Awaited<ReturnType<typeof createPayment>>;

/**
 * Ouvre la session chez le prestataire et renvoie l'URL où rediriger l'utilisateur
 * (null pour le Mobile Money et en simulation). Passe le paiement « en_attente ».
 */
export async function startCheckout(payment: Created, label: string) {
  const returnUrl = `${config.webOrigin}/paiement/retour?paiement=${payment.id}`;
  let session: { id: string; url: string } | null = null;

  if (payment.method === 'carte' && config.payments.stripeSecretKey) session = await stripeCheckout(payment, label, returnUrl);
  if (payment.method === 'paypal' && config.payments.paypalClientId) session = await paypalOrder(payment, label, returnUrl);
  // TODO(connecteurs Mobile Money) : requestToPay(payment) vers l'opérateur

  await db.query(
    `UPDATE payments SET status = 'en_attente', checkout_session_id = $2, checkout_url = $3 WHERE id = $1`,
    [payment.id, session?.id ?? null, session?.url ?? null],
  );
  return { checkout_url: session?.url ?? null, simulated: !session && payment.method !== 'mobile_money' };
}

// ---------------------------------------------------------------------------
// Stripe Checkout
// ---------------------------------------------------------------------------
async function stripeCheckout(payment: Created, label: string, returnUrl: string) {
  const body = new URLSearchParams({
    mode: 'payment',
    client_reference_id: String(payment.id),
    'metadata[payment_id]': String(payment.id),
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': payment.charge.currency.toLowerCase(),
    'line_items[0][price_data][unit_amount]': String(payment.charge.minor),
    'line_items[0][price_data][product_data][name]': `fiara.mdg — ${label}`,
    success_url: `${returnUrl}&etat=retour`,
    cancel_url: `${returnUrl}&etat=annule`,
  });
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.payments.stripeSecretKey}`,
      'content-type': 'application/x-www-form-urlencoded',
      'idempotency-key': payment.idempotency_key,
    },
    body,
  });
  const json = (await res.json()) as { id?: string; url?: string; error?: { message: string } };
  if (!res.ok || !json.id || !json.url) throw new HttpError(502, `Stripe indisponible : ${json.error?.message ?? res.status}`);
  return { id: json.id, url: json.url };
}

/** Vérifie l'en-tête Stripe-Signature (HMAC SHA-256 de « t.corps », tolérance 5 min). */
export function verifyStripeSignature(rawBody: Buffer, header: string | undefined) {
  const secret = config.payments.stripeWebhookSecret;
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=') as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody.toString('utf8')}`).digest('hex');
  const given = header.split(',').filter((kv) => kv.startsWith('v1=')).map((kv) => kv.slice(3));
  return given.some((sig) => sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}

// ---------------------------------------------------------------------------
// PayPal Orders v2
// ---------------------------------------------------------------------------
async function paypalToken() {
  const { paypalClientId, paypalClientSecret, paypalApiBase } = config.payments;
  const res = await fetch(`${paypalApiBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${paypalClientId}:${paypalClientSecret}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new HttpError(502, 'PayPal indisponible (authentification)');
  return json.access_token;
}

async function paypalOrder(payment: Created, label: string, returnUrl: string) {
  const value = ZERO_DECIMAL.has(payment.charge.currency) ? String(payment.charge.minor) : (payment.charge.minor / 100).toFixed(2);
  const res = await fetch(`${config.payments.paypalApiBase}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${await paypalToken()}`,
      'content-type': 'application/json',
      'paypal-request-id': payment.idempotency_key,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{ reference_id: String(payment.id), description: `fiara.mdg — ${label}`, amount: { currency_code: payment.charge.currency, value } }],
      payment_source: {
        paypal: { experience_context: { return_url: `${returnUrl}&etat=retour`, cancel_url: `${returnUrl}&etat=annule`, user_action: 'PAY_NOW' } },
      },
    }),
  });
  const json = (await res.json()) as { id?: string; links?: { rel: string; href: string }[] };
  const approve = json.links?.find((l) => l.rel === 'payer-action' || l.rel === 'approve');
  if (!res.ok || !json.id || !approve) throw new HttpError(502, 'PayPal indisponible (création de commande)');
  return { id: json.id, url: approve.href };
}

/** Au retour de PayPal : capture la commande approuvée. Renvoie vrai si l'argent est encaissé. */
export async function capturePaypal(orderId: string) {
  const res = await fetch(`${config.payments.paypalApiBase}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: { authorization: `Bearer ${await paypalToken()}`, 'content-type': 'application/json' },
  });
  const json = (await res.json()) as { status?: string };
  return res.ok && json.status === 'COMPLETED';
}
