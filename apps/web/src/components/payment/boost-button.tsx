'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Rocket } from 'lucide-react';
import { useDict } from '@/i18n/client';
import { bff } from '@/lib/bff';
import { formatMGA } from '@/lib/format';
import { PaymentDialog, type StartedPayment } from './payment-dialog';

export interface SponsorshipPlan { code: string; duration_days: number; price_mga: number }

/** « Booster » une annonce : choix de l'offre puis paiement (Mobile Money, carte ou PayPal). */
export function BoostButton({ adId, plans, phone }: { adId: number; plans: SponsorshipPlan[]; phone: string | null }) {
  const t = useDict();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(plans[1]?.code ?? plans[0]?.code);
  const plan = plans.find((p) => p.code === code)!;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary h-9 px-3 text-sm">
        <Rocket className="size-4" aria-hidden /> {t.account.boost}
      </button>
      <PaymentDialog
        open={open}
        onClose={() => setOpen(false)}
        title={t.payment.boostTitle}
        amountMga={plan.price_mga}
        defaultPhone={phone}
        start={async (payload) => {
          const r = await bff<{ payment: StartedPayment }>(`/payments/sponsor/${adId}`, { method: 'POST', json: { plan_code: code, ...payload } });
          return r.payment;
        }}
        onSuccess={() => router.refresh()}
      >
        <fieldset>
          <legend className="label">{t.payment.boostTitle}</legend>
          <div className="space-y-2">
            {plans.map((p) => (
              <label key={p.code} className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 ${code === p.code ? 'border-brand bg-brand-tint' : 'border-line'}`}>
                <input type="radio" name="plan" checked={code === p.code} onChange={() => setCode(p.code)} className="mt-1 size-4" />
                <span className="flex-1">
                  <span className="flex justify-between gap-2 font-bold">
                    {t.payment.sponsorship[p.code]?.label ?? p.code}
                    <span className="tabular text-brand-ink">{formatMGA(p.price_mga)}</span>
                  </span>
                  <span className="mt-0.5 block text-sm text-ink-soft">{t.payment.sponsorship[p.code]?.text}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </PaymentDialog>
    </>
  );
}
