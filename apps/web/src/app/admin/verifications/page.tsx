import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDict } from '@/i18n/server';
import { apiAuth, requireUser } from '@/lib/session';
import { ReviewQueue, type PendingVerification } from './review-queue';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).verify.adminTitle };
}

/** Back-office : file des vérifications d'identité à traiter (administrateurs uniquement). */
export default async function AdminVerificationsPage() {
  const user = await requireUser('/admin/verifications');
  if (user.role !== 'admin') notFound();
  const [t, queue] = await Promise.all([getDict(), apiAuth<PendingVerification[]>('/admin/verifications?status=en_attente')]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight">{t.verify.adminTitle}</h1>
      <ReviewQueue initial={queue} />
    </div>
  );
}
