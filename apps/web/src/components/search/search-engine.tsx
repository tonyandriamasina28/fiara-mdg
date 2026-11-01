'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import type { Brand, Province } from '@/lib/api';
import { fmt } from '@/i18n';
import { useDict } from '@/i18n/client';
import { CUSTOMS, KM_STEPS, ORIGINS, PRICE_STEPS, formatKm, formatMGA, yearSteps } from '@/lib/format';
import { NumberTicker } from '@/components/ui/number-ticker';
import { useBrands, useLiveCount, useModels } from './use-models';
import { HeavyVehicleGrid } from './heavy-vehicle-grid';
import { PopularBrands } from './popular-brands';
import { VEHICLE_TYPES, VehicleTypeRail, type VehicleType } from './vehicle-type-rail';

interface Props {
  brands: Brand[];
  provinces: Province[];
  initialCount: number;
}

type Criteria = {
  brand_id: string;
  model_id: string;
  price_max: string;
  year_min: string;
  km_max: string;
  location: string; // « p:3 » = province, « c:12 » = ville
  origin: string;
  customs: string;
};

const EMPTY: Criteria = { brand_id: '', model_id: '', price_max: '', year_min: '', km_max: '', location: '', origin: '', customs: '' };

function toQuery(c: Criteria, category: string) {
  const q = new URLSearchParams({ category });
  for (const key of ['brand_id', 'model_id', 'price_max', 'year_min', 'km_max', 'origin', 'customs'] as const) {
    if (c[key]) q.set(key, c[key]);
  }
  if (c.location) {
    const [kind, id] = c.location.split(':');
    q.set(kind === 'p' ? 'province_id' : 'city_id', id);
  }
  return q.toString();
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <label htmlFor={htmlFor} className="label">{label}</label>
      {children}
    </div>
  );
}

/** Moteur de recherche rapide de la page d'accueil. */
export function SearchEngine({ brands: allBrands, provinces, initialCount }: Props) {
  const t = useDict();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<VehicleType>('voiture');
  const category = VEHICLE_TYPES.find((v) => v.id === vehicle)!.categories;
  const [c, setC] = useState<Criteria>(EMPTY);
  // Deux entrées au même niveau pour les voitures : liste complète « Par marque » ou grille « Marques populaires »
  const [brandMode, setBrandMode] = useState<'liste' | 'populaires'>('liste');
  const [pending, startTransition] = useTransition();
  const brands = useBrands(allBrands, category);
  const { models, loading: modelsLoading } = useModels(c.brand_id, category);

  const query = useMemo(() => toQuery(c, category), [c, category]);
  // Changer de type de véhicule : la marque et le modèle choisis n'ont plus de sens
  const changeVehicle = (v: VehicleType) => {
    setVehicle(v);
    setBrandMode('liste');
    setC((prev) => ({ ...prev, brand_id: '', model_id: '' }));
  };
  const liveCount = useLiveCount(query);
  const count = liveCount ?? initialCount;

  const set = (key: keyof Criteria) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setC((prev) => ({ ...prev, [key]: e.target.value, ...(key === 'brand_id' ? { model_id: '' } : {}) }));

  const popular = brands.filter((b) => b.is_popular);
  const others = brands.filter((b) => !b.is_popular);

  return (
    <form
      role="search"
      aria-label={t.search.aria}
      className="card flex overflow-hidden shadow-[0_16px_40px_-16px_rgb(7_44_68/0.45)]"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => router.push(`/recherche?${query}`));
      }}
    >
      <VehicleTypeRail value={vehicle} onChange={changeVehicle} />
      <div className="min-w-0 flex-1 p-4 sm:p-6">
      {/* Camion & utilitaires : on choisit d'abord la sous-catégorie, comme sur mobile.de */}
      {vehicle === 'camion' ? (
        <HeavyVehicleGrid />
      ) : (
      <>
      {vehicle === 'voiture' && (
        <div role="tablist" aria-label={t.search.brandModeAria} className="mb-5 flex gap-1 rounded-lg bg-paper p-1 sm:w-fit">
          {(['liste', 'populaires'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              id={`brand-tab-${mode}`}
              aria-selected={brandMode === mode}
              aria-controls={`brand-panel-${mode}`}
              onClick={() => setBrandMode(mode)}
              className={`h-10 flex-1 rounded-md px-4 text-sm font-bold transition-colors sm:flex-none ${
                brandMode === mode ? 'bg-surface text-ink shadow-[0_1px_3px_rgb(0_0_0/0.18)]' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {mode === 'liste' ? t.search.byBrand : t.search.popularBrands}
            </button>
          ))}
        </div>
      )}
      {vehicle === 'voiture' && brandMode === 'populaires' ? (
        <div role="tabpanel" id="brand-panel-populaires" aria-labelledby="brand-tab-populaires">
          <PopularBrands
            brands={allBrands}
            selectedId={c.brand_id}
            onSelect={(id) => {
              // Une marque choisie dans la grille ouvre le formulaire classique, modèles chargés
              setC((prev) => ({ ...prev, brand_id: id, model_id: '' }));
              setBrandMode('liste');
            }}
          />
        </div>
      ) : (
      <div role={vehicle === 'voiture' ? 'tabpanel' : undefined} id="brand-panel-liste" aria-labelledby={vehicle === 'voiture' ? 'brand-tab-liste' : undefined}>
      <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t.search.brand} htmlFor="se-brand">
          <select id="se-brand" className="field" value={c.brand_id} onChange={set('brand_id')}>
            <option value="">{t.search.allBrands}</option>
            <optgroup label={t.search.popular}>
              {popular.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </optgroup>
            <optgroup label={t.search.otherBrands}>
              {others.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </optgroup>
          </select>
        </Field>

        <Field label={t.search.model} htmlFor="se-model">
          <select id="se-model" className="field" value={c.model_id} onChange={set('model_id')} disabled={!c.brand_id || modelsLoading}>
            <option value="">{c.brand_id ? (modelsLoading ? t.common.loading : t.search.allModels) : t.search.chooseBrand}</option>
            {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>

        <Field label={t.search.priceUpTo} htmlFor="se-price">
          <select id="se-price" className="field tabular" value={c.price_max} onChange={set('price_max')}>
            <option value="">{t.search.any}</option>
            {PRICE_STEPS.map((p) => <option key={p} value={p}>{formatMGA(p)}</option>)}
          </select>
        </Field>

        <Field label={t.search.yearFrom} htmlFor="se-year">
          <select id="se-year" className="field tabular" value={c.year_min} onChange={set('year_min')}>
            <option value="">{t.search.anyF}</option>
            {yearSteps().map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </Field>

        <Field label={t.search.kmUpTo} htmlFor="se-km">
          <select id="se-km" className="field tabular" value={c.km_max} onChange={set('km_max')}>
            <option value="">{t.search.any}</option>
            {KM_STEPS.map((k) => <option key={k} value={k}>{formatKm(k)}</option>)}
          </select>
        </Field>

        <Field label={t.search.location} htmlFor="se-location">
          <select id="se-location" className="field" value={c.location} onChange={set('location')}>
            <option value="">{t.search.allMadagascar}</option>
            {provinces.map((p) => (
              <optgroup key={p.id} label={fmt(t.search.provinceOf, { name: p.name })}>
                <option value={`p:${p.id}`}>{t.search.wholeProvince}{p.common_name ? ` (${p.common_name})` : ''}</option>
                {p.cities.map((city) => (
                  <option key={city.id} value={`c:${city.id}`}>
                    {city.name}{city.common_name ? ` – ${city.common_name}` : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>

        <Field label={t.search.origin} htmlFor="se-origin">
          <select id="se-origin" className="field" value={c.origin} onChange={set('origin')}>
            <option value="">{t.search.allF}</option>
            {ORIGINS.map((v) => <option key={v} value={v}>{t.labels.origin[v]}</option>)}
          </select>
        </Field>

        <Field label={t.search.customs} htmlFor="se-customs">
          <select id="se-customs" className="field" value={c.customs} onChange={set('customs')}>
            <option value="">{t.search.allM}</option>
            {CUSTOMS.map((v) => <option key={v} value={v}>{t.labels.customs[v]}</option>)}
          </select>
        </Field>
      </div>

      <div className="mt-5 flex flex-col-reverse items-stretch gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-center gap-4 text-sm sm:justify-start">
          <button
            type="button"
            onClick={() => setC(EMPTY)}
            className="font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline disabled:invisible"
            disabled={Object.values(c).every((v) => !v)}
          >
            {t.search.reset}
          </button>
          <a href={`/recherche?${query}`} className="font-semibold text-brand-ink hover:underline">
            {t.search.detailed}
          </a>
        </div>
        <button type="submit" disabled={pending || count === 0} aria-live="polite" className="btn-primary h-12 min-w-64 px-6 text-base">
          <Search className="size-5" strokeWidth={2.5} aria-hidden />
          {count === 0 ? (
            t.search.noResults
          ) : (
            <span>
              <NumberTicker value={count} /> {count > 1 ? t.search.adsOther : t.search.adsOne}
            </span>
          )}
        </button>
      </div>
      </div>
      )}
      </>
      )}
      </div>
    </form>
  );
}
