import Link from 'next/link';
import { getDict } from '@/i18n/server';

export default async function NotFound() {
  const t = await getDict();
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-2xl font-extrabold">{t.ad.notFoundTitle}</h1>
      <p className="mt-3 text-ink-soft">{t.ad.notFoundText}</p>
      <Link href="/recherche" className="btn-primary mt-6">{t.ad.notFoundCta}</Link>
    </div>
  );
}
