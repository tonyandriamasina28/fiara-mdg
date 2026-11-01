'use client';

import { useState } from 'react';
import { Heart, Send } from 'lucide-react';
import { fmt, intlLocale } from '@/i18n';
import { useDict, useLocale } from '@/i18n/client';
import { bff } from '@/lib/bff';
import { formatMGA } from '@/lib/format';
import { PanelState, useProData } from './use-pro-data';

interface Offers {
  quota: number | null;
  used_this_month: number;
  offers: { id: number; ad_title: string; original_price_mga: number; offer_price_mga: number; expires_at: string; recipients: number }[];
  ads_with_favorites: { id: number; title: string; price_mga: number; favorites: number; reachable: number }[];
}

/** Offre directe : remise limitée dans le temps envoyée aux utilisateurs ayant mis l'annonce en favori. */
export function OffersPanel() {
  const t = useDict();
  const o = t.pro.offers;
  const locale = useLocale();
  const { data, error, loading, reload } = useProData<Offers>('/pro/offers');
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<{ ok?: string; error?: string }>({});
  const quotaReached = data?.quota != null && data.used_this_month >= data.quota;

  return (
    <PanelState loading={loading} error={error}>
      {data && (
        <div className="space-y-5">
          <p className="max-w-[70ch] text-ink-soft">{o.intro}</p>
          <p className="tabular text-sm font-bold">
            {data.quota == null ? fmt(o.quotaUnlimited, { used: data.used_this_month }) : fmt(o.quota, { used: data.used_this_month, quota: data.quota })}
          </p>
          {result.ok && <p role="status" className="rounded-lg bg-ok-tint px-4 py-2.5 text-sm font-semibold text-ok">{result.ok}</p>}

          {data.ads_with_favorites.length === 0 ? (
            <p className="card p-6 text-ink-soft">{o.none}</p>
          ) : (
            <ul className="space-y-2">
              {data.ads_with_favorites.map((ad) => (
                <li key={ad.id} className="card">
                  <div className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{ad.title}</p>
                      <p className="tabular text-sm text-ink-soft">{formatMGA(ad.price_mga)}</p>
                    </div>
                    <span className="tabular flex items-center gap-1 text-sm font-semibold text-action-ink">
                      <Heart className="size-4" fill="currentColor" aria-hidden /> {fmt(o.favorites, { n: ad.favorites })} · {fmt(o.reachable, { n: ad.reachable })}
                    </span>
                    <button type="button" className="btn-primary h-9 px-3 text-sm" disabled={!ad.reachable || quotaReached} onClick={() => { setSelected(selected === ad.id ? null : ad.id); setResult({}); }}>
                      <Send className="size-4" aria-hidden /> {o.send}
                    </button>
                  </div>
                  {selected === ad.id && (
                    <form
                      className="grid gap-3 border-t border-line p-4 sm:grid-cols-[1fr_8rem] sm:items-end"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        try {
                          const r = await bff<{ recipients: number }>('/pro/offers', {
                            method: 'POST',
                            json: { ad_id: ad.id, offer_price_mga: Number(fd.get('price')), valid_days: Number(fd.get('days')), message: fd.get('message') || undefined },
                          });
                          setResult({ ok: fmt(o.sent, { n: r.recipients }) });
                          setSelected(null);
                          reload();
                        } catch (err) {
                          setResult({ error: (err as Error).message });
                        }
                      }}
                    >
                      <div>
                        <label htmlFor={`offer-price-${ad.id}`} className="label">{o.offerPrice}</label>
                        <input id={`offer-price-${ad.id}`} name="price" type="number" required min={100000} step={100000} max={ad.price_mga - 100000} defaultValue={Math.round((ad.price_mga * 0.96) / 100000) * 100000} className="field tabular" />
                      </div>
                      <div>
                        <label htmlFor={`offer-days-${ad.id}`} className="label">{o.validDays}</label>
                        <input id={`offer-days-${ad.id}`} name="days" type="number" min={1} max={14} defaultValue={3} className="field tabular" />
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor={`offer-msg-${ad.id}`} className="label">{o.message}</label>
                        <input id={`offer-msg-${ad.id}`} name="message" maxLength={1000} className="field" />
                      </div>
                      {result.error && <p role="alert" className="text-sm text-danger sm:col-span-2">{result.error}</p>}
                      <button type="submit" className="btn-primary sm:col-span-2 sm:justify-self-end">{o.send}</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}

          {data.offers.length > 0 && (
            <section aria-labelledby="offers-history">
              <h3 id="offers-history" className="mb-2 font-bold">{o.history}</h3>
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface text-sm">
                {data.offers.map((of) => (
                  <li key={of.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <span className="min-w-0 flex-1 truncate font-semibold">{of.ad_title}</span>
                    <span className="tabular"><s className="text-ink-faint">{formatMGA(of.original_price_mga)}</s> → <b className="text-action-ink">{formatMGA(of.offer_price_mga)}</b></span>
                    <span className="text-ink-soft">{fmt(o.recipients, { n: of.recipients })} · {new Date(of.expires_at).toLocaleDateString(intlLocale(locale))}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </PanelState>
  );
}
