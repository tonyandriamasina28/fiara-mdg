'use client';

import Link from 'next/link';
import { fmt } from '@/i18n';
import { useDict } from '@/i18n/client';
import { formatMGA } from '@/lib/format';
import { DailyBars } from './daily-bars';
import { PanelState, useProData } from './use-pro-data';

interface Analytics {
  access: 'limite' | 'complet';
  ads: { id: number; title: string; price_mga: number; status: string; days_in_stock: number; views: number; views_7d: number; phone_reveals: number; messages: number; favorites: number; contact_rate: number }[];
  daily?: { day: string; views: number; contacts: number }[];
  benchmark?: { avg_views: number };
}

export function DemandPanel() {
  const t = useDict();
  const a = t.pro.analytics;
  const { data, error, loading } = useProData<Analytics>('/pro/analytics');

  return (
    <PanelState loading={loading} error={error}>
      {data && (
        <div className="space-y-5">
          {data.daily && (
            <div className="grid gap-4 xl:grid-cols-2">
              <DailyBars title={a.legendViews} valueLabel={a.legendViews.toLowerCase()} color="var(--color-chart-1)" data={data.daily.map((d) => ({ day: d.day, value: d.views }))} />
              <DailyBars title={a.legendContacts} valueLabel={a.legendContacts.toLowerCase()} color="var(--color-chart-2)" data={data.daily.map((d) => ({ day: d.day, value: d.contacts }))} />
            </div>
          )}
          {data.benchmark && <p className="text-sm text-ink-soft">{fmt(a.benchmark, { n: data.benchmark.avg_views })}</p>}

          {data.ads.length === 0 ? (
            <p className="card p-6 text-ink-soft">{a.empty}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="w-full min-w-[46rem] text-sm">
                <thead className="border-b border-line bg-paper text-left">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-bold">{a.ad}</th>
                    <th scope="col" className="px-3 py-3 text-right font-bold">{a.views}</th>
                    {data.access === 'complet' && <th scope="col" className="px-3 py-3 text-right font-bold">{a.views7d}</th>}
                    <th scope="col" className="px-3 py-3 text-right font-bold">{a.contacts}</th>
                    <th scope="col" className="px-3 py-3 text-right font-bold">{a.favorites}</th>
                    <th scope="col" className="px-3 py-3 text-right font-bold">{a.contactRate}</th>
                    <th scope="col" className="px-4 py-3 text-right font-bold">{a.daysInStock}</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {data.ads.map((ad) => (
                    <tr key={ad.id} className="border-b border-line last:border-0">
                      <td className="max-w-72 px-4 py-3">
                        <Link href={`/annonces/${ad.id}`} className="block truncate font-semibold hover:text-brand-ink">{ad.title}</Link>
                        <span className="text-xs text-ink-faint">{formatMGA(ad.price_mga)}</span>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold">{ad.views}</td>
                      {data.access === 'complet' && <td className="px-3 py-3 text-right">{ad.views_7d}</td>}
                      <td className="px-3 py-3 text-right">{ad.phone_reveals + ad.messages}</td>
                      <td className="px-3 py-3 text-right">{ad.favorites}</td>
                      <td className="px-3 py-3 text-right">{ad.contact_rate.toLocaleString('fr-FR')} %</td>
                      <td className={`px-4 py-3 text-right ${ad.days_in_stock > 45 ? 'font-bold text-danger' : ''}`}>{fmt(a.days, { n: ad.days_in_stock })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </PanelState>
  );
}
