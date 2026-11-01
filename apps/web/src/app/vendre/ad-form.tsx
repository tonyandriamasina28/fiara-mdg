'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ImagePlus, X } from 'lucide-react';
import { useModels } from '@/components/search/use-models';
import { fmt } from '@/i18n';
import { useDict } from '@/i18n/client';
import { ApiError, type Brand, type Province } from '@/lib/api';
import { bff } from '@/lib/bff';
import { CATEGORIES, CUSTOMS, FUELS, GEARBOXES, ORIGINS, yearSteps } from '@/lib/format';

export interface Equipment { id: number; code: string; label: string; grp: string }

const MAX_PHOTOS = 20;
const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

type Photo = { file: File; url: string };

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6" aria-labelledby={`step-${n}`}>
      <h2 id={`step-${n}`} className="mb-5 flex items-center gap-3 text-lg font-extrabold">
        <span className="grid size-7 place-items-center rounded-full bg-brand text-sm text-white" aria-hidden>{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Formulaire de dépôt d'annonce : envoi multipart (champs + photos) vers POST /api/ads via /bff. */
export function AdForm({ brands, provinces, equipment, hasPhone }: { brands: Brand[]; provinces: Province[]; equipment: Equipment[]; hasPhone: boolean }) {
  const t = useDict();
  const [brandId, setBrandId] = useState('');
  const { models } = useModels(brandId);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoError, setPhotoError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<{ sending?: boolean; error?: string; upgrade?: boolean; fields?: Record<string, string>; done?: boolean }>({});
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const accepted: Photo[] = [];
    let rejected = 0;
    for (const file of Array.from(list)) {
      if (!ACCEPTED.includes(file.type) || file.size > MAX_BYTES) rejected++;
      else accepted.push({ file, url: URL.createObjectURL(file) });
    }
    setPhotos((prev) => [...prev, ...accepted].slice(0, MAX_PHOTOS));
    setPhotoError(rejected ? t.sell.photosHint : '');
  };

  const removePhoto = (i: number) =>
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[i].url);
      return prev.filter((_, j) => j !== i);
    });

  const makeCover = (i: number) => setPhotos((prev) => [prev[i], ...prev.filter((_, j) => j !== i)]);

  if (state.done) {
    return (
      <div className="card mt-8 p-8 text-center" role="status">
        <CheckCircle2 className="mx-auto size-12 text-ok" aria-hidden />
        <p className="mx-auto mt-4 max-w-md text-lg font-bold">{t.sell.success}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/compte" className="btn-primary">{t.sell.viewAccount}</Link>
          <button type="button" className="btn-secondary" onClick={() => { setState({}); setPhotos([]); }}>{t.sell.another}</button>
        </div>
      </div>
    );
  }

  const err = (k: string) => state.fields?.[k];
  const fieldErr = (k: string) => err(k) ? <p className="mt-1 text-sm text-danger">{err(k)}</p> : null;

  return (
    <form
      className="mt-8 space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        // Champs vides : non envoyés (l'API les considère facultatifs)
        for (const [k, v] of Array.from(fd.entries())) if (v === '') fd.delete(k);
        fd.delete('photos_picker');
        // Une case décochée n'est pas envoyée : on transmet explicitement true / false
        for (const name of ['price_negotiable', 'show_phone', 'whatsapp']) {
          const box = e.currentTarget.elements.namedItem(name) as HTMLInputElement;
          fd.set(name, box.checked ? 'true' : 'false');
        }
        for (const p of photos) fd.append('photos', p.file);
        setState({ sending: true });
        try {
          await bff('/ads', { method: 'POST', body: fd });
          setState({ done: true });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
          const apiErr = error as ApiError;
          setState({
            error: apiErr.message,
            upgrade: apiErr.details?.upgrade,
            fields: Object.fromEntries((apiErr.fields ?? []).map((f) => [f.path, f.message])),
          });
        }
      }}
    >
      <Section n={1} title={t.sell.stepVehicle}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <span className="label">{t.sell.category}</span>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c, i) => (
                <label key={c} className="cursor-pointer">
                  <input type="radio" name="category" value={c} defaultChecked={i === 0} className="peer sr-only" />
                  <span className="inline-block rounded-full border border-line-strong px-3.5 py-1.5 text-sm font-semibold text-ink-soft peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-action">
                    {t.labels.category[c]}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="a-brand" className="label">{t.search.brand}</label>
            <select id="a-brand" name="brand_id" required className="field" value={brandId} onChange={(e) => setBrandId(e.target.value)} aria-invalid={Boolean(err('brand_id'))}>
              <option value="">—</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="a-model" className="label">{t.search.model}</label>
            <select id="a-model" name="model_id" required className="field" disabled={!brandId}>
              <option value="">{brandId ? '—' : t.search.chooseBrand}</option>
              {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="a-version" className="label">{t.sell.version} <span className="font-normal">({t.common.optional})</span></label>
            <input id="a-version" name="version" className="field" placeholder={t.sell.versionHint} maxLength={120} />
          </div>
          <div>
            <label htmlFor="a-year" className="label">{t.sell.year}</label>
            <select id="a-year" name="year" required className="field tabular">
              <option value="">—</option>
              {yearSteps().map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="a-km" className="label">{t.sell.mileage}</label>
            <input id="a-km" name="mileage_km" type="number" inputMode="numeric" min={0} required className="field tabular" aria-invalid={Boolean(err('mileage_km'))} />
            {fieldErr('mileage_km')}
          </div>
          <div>
            <label htmlFor="a-origin" className="label">{t.search.origin}</label>
            <select id="a-origin" name="origin" required className="field">
              <option value="">—</option>
              {ORIGINS.map((o) => <option key={o} value={o}>{t.labels.origin[o]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="a-customs" className="label">{t.search.customs}</label>
            <select id="a-customs" name="customs" required className="field">
              <option value="">—</option>
              {CUSTOMS.map((o) => <option key={o} value={o}>{t.labels.customs[o]}</option>)}
            </select>
          </div>
        </div>
      </Section>

      <Section n={2} title={t.sell.stepSpecs}>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="a-fuel" className="label">{t.filters.fuel}</label>
            <select id="a-fuel" name="fuel" required className="field">
              <option value="">—</option>
              {FUELS.map((o) => <option key={o} value={o}>{t.labels.fuel[o]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="a-gearbox" className="label">{t.filters.gearbox}</label>
            <select id="a-gearbox" name="gearbox" required className="field">
              <option value="">—</option>
              {GEARBOXES.map((o) => <option key={o} value={o}>{t.labels.gearbox[o]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="a-drive" className="label">{t.sell.drive}</label>
            <select id="a-drive" name="drive" className="field">
              <option value="">—</option>
              {Object.entries(t.labels.drive).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="a-power" className="label">{t.sell.power}</label>
            <input id="a-power" name="power_hp" type="number" min={1} className="field tabular" />
          </div>
          <div>
            <label htmlFor="a-cc" className="label">{t.sell.engine}</label>
            <input id="a-cc" name="engine_cc" type="number" min={50} className="field tabular" />
          </div>
          <div>
            <label htmlFor="a-condition" className="label">{t.sell.condition}</label>
            <select id="a-condition" name="condition" className="field" defaultValue="occasion">
              {Object.entries(t.labels.condition).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="a-doors" className="label">{t.sell.doors}</label>
            <input id="a-doors" name="doors" type="number" min={1} max={6} className="field tabular" />
          </div>
          <div>
            <label htmlFor="a-seats" className="label">{t.sell.seats}</label>
            <input id="a-seats" name="seats" type="number" min={1} max={60} className="field tabular" />
          </div>
          <div>
            <label htmlFor="a-owners" className="label">{t.sell.owners}</label>
            <input id="a-owners" name="previous_owners" type="number" min={0} max={30} className="field tabular" />
          </div>
          <div className="sm:col-span-3">
            <label htmlFor="a-color" className="label">{t.sell.color}</label>
            <input id="a-color" name="exterior_color" className="field" maxLength={40} />
          </div>
        </div>
        <fieldset className="mt-5">
          <legend className="label">{t.ad.equipment}</legend>
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {equipment.map((e) => (
              <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-paper">
                <input type="checkbox" name="equipment" value={e.id} className="size-4" /> {e.label}
              </label>
            ))}
          </div>
        </fieldset>
      </Section>

      <Section n={3} title={t.sell.stepPhotos}>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
          className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${dragging ? 'border-brand bg-brand-tint' : 'border-line-strong'}`}
        >
          <ImagePlus className="mx-auto size-9 text-brand-ink" strokeWidth={1.5} aria-hidden />
          <button type="button" className="btn-secondary mt-3" onClick={() => fileInput.current?.click()} disabled={photos.length >= MAX_PHOTOS}>
            {t.sell.addPhotos}
          </button>
          <p className="mt-2 text-sm text-ink-soft">{t.sell.dropHint}</p>
          <p className="mt-1 text-xs text-ink-faint">{t.sell.photosHint}</p>
          <input
            ref={fileInput}
            name="photos_picker"
            type="file"
            accept={ACCEPTED.join(',')}
            multiple
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
          />
        </div>
        {photoError && <p role="alert" className="mt-2 text-sm text-danger">{photoError}</p>}
        <p className="tabular mt-3 text-sm font-semibold text-ink-soft">{fmt(t.sell.photoCount, { n: photos.length })}</p>
        {photos.length > 0 && (
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {photos.map((p, i) => (
              <li key={p.url} className="group relative aspect-[4/3] overflow-hidden rounded-md bg-paper">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="size-full object-cover" />
                {i === 0 ? (
                  <span className="absolute left-1 top-1 rounded bg-action px-1.5 py-0.5 text-[0.6875rem] font-extrabold text-on-action">{t.sell.cover}</span>
                ) : (
                  <button type="button" onClick={() => makeCover(i)} className="absolute inset-x-1 bottom-1 rounded bg-ink/75 px-1 py-0.5 text-[0.6875rem] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100">
                    {t.sell.cover}
                  </button>
                )}
                <button type="button" onClick={() => removePhoto(i)} aria-label={t.sell.remove} className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-ink/75 text-white">
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section n={4} title={t.sell.stepAd}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="a-title" className="label">{t.sell.adTitle}</label>
            <input id="a-title" name="title" required minLength={5} maxLength={140} className="field" placeholder={t.sell.adTitleHint} aria-invalid={Boolean(err('title'))} />
            {fieldErr('title')}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="a-desc" className="label">{t.sell.description}</label>
            <textarea id="a-desc" name="description" className="field-area min-h-36" maxLength={10000} />
            <p className="mt-1 text-xs text-ink-faint">{t.sell.descriptionHint}</p>
          </div>
          <div>
            <label htmlFor="a-price" className="label">{t.sell.price}</label>
            <input id="a-price" name="price_mga" type="number" inputMode="numeric" min={100000} step={100000} required className="field tabular" aria-invalid={Boolean(err('price_mga'))} />
            {fieldErr('price_mga')}
          </div>
          <div>
            <label htmlFor="a-city" className="label">{t.sell.city}</label>
            <select id="a-city" name="city_id" required className="field">
              <option value="">—</option>
              {provinces.map((p) => (
                <optgroup key={p.id} label={p.name}>
                  {p.cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="a-cphone" className="label">{t.sell.contactPhone}</label>
            <input id="a-cphone" name="contact_phone" type="tel" placeholder={t.auth.phoneHint} className="field tabular" required={!hasPhone} aria-invalid={Boolean(err('contact_phone'))} />
            {fieldErr('contact_phone')}
          </div>
          <div className="space-y-2 self-end">
            {[
              ['price_negotiable', t.sell.negotiable, false],
              ['show_phone', t.sell.showPhone, true],
              ['whatsapp', t.sell.whatsapp, false],
            ].map(([name, text, checked]) => (
              <label key={String(name)} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" name={String(name)} value="true" defaultChecked={Boolean(checked)} className="size-4" /> {text}
              </label>
            ))}
          </div>
        </div>
      </Section>

      {state.error && (
        <div role="alert" className="rounded-lg bg-danger-tint p-4 text-sm text-danger">
          <p className="font-semibold">{state.error}</p>
          {state.upgrade && <Link href="/pro/tarifs" className="mt-1 inline-block font-bold underline">{t.sell.upgrade}</Link>}
        </div>
      )}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary h-12 px-8 text-base" disabled={state.sending}>
          {state.sending ? t.sell.submitting : t.sell.submit}
        </button>
      </div>
    </form>
  );
}
