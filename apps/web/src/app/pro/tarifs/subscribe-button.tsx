'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PaymentDialog, type StartedPayment } from '@/components/payment/payment-dialog';
import { fmt } from '@/i18n';
import { useDict } from '@/i18n/client';
import { bff } from '@/lib/bff';

interface Props {
  plan: { code: string; name: string; price_mga: number };
  state: 'ok' | 'login' | 'not_pro' | 'not_owner';
  phone: string | null;
  primary?: boolean;
}

export function SubscribeButton({ plan, state, phone, primary }: Props) {
  const t = useDict();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const cls = `${primary ? 'btn-primary' : 'btn-secondary'} w-full`;
  const label = fmt(t.pricing.subscribe, { plan: plan.name });

  if (state === 'login') {
    return (
      <Link href="/connexion?mode=inscription&suite=/pro/tarifs" className={cls} title={t.pricing.loginRequired}>{label}</Link>
    );
  }
  if (state !== 'ok') {
    return <p className="text-center text-sm text-ink-soft">{t.pricing.proOnly}</p>;
  }

  return (
    <>
      <button type="button" className={cls} onClick={() => setOpen(true)}>{label}</button>
      <PaymentDialog
        open={open}
        onClose={() => setOpen(false)}
        title={fmt(t.payment.subscriptionTitle, { plan: plan.name })}
        amountMga={plan.price_mga}
        defaultPhone={phone}
        start={async (payload) => {
          const r = await bff<{ payment: StartedPayment }>('/pro/subscribe', { method: 'POST', json: { plan_code: plan.code, ...payload } });
          return r.payment;
        }}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
