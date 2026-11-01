import type { Metadata } from 'next';
import { getDict } from '@/i18n/server';
import { requireUser } from '@/lib/session';
import { PaymentReturn } from './payment-return';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).payment.returnTitle };
}

/** Page de retour de Stripe Checkout et de PayPal (success_url / cancel_url, return_url / cancel_url). */
export default async function PaymentReturnPage({ searchParams }: { searchParams: Promise<{ paiement?: string; etat?: string }> }) {
  const { paiement, etat } = await searchParams;
  await requireUser(`/paiement/retour?paiement=${paiement ?? ''}&etat=${etat ?? ''}`);
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <PaymentReturn paymentId={Number(paiement)} cancelled={etat === 'annule'} />
    </div>
  );
}
