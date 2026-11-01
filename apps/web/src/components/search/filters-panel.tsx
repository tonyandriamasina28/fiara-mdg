'use client';

import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Brand, Province } from '@/lib/api';
import { useDict } from '@/i18n/client';
import { CATEGORIES, CUSTOMS, FUELS, GEARBOXES, KM_STEPS, ORIGINS, PRICE_STEPS, formatKm, formatMGA, yearSteps } from '@/lib/format';
import { useModels } from './use-models';

/** Panneau de filtres de la page de résultats : chaque changement met à jour l'URL. */
export function FiltersPanel({ brands, provinces }: { brands: Brand[]; provinces: Province[] }) {
  const t = useDict();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const { models } = useModels(params.get('brand_id') ?? '');

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete('page');
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  const list = (key: string) => (params.get(key) ?? '').split(',').filter(Boolean);
  const toggle = (key: string, value: string) => {
    const current = list(key);
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    update({ [key]: next.join(',') || null });
  };

  const select = (key: string, extra?: Record<string, null>) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    update({ [key]: e.target.value || null, ...extra });

  const checkboxGroup = (key: string, title: string, values: readonly string[], labels: Record<string, string>) => (
    <fieldset className="border-t border-line pt-4">
      <legend className="mb-2 text-sm font-bold text-ink">{title}</legend>
      <div className="space-y-1">
        {values.map((value) => (
          <label key={value} className="flex cursor-pointer items-center gap-2.5 rounded px-1 py-1 text-sm text-ink-soft hover:bg-paper hover:text-ink">
            <input type="checkbox" className="size-4" checked={list(key).includes(value)} onChange={() => toggle(key, value)} />
            {labels[value]}
          </label>
        ))}
      </div>
    </fieldset>
  );

  const small = 'field tabular px-2 text-sm';

  return (
    <aside aria-label={t.filters.title} className={`space-y-4 transition-opacity ${pending ? 'opacity-60' : ''}`}>
      <div>
        <label htmlFor="f-brand" className="label">{t.search.brand}</label>
        <select id="f-brand" className="field" value={params.get('brand_id') ?? ''} onChange={select('brand_id', { model_id: null })}>
          <option value="">{t.search.allF}</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}{b.ad_count ? ` (${b.ad_count})` : ''}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="f-model" className="label">{t.search.model}</label>
        <select id="f-model" className="field" value={params.get('model_id') ?? ''} onChange={select('model_id')} disabled={!params.get('brand_id')}>
          <option value="">{t.search.allM}</option>
          {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="f-pmin" className="label">{t.filters.priceFrom}</label>
          <select id="f-pmin" className={small} value={params.get('price_min') ?? ''} onChange={select('price_min')}>
            <option value="">{t.filters.min}</option>
            {PRICE_STEPS.map((p) => <option key={p} value={p}>{formatMGA(p)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-pmax" className="label">{t.filters.to}</label>
          <select id="f-pmax" className={small} value={params.get('price_max') ?? ''} onChange={select('price_max')}>
            <option value="">{t.filters.max}</option>
            {PRICE_STEPS.map((p) => <option key={p} value={p}>{formatMGA(p)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-ymin" className="label">{t.filters.yearFromShort}</label>
          <select id="f-ymin" className={small} value={params.get('year_min') ?? ''} onChange={select('year_min')}>
            <option value="">{t.filters.min}</option>
            {yearSteps().map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-ymax" className="label">{t.filters.to}</label>
          <select id="f-ymax" className={small} value={params.get('year_max') ?? ''} onChange={select('year_max')}>
            <option value="">{t.filters.max}</option>
            {yearSteps().map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="f-km" className="label">{t.search.kmUpTo}</label>
        <select id="f-km" className="field tabular" value={params.get('km_max') ?? ''} onChange={select('km_max')}>
          <option value="">{t.search.any}</option>
          {KM_STEPS.map((k) => <option key={k} value={k}>{formatKm(k)}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="f-prov" className="label">{t.filters.province}</label>
        <select id="f-prov" className="field" value={params.get('province_id') ?? ''} onChange={select('province_id', { city_id: null })}>
          <option value="">{t.search.allMadagascar}</option>
          {provinces.map((p) => (
            <option key={p.id} value={p.id}>{p.name}{p.common_name ? ` (${p.common_name})` : ''}</option>
          ))}
        </select>
      </div>

      {checkboxGroup('customs', t.search.customs, CUSTOMS, t.labels.customs)}
      {checkboxGroup('origin', t.search.origin, ORIGINS, t.labels.origin)}
      {checkboxGroup('category', t.filters.category, CATEGORIES, t.labels.category)}
      {checkboxGroup('fuel', t.filters.fuel, FUELS, t.labels.fuel)}
      {checkboxGroup('gearbox', t.filters.gearbox, GEARBOXES, t.labels.gearbox)}

      <fieldset className="border-t border-line pt-4">
        <legend className="mb-2 text-sm font-bold text-ink">{t.filters.seller}</legend>
        {[['', t.search.allM], ['particulier', t.filters.sellerPrivate], ['professionnel', t.filters.sellerPro]].map(([value, text]) => (
          <label key={value} className="flex cursor-pointer items-center gap-2.5 rounded px-1 py-1 text-sm text-ink-soft hover:bg-paper hover:text-ink">
            <input
              type="radio"
              name="seller_type"
              className="size-4"
              checked={(params.get('seller_type') ?? '') === value}
              onChange={() => update({ seller_type: value || null })}
            />
            {text}
          </label>
        ))}
      </fieldset>
    </aside>
  );
}
