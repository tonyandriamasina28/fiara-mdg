'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { fmt } from '@/i18n';
import { useDict } from '@/i18n/client';
import { formatKm, formatMGA } from '@/lib/format';
import { PanelState, useProData } from './use-pro-data';

interface Market {
  access: 'limite' | 'complet';
  ad: { id: number; title: string; price_mga: number };
  stats: { count: number; min: number | null; median: number | null; max: number | null };
  position: string;
  comparables?: { id: number; title: string; price_mga: number; year: number; mileage_km: number; city: string }[];
  ai_estimate?: { value_mga: number; low_mga: number; high_mga: number; confidence: string } | null;
}

const POSITION_TONE: Record<string, string> = {
  attractif: 'bg-ok-tint text-ok',
  dans_le_marche: 'bg-brand-tint text-brand-ink',
  eleve: 'bg-warn-tint text-warn',
  inconnu: 'bg-paper text-ink-soft',
};

export function MarketPanel() {
  const t = useDict();
  const m = t.pro.market;
  const { data: stock } = useProData<{ ads: { id: number; title: string }[] }>('/pro/analytics');
  const [adId, setAdId] = useState<number | null>(null);
  useEffect(() => {
    if (!adId && stock?.ads[0]) setAdId(stock.ads[0].id);
  }, [stock, adId]);
  const { data, error, loading } = useProData<Market>(adId ? `/pro/market/${adId}` : null);

  // Position du prix de l'annonce sur l'échelle min–max des comparables
  const span = data?.stats.min != null && data.stats.max != null ? Math.max(1, data.stats.max - data.stats.min) : null;
  const pct = (v: number) => (span == null ? 50 : Math.min(100, Math.max(0, ((v - data!.stats.min!) / span) * 100)));

  return (
    <div className="space-y-5">
      <div className="max-w-md">
        <label htmlFor="market-ad" className="label">{m.pick}</label>
        <select id="market-ad" className="field" value={adId ?? ''} onChange={(e) => setAdId(Number(e.target.value))}>
          {stock?.ads.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
        </select>
      </div>

      <PanelState loading={loading} error={error}>
        {data && (
          <>
            <div className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-soft">{fmt(m.count, { n: data.stats.count })}</p>
                <span className={`rounded-full px-3 py-1 text-sm font-bold ${POSITION_TONE[data.position]}`}>{m.position[data.position]}</span>
              </div>
              <dl className="tabular mt-4 grid gap-4 sm:grid-cols-4">
                {[
                  [m.yourPrice, data.ad.price_mga, true],
                  [m.min, data.stats.min],
                  [m.median, data.stats.median],
                  [m.max, data.stats.max],
                ].map(([label, value, strong]) => (
                  <div key={String(label)}>
                    <dt className="text-xs font-semibold text-ink-soft">{label}</dt>
                    <dd className={`mt-0.5 text-lg font-extrabold ${strong ? 'text-action-ink' : 'text-ink'}`}>{value != null ? formatMGA(Number(value)) : '—'}</dd>
                  </div>
                ))}
              </dl>
              {span != null && data.stats.median != null && (
                <div className="relative mt-6 h-2 rounded-full bg-brand-tint" aria-hidden>
                  <span className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-brand" style={{ left: `${pct(data.stats.median)}%` }} />
                  <span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-action-ink" style={{ left: `${pct(data.ad.price_mga)}%` }} />
                </div>
              )}
            </div>

            {data.access === 'limite' && <p className="text-sm text-ink-soft">{m.limitedHint}</p>}

            {data.ai_estimate && (
              <div className="rounded-xl border-2 border-dashed border-brand/40 bg-brand-tint/50 p-5">
                <h3 className="flex items-center gap-2 font-extrabold text-brand-ink"><Sparkles className="size-5" aria-hidden /> {m.aiTitle}</h3>
                <p className="tabular mt-2 text-2xl font-extrabold">{formatMGA(data.ai_estimate.value_mga)}</p>
                <p className="tabular text-sm text-ink-soft">
                  {fmt(m.range, { low: formatMGA(data.ai_estimate.low_mga), high: formatMGA(data.ai_estimate.high_mga) })} ·{' '}
                  {fmt(m.confidence, { level: m.levels[data.ai_estimate.confidence] ?? data.ai_estimate.confidence })}
                </p>
                <p className="mt-2 text-xs text-ink-soft">{m.aiText}</p>
              </div>
            )}

            {data.comparables && data.comparables.length > 0 && (
              <section aria-labelledby="comparables-title">
                <h3 id="comparables-title" className="mb-2 font-bold">{m.comparables}</h3>
                <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                  {data.comparables.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                      <Link href={`/annonces/${c.id}`} className="min-w-0 flex-1 truncate font-semibold hover:text-brand-ink">{c.title}</Link>
                      <span className="tabular text-ink-soft">{c.year} · {formatKm(c.mileage_km)} · {c.city}</span>
                      <span className="tabular w-36 text-right font-extrabold">{formatMGA(c.price_mga)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </PanelState>
    </div>
  );
}
