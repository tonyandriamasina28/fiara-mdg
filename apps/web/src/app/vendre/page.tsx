import type { Metadata } from 'next';
import { getDict } from '@/i18n/server';
import { api, type Brand, type Province } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { AdForm, type Equipment } from './ad-form';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).sell.title };
}

export default async function SellPage() {
  const user = await requireUser('/vendre');
  const [t, brands, provinces, equipment] = await Promise.all([
    getDict(),
    api<Brand[]>('/reference/brands', { revalidate: 300 }),
    api<Province[]>('/reference/locations', { revalidate: 3600 }),
    api<Equipment[]>('/reference/equipment', { revalidate: 3600 }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight">{t.sell.title}</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">{t.sell.subtitle}</p>
      <AdForm brands={brands} provinces={provinces} equipment={equipment} hasPhone={Boolean(user.phone)} />
    </div>
  );
}
