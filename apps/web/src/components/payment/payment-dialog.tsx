'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, CreditCard, ExternalLink, Lock, Smartphone, Wallet, X, XCircle } from 'lucide-react';
import { fmt } from '@/i18n';
import { useDict } from '@/i18n/client';
import { API_URL } from '@/lib/api';
import { bff } from '@/lib/bff';
import { formatMGA } from '@/lib/format';
import { PROVIDERS, phonePrefix, type Provider } from '@/lib/mobile-money';

type Step = 'choose' | 'pending' | 'hosted' | 'redirecting' | 'success' | 'failed';
type Method = 'mobile_money' | 'carte' | 'paypal';

/** Corps envoyé à l'API : Mobile Money avec opérateur et numéro ; carte et PayPal sans aucune donnée sensible. */
export type PaymentStart =
  | { method: 'mobile_money'; provider: Provider; payer_msisdn: string }
  | { method: 'carte' }
  | { method: 'paypal' };

export interface StartedPayment { id: number; checkout_url: string | null }

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  amountMga: number;
  /** Bloc libre au-dessus du choix du moyen de paiement (ex. choix de l'offre de mise en avant) */
  children?: React.ReactNode;
  defaultPhone?: string | null;
  /** Crée le paiement côté API */
  start: (payload: PaymentStart) => Promise<StartedPayment>;
  onSuccess?: () => void;
}

interface Options { mga_per_eur: number; card_currency: string }

const SIMULATION = process.env.NEXT_PUBLIC_PAYMENT_SIMULATION !== 'off';
const POLL_MS = 3000;

const METHODS: { id: Method; Icon: typeof Smartphone }[] = [
  { id: 'mobile_money', Icon: Smartphone },
  { id: 'carte', Icon: CreditCard },
  { id: 'paypal', Icon: Wallet },
];

/**
 * Parcours de paiement :
 *  - Mobile Money (MVola, Orange Money, Airtel Money) : demande poussée sur le téléphone, validation par code secret ;
 *  - Carte bancaire : redirection vers Stripe Checkout (aucune donnée de carte sur fiara.mdg) ;
 *  - PayPal : redirection vers la page d'approbation PayPal.
 * La confirmation arrive par l'API (webhook / callback) ; la fenêtre interroge le statut toutes les 3 s.
 */
export function PaymentDialog({ open, onClose, title, amountMga, children, defaultPhone, start, onSuccess }: Props) {
  const t = useDict();
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<Step>('choose');
  const [method, setMethod] = useState<Method>('mobile_money');
  const [provider, setProvider] = useState<Provider>('mvola');
  const [phone, setPhone] = useState(defaultPhone ? defaultPhone.replace(/^\+261/, '0') : '');
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const op = PROVIDERS.find((p) => p.code === provider)!;
  const prefix = phonePrefix(phone);
  const mismatch = prefix !== null && !op.prefixes.includes(prefix);
  const hostedName = method === 'paypal' ? 'PayPal' : 'Stripe';

  // Montant débité en devise pour carte / PayPal (arrondi au centime supérieur, comme l'API)
  const currency = method === 'paypal' ? 'EUR' : options?.card_currency ?? 'EUR';
  const charge = options && currency !== 'MGA'
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(Math.ceil((amountMga / options.mga_per_eur) * 100) / 100)
    : formatMGA(amountMga);

  useEffect(() => {
    fetch(`${API_URL}/payments/options`).then((r) => r.json()).then(setOptions).catch(() => {});
  }, []);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      setStep('choose');
      setError('');
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!['pending', 'hosted'].includes(step) || !paymentId) return;
    const timer = setInterval(async () => {
      const p = await bff<{ status: string }>(`/payments/${paymentId}`).catch(() => null);
      if (p?.status === 'reussi') setStep('success');
      else if (p && ['echoue', 'annule'].includes(p.status)) setStep('failed');
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [step, paymentId]);

  const simulate = async (outcome: 'reussi' | 'echoue') => {
    if (!paymentId) return;
    await bff(`/payments/${paymentId}/simulate`, { method: 'POST', json: { outcome } });
    setStep(outcome === 'reussi' ? 'success' : 'failed');
  };

  // Le rafraîchissement de la page appelante attend la fermeture : l'écran de confirmation reste visible
  const close = () => {
    if (step === 'success') onSuccess?.();
    onClose();
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const payload: PaymentStart = method === 'mobile_money' ? { method, provider, payer_msisdn: phone } : { method };
      const started = await start(payload);
      setPaymentId(started.id);
      if (started.checkout_url) {
        setStep('redirecting');
        window.location.assign(started.checkout_url);
      } else {
        setStep(method === 'mobile_money' ? 'pending' : 'hosted');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = method !== 'mobile_money' || (prefix && !mismatch);

  return (
    <dialog
      ref={dialog}
      onClose={close}
      onCancel={close}
      aria-labelledby="pay-title"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-xl bg-surface p-0 text-ink shadow-[0_24px_64px_-12px_rgb(7_44_68/0.45)] backdrop:bg-brand-deep/60"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-surface px-5 py-4">
        <div>
          <h2 id="pay-title" className="text-lg font-extrabold">{title}</h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            {t.payment.amount} : <span className="tabular font-extrabold text-brand-ink">{formatMGA(amountMga)}</span>
          </p>
        </div>
        <button type="button" onClick={close} className="grid size-9 shrink-0 place-items-center rounded-md hover:bg-paper" aria-label={t.common.close}>
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div className="px-5 py-5">
        {step === 'choose' && (
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) submit();
            }}
          >
            {children}

            <fieldset>
              <legend className="label">{t.payment.methodAria}</legend>
              <div role="radiogroup" className="grid grid-cols-3 gap-1 rounded-lg bg-paper p-1">
                {METHODS.map(({ id, Icon }) => (
                  <label
                    key={id}
                    className={`flex cursor-pointer flex-col items-center gap-1 rounded-md px-2 py-2 text-center text-xs font-bold transition-colors sm:text-sm ${
                      method === id ? 'bg-surface text-brand-ink shadow-[0_1px_3px_rgb(7_44_68/0.15)]' : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    <input type="radio" name="method" value={id} checked={method === id} onChange={() => setMethod(id)} className="sr-only" />
                    <Icon className="size-5" aria-hidden />
                    {t.payment.methods[id]}
                  </label>
                ))}
              </div>
            </fieldset>

            {method === 'mobile_money' && (
              <>
                <fieldset>
                  <legend className="label">{t.payment.choose}</legend>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {PROVIDERS.map((p) => (
                      <label
                        key={p.code}
                        className={`flex cursor-pointer flex-col rounded-lg border-2 p-3 transition-colors ${provider === p.code ? 'border-brand bg-brand-tint' : 'border-line hover:border-line-strong'}`}
                      >
                        <input type="radio" name="provider" value={p.code} checked={provider === p.code} onChange={() => setProvider(p.code)} className="sr-only" />
                        <span className="font-extrabold">{p.name}</span>
                        <span className="tabular text-xs text-ink-soft">{p.network} · {p.prefixes.join(' / ')}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div>
                  <label htmlFor="pay-phone" className="label">{t.payment.phone}</label>
                  <input
                    id="pay-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={`${op.prefixes[0]} 12 345 67`}
                    className="field tabular"
                    aria-invalid={mismatch}
                    aria-describedby="pay-phone-hint"
                  />
                  <p id="pay-phone-hint" className={`mt-1 text-sm ${mismatch ? 'text-danger' : 'text-ink-faint'}`}>
                    {mismatch ? fmt(t.payment.phoneMismatch, { op: op.name, prefixes: op.prefixes.join(', ') }) : t.auth.phoneHint}
                  </p>
                </div>
              </>
            )}

            {method !== 'mobile_money' && (
              <div className="space-y-3 rounded-lg border border-line p-4">
                <p className="text-sm leading-relaxed">{method === 'carte' ? t.payment.cardText : t.payment.paypalText}</p>
                {options && (
                  <p className="tabular text-sm text-ink-soft">
                    {fmt(t.payment.chargeNote, { amount: charge, mga: formatMGA(amountMga), rate: new Intl.NumberFormat('fr-FR').format(options.mga_per_eur) })}
                  </p>
                )}
                <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-faint">
                  <ExternalLink className="size-3.5" aria-hidden /> {method === 'carte' ? 'checkout.stripe.com' : 'paypal.com'}
                </p>
              </div>
            )}

            {error && <p role="alert" className="rounded-md bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}
            <button type="submit" className="btn-primary h-12 w-full" disabled={busy || !canSubmit}>
              {method === 'mobile_money' ? <Smartphone className="size-5" aria-hidden /> : method === 'carte' ? <CreditCard className="size-5" aria-hidden /> : <Wallet className="size-5" aria-hidden />}
              {busy
                ? t.common.loading
                : method === 'mobile_money'
                  ? `${t.payment.request} · ${formatMGA(amountMga)}`
                  : fmt(method === 'carte' ? t.payment.payCard : t.payment.payPaypal, { amount: charge })}
            </button>
            {method === 'mobile_money' && (
              <p className="flex items-center gap-2 text-xs text-ink-faint">
                <Lock className="size-3.5 shrink-0" aria-hidden /> {t.payment.secure}
              </p>
            )}
          </form>
        )}

        {(step === 'pending' || step === 'hosted') && (
          <div className="text-center" aria-live="polite">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-brand-tint">
              {step === 'pending' ? <Smartphone className="size-8 animate-pulse text-brand-ink" aria-hidden /> : <CreditCard className="size-8 animate-pulse text-brand-ink" aria-hidden />}
            </div>
            <h3 className="mt-4 text-lg font-extrabold">{step === 'pending' ? t.payment.pendingTitle : fmt(t.payment.hostedTitle, { op: hostedName })}</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
              {step === 'pending'
                ? fmt(t.payment.pendingText, { amount: formatMGA(amountMga), phone, op: op.name })
                : fmt(t.payment.hostedText, { op: hostedName })}
            </p>
            {step === 'pending' && (
              <p className="mx-auto mt-3 max-w-sm rounded-md bg-paper px-3 py-2 text-sm">{fmt(t.payment.ussd, { code: op.ussd })}</p>
            )}
            <p className="mt-4 text-xs font-semibold text-ink-faint">{t.payment.waiting}</p>
            {SIMULATION && (
              <div className="mt-5 rounded-lg border border-dashed border-action p-3">
                <p className="text-xs font-semibold text-action-ink">{t.payment.simulation}</p>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  <button type="button" className="btn-primary h-9 px-3 text-sm" onClick={() => simulate('reussi')}>{t.payment.simulateOk}</button>
                  <button type="button" className="btn-secondary h-9 px-3 text-sm" onClick={() => simulate('echoue')}>{t.payment.simulateKo}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'redirecting' && <p className="py-8 text-center font-semibold text-ink-soft" aria-live="polite">{t.payment.redirecting}</p>}

        {step === 'success' && (
          <div className="text-center" role="status">
            <CheckCircle2 className="mx-auto size-14 text-ok" aria-hidden />
            <h3 className="mt-3 text-lg font-extrabold">{t.payment.successTitle}</h3>
            <p className="mt-1 text-sm text-ink-soft">{t.payment.successText}</p>
            <button type="button" className="btn-primary mt-5" onClick={close}>{t.common.close}</button>
          </div>
        )}

        {step === 'failed' && (
          <div className="text-center" role="alert">
            <XCircle className="mx-auto size-14 text-danger" aria-hidden />
            <h3 className="mt-3 text-lg font-extrabold">{t.payment.failedTitle}</h3>
            <p className="mt-1 text-sm text-ink-soft">{t.payment.failedText}</p>
            <button type="button" className="btn-primary mt-5" onClick={() => setStep('choose')}>{t.payment.retry}</button>
          </div>
        )}
      </div>
    </dialog>
  );
}
