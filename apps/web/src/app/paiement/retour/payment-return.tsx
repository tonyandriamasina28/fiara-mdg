'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useDict } from '@/i18n/client';
import { bff } from '@/lib/bff';
import { formatMGA } from '@/lib/format';

interface Payment { id: number; purpose: 'sponsorisation' | 'abonnement'; method: string; status: string; amount_mga: number; card_brand: string | null; card_last4: string | null }

/**
 * Au retour, on signale l'issue à l'API (capture PayPal, annulation) puis on interroge
 * le statut : pour Stripe, c'est le webhook signé qui confirme le paiement.
 */
export function PaymentReturn({ paymentId, cancelled }: { paymentId: number; cancelled: boolean }) {
  const t = useDict();
  const [payment, setPayment] = useState<Payment | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    (async () => {
      await bff(`/payments/${paymentId}/return`, { method: 'POST', json: { etat: cancelled ? 'annule' : 'retour' } }).catch(() => {});
      const load = async () => {
        const p = await bff<Payment>(`/payments/${paymentId}`).catch(() => null);
        setPayment(p);
        if (p && !['initie', 'en_attente'].includes(p.status)) clearInterval(timer);
      };
      await load();
      timer = setInterval(load, 3000);
    })();
    return () => clearInterval(timer);
  }, [paymentId, cancelled]);

  const back = payment?.purpose === 'abonnement' ? { href: '/pro', label: t.payment.backToPro } : { href: '/compte#annonces', label: t.payment.backToAccount };
  const status = payment?.status;

  return (
    <div className="card p-8 text-center" aria-live="polite">
      {status === 'reussi' ? (
        <>
          <CheckCircle2 className="mx-auto size-14 text-ok" aria-hidden />
          <h1 className="mt-3 text-xl font-extrabold">{t.payment.successTitle}</h1>
          <p className="mt-1 text-ink-soft">{t.payment.successText}</p>
        </>
      ) : status === 'annule' ? (
        <>
          <XCircle className="mx-auto size-14 text-ink-faint" aria-hidden />
          <h1 className="mt-3 text-xl font-extrabold">{t.payment.cancelledTitle}</h1>
          <p className="mt-1 text-ink-soft">{t.payment.cancelledText}</p>
        </>
      ) : status === 'echoue' ? (
        <>
          <XCircle className="mx-auto size-14 text-danger" aria-hidden />
          <h1 className="mt-3 text-xl font-extrabold">{t.payment.failedTitle}</h1>
          <p className="mt-1 text-ink-soft">{t.payment.failedText}</p>
        </>
      ) : (
        <>
          <Clock className="mx-auto size-14 animate-pulse text-brand-ink" aria-hidden />
          <h1 className="mt-3 text-xl font-extrabold">{t.payment.returnTitle}</h1>
          <p className="mt-1 text-ink-soft">{t.payment.waiting}</p>
        </>
      )}
      {payment && (
        <p className="tabular mt-4 text-sm text-ink-soft">
          {t.payment.methods[payment.method]} · {formatMGA(payment.amount_mga)}
          {payment.card_last4 && ` · ${payment.card_brand?.toUpperCase()} •••• ${payment.card_last4}`}
        </p>
      )}
      <Link href={back.href} className="btn-primary mt-6">{back.label}</Link>
    </div>
  );
}
