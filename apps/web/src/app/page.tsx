import Link from 'next/link';
import { ArrowRight, BarChart3, Users } from 'lucide-react';
import { AdCard } from '@/components/ad-card';
import { SearchEngine } from '@/components/search/search-engine';
import { getDict } from '@/i18n/server';
import { api, type Brand, type Province, type SearchResult } from '@/lib/api';

export default async function HomePage() {
  const [t, brands, provinces, latest] = await Promise.all([
    getDict(),
    api<Brand[]>('/reference/brands', { revalidate: 300 }),
    api<Province[]>('/reference/locations', { revalidate: 3600 }),
    api<SearchResult>('/ads?sort=pertinence&per_page=6'),
  ]);

  const quickLinks = [
    { label: t.home.quick.suv, href: '/recherche?category=suv_4x4' },
    { label: t.home.quick.pickup, href: '/recherche?category=pickup' },
    { label: t.home.quick.city, href: '/recherche?category=voiture&price_max=40000000' },
    { label: t.home.quick.utility, href: '/recherche?category=utilitaire,bus,camion' },
    { label: t.home.quick.moto, href: '/recherche?category=moto' },
    { label: t.home.quick.cleared, href: '/recherche?customs=dedouane' },
    { label: t.home.quick.local, href: '/recherche?origin=occasion_madagascar' },
  ];

  return (
    <>
      <section className="bg-brand pb-28 pt-10 text-white sm:pt-14 dark:border-b dark:border-line dark:bg-surface">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h1 className="max-w-3xl text-3xl font-extrabold leading-[1.1] tracking-[-0.02em] text-balance sm:text-5xl">{t.home.title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">{t.home.subtitle}</p>
        </div>
      </section>

      <div className="mx-auto -mt-20 max-w-7xl px-4 sm:px-6">
        <SearchEngine brands={brands} provinces={provinces} initialCount={latest.total} />

        <nav aria-label={t.home.quickAria} className="mt-5 flex flex-wrap gap-2">
          {quickLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full border border-line-strong bg-surface px-3.5 py-1.5 text-sm font-semibold text-ink-soft transition-colors hover:border-brand hover:text-brand-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>

      <section aria-labelledby="latest-title" className="mx-auto mt-16 max-w-7xl px-4 sm:px-6">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 id="latest-title" className="text-2xl font-extrabold tracking-tight">{t.home.latest}</h2>
          <Link href="/recherche?sort=recent" className="flex items-center gap-1 text-sm font-bold text-brand-ink hover:underline">
            {t.common.seeAll} <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <ol className="grid gap-3 xl:grid-cols-2">
          {latest.items.map((ad) => (
            <li key={ad.id}><AdCard ad={ad} t={t} /></li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="pro-title" className="mx-auto mt-16 max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-6 overflow-hidden rounded-xl bg-brand-deep p-6 text-white sm:p-10 lg:grid-cols-[1fr_auto]">
          <div>
            <h2 id="pro-title" className="text-2xl font-extrabold tracking-tight text-balance">{t.home.proTitle}</h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-white/80">{t.home.proText}</p>
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-white/90">
              <li className="flex items-center gap-2"><BarChart3 className="size-4 text-action" aria-hidden /> {t.tools.analyse_demande.name}</li>
              <li className="flex items-center gap-2"><Users className="size-4 text-action" aria-hidden /> {t.tools.lead_manager.name}</li>
            </ul>
          </div>
          <Link href="/pro/tarifs" className="btn-primary h-12 px-6">{t.home.proCta}</Link>
        </div>
      </section>

      <section aria-labelledby="brands-title" className="mx-auto mt-16 max-w-7xl px-4 sm:px-6">
        <h2 id="brands-title" className="mb-5 text-2xl font-extrabold tracking-tight">{t.home.byBrand}</h2>
        <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
          {brands.slice(0, 15).map((b) => (
            <li key={b.id}>
              <Link href={`/recherche?brand_id=${b.id}`} className="flex h-full items-center justify-between gap-2 bg-surface px-4 py-3.5 text-sm font-semibold hover:bg-brand-tint hover:text-brand-ink">
                {b.name}
                <span className="tabular text-xs font-medium text-ink-faint">{b.ad_count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="regions-title" className="mx-auto mt-16 max-w-7xl px-4 sm:px-6">
        <h2 id="regions-title" className="mb-5 text-2xl font-extrabold tracking-tight">{t.home.byProvince}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {provinces.map((p) => (
            <li key={p.id} className="card p-4">
              <Link href={`/recherche?province_id=${p.id}`} className="font-bold hover:text-brand-ink hover:underline">
                {p.name}{p.common_name && <span className="font-medium text-ink-faint"> · {p.common_name}</span>}
              </Link>
              <p className="mt-1.5 text-sm text-ink-soft">{p.cities.map((c) => c.name).join(', ')}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
