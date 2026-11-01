import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { SearchX } from 'lucide-react';
import { AdCard } from '@/components/ad-card';
import { FiltersPanel } from '@/components/search/filters-panel';
import { SortSelect } from '@/components/search/sort-select';
import { fmt } from '@/i18n';
import { getDict } from '@/i18n/server';
import { api, toQuery, type Brand, type Province, type SearchResult } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { apiAuth } from '@/lib/session';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).results.metaTitle };
}

type SearchParams = Record<string, string | string[] | undefined>;

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = toQuery(params);

  const [t, result, brands, provinces] = await Promise.all([
    getDict(),
    apiAuth<SearchResult>(`/ads?${query}`),
    api<Brand[]>('/reference/brands', { revalidate: 300 }),
    api<Province[]>('/reference/locations', { revalidate: 3600 }),
  ]);

  const pages = Math.max(1, Math.ceil(result.total / result.per_page));
  const pageHref = (page: number) => {
    const q = new URLSearchParams(query);
    q.set('page', String(page));
    return `/recherche?${q.toString()}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[17rem_1fr]">
        <details className="group lg:hidden">
          <summary className="flex h-11 list-none items-center justify-center rounded-lg border border-line-strong bg-surface font-semibold">
            {t.filters.title}
          </summary>
          <div className="card mt-4 p-4">
            <Suspense><FiltersPanel brands={brands} provinces={provinces} /></Suspense>
          </div>
        </details>
        <div className="hidden lg:block">
          <Suspense><FiltersPanel brands={brands} provinces={provinces} /></Suspense>
        </div>

        <section aria-labelledby="results-title" className="min-w-0">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <h1 id="results-title" className="text-2xl font-extrabold tracking-tight text-balance">
              {fmt(result.total > 1 ? t.results.countOther : t.results.countOne, { n: formatNumber(result.total) })}
            </h1>
            <Suspense><SortSelect /></Suspense>
          </div>

          {result.items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
              <SearchX className="mx-auto size-10 text-ink-faint" strokeWidth={1.5} aria-hidden />
              <h2 className="mt-4 text-lg font-bold">{t.results.emptyTitle}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">{t.results.emptyText}</p>
              <Link href="/recherche" className="mt-5 inline-block font-semibold text-brand-ink hover:underline">
                {t.results.clear}
              </Link>
            </div>
          ) : (
            <ol className="space-y-3">
              {result.items.map((ad) => (
                <li key={ad.id}><AdCard ad={ad} t={t} /></li>
              ))}
            </ol>
          )}

          {pages > 1 && (
            <nav aria-label={t.results.pagination} className="mt-8 flex items-center justify-center gap-1">
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={pageHref(p)}
                  aria-current={p === result.page ? 'page' : undefined}
                  className={`tabular grid size-10 place-items-center rounded-md text-sm font-semibold ${
                    p === result.page ? 'bg-brand text-white' : 'text-ink-soft hover:bg-surface'
                  }`}
                >
                  {p}
                </Link>
              ))}
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
