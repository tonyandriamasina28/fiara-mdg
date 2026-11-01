'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, BellRing, History, Search, X } from 'lucide-react';
import { fmt, intlLocale, type Dict } from '@/i18n';
import { useDict, useLocale } from '@/i18n/client';
import { bff } from '@/lib/bff';
import { formatKm, formatMGA } from '@/lib/format';

export interface RecentSearch {
  id: number;
  query_string: string;
  criteria: Record<string, string>;
  result_count: number;
  run_count: number;
  last_run_at: string;
  alert: boolean;
  labels: { brand?: string; model?: string; province?: string; city?: string };
}

/** Résumé lisible d'une recherche : « Toyota Hilux · Dédouané · jusqu’à 150 000 000 Ar · Antananarivo » */
export function describeSearch(s: RecentSearch, t: Dict) {
  const c = s.criteria;
  const list = (key: string, labels: Record<string, string>) => c[key]?.split(',').map((v) => labels[v] ?? v).join(', ');
  const parts = [
    [s.labels.brand, s.labels.model].filter(Boolean).join(' '),
    list('category', t.labels.category),
    list('fuel', t.labels.fuel),
    list('gearbox', t.labels.gearbox),
    list('customs', t.labels.customs),
    list('origin', t.labels.origin),
    c.price_min && fmt(t.profile.priceMin, { v: formatMGA(Number(c.price_min)) }),
    c.price_max && fmt(t.profile.priceMax, { v: formatMGA(Number(c.price_max)) }),
    c.year_min && fmt(t.profile.yearMin, { v: c.year_min }),
    c.year_max && fmt(t.profile.yearMax, { v: c.year_max }),
    c.km_max && fmt(t.profile.kmMax, { v: formatKm(Number(c.km_max)) }),
    s.labels.city ?? s.labels.province,
    c.seller_type && (c.seller_type === 'professionnel' ? t.profile.pros : t.profile.privates),
    c.q && `« ${c.q} »`,
  ].filter(Boolean) as string[];
  return parts.length ? parts.join(' · ') : t.profile.allVehicles;
}

export function RecentSearches({ initial }: { initial: RecentSearch[] }) {
  const t = useDict();
  const locale = useLocale();
  const [items, setItems] = useState(initial);
  const when = (iso: string) => new Date(iso).toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'short' });

  const remove = async (id: number) => {
    setItems((prev) => prev.filter((s) => s.id !== id));
    await bff(`/me/searches/${id}`, { method: 'DELETE' }).catch(() => {});
  };
  const toggleAlert = async (s: RecentSearch) => {
    setItems((prev) => prev.map((x) => (x.id === s.id ? { ...x, alert: !s.alert } : x)));
    await bff(`/me/searches/${s.id}/alert`, { method: 'PUT', json: { enabled: !s.alert } }).catch(() => {});
  };

  if (items.length === 0) {
    return (
      <div className="card flex items-center gap-4 p-5 text-ink-soft">
        <History className="size-8 shrink-0 text-line-strong" strokeWidth={1.5} aria-hidden />
        <p>{t.profile.noSearches}</p>
      </div>
    );
  }

  return (
    <div>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {items.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-3">
            <Search className="size-4 shrink-0 text-ink-faint" aria-hidden />
            <Link href={`/recherche?${s.query_string}`} className="min-w-0 flex-1 rounded-sm">
              <p className="truncate font-semibold hover:text-brand-ink">{describeSearch(s, t)}</p>
              <p className="tabular text-xs text-ink-faint">
                {when(s.last_run_at)} · {fmt(t.profile.results, { n: s.result_count })} · {fmt(t.profile.runs, { n: s.run_count })}
              </p>
            </Link>
            <button
              type="button"
              onClick={() => toggleAlert(s)}
              aria-pressed={s.alert}
              title={s.alert ? t.profile.alertOn : t.profile.alertOff}
              aria-label={s.alert ? t.profile.alertOn : t.profile.alertOff}
              className={`grid size-9 shrink-0 place-items-center rounded-md transition-colors ${s.alert ? 'bg-action-tint text-action-ink' : 'text-ink-faint hover:bg-paper hover:text-ink'}`}
            >
              {s.alert ? <BellRing className="size-4" aria-hidden /> : <Bell className="size-4" aria-hidden />}
            </button>
            <button type="button" onClick={() => remove(s.id)} aria-label={t.profile.remove} title={t.profile.remove} className="grid size-9 shrink-0 place-items-center rounded-md text-ink-faint hover:bg-paper hover:text-danger">
              <X className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="mt-2 text-sm font-semibold text-ink-soft hover:text-danger hover:underline"
        onClick={async () => {
          setItems([]);
          await bff('/me/searches', { method: 'DELETE' }).catch(() => {});
        }}
      >
        {t.profile.clearAll}
      </button>
    </div>
  );
}
