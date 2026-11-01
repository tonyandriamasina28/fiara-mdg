import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { fmt } from '@/i18n';
import { getDict } from '@/i18n/server';
import { api, ApiError, type Province } from '@/lib/api';
import { apiAuth, requireUser } from '@/lib/session';
import { EditAdForm, type EditableAd } from './edit-ad-form';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).manage.editTitle };
}

/** Modification d'une annonce par son vendeur (ou l'équipe du professionnel). */
export default async function EditAdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser(`/compte/annonces/${id}`);
  let ad: EditableAd;
  try {
    ad = await apiAuth<EditableAd>(`/ads/${Number(id)}/edit`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const [t, provinces] = await Promise.all([getDict(), api<Province[]>('/reference/locations', { revalidate: 3600 })]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link href="/compte#annonces" className="inline-flex items-center gap-1 text-sm font-bold text-brand-ink hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> {t.manage.back}
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight">{t.manage.editTitle}</h1>
      <p className="mt-1 text-ink-soft">{fmt(t.manage.status, { status: t.labels.adStatus[ad.status] ?? ad.status })}</p>
      <EditAdForm ad={ad} provinces={provinces} />
    </div>
  );
}
