'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, ImagePlus, Info, Star, Trash2 } from 'lucide-react';
import { useDict } from '@/i18n/client';
import { ApiError, type Province } from '@/lib/api';
import { bff } from '@/lib/bff';
import { formatKm } from '@/lib/format';

export interface EditableAd {
  id: number;
  status: string;
  title: string;
  description: string | null;
  price_mga: number;
  price_negotiable: boolean;
  city_id: number;
  show_phone: boolean;
  contact_phone: string | null;
  whatsapp: boolean;
  brand: string;
  model: string;
  version: string | null;
  year: number;
  mileage_km: number;
  photos: { id: number; url: string; position: number }[];
}

type Photo = EditableAd['photos'][number];
const MAX_PHOTOS = 20;

/** Gestion des photos : ajout, suppression, ordre (boutons ← →, accessibles au clavier) ; chaque action est enregistrée aussitôt. */
function PhotoManager({ adId, initial }: { adId: number; initial: Photo[] }) {
  const t = useDict();
  const m = t.manage;
  const [photos, setPhotos] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const call = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reorder = (ids: number[]) =>
    call(async () => setPhotos(await bff<Photo[]>(`/ads/${adId}/photos/order`, { method: 'PATCH', json: { ids } })));

  const move = (i: number, delta: number) => {
    const ids = photos.map((p) => p.id);
    [ids[i], ids[i + delta]] = [ids[i + delta], ids[i]];
    reorder(ids);
  };

  return (
    <section aria-labelledby="photos-title" className="card p-5 sm:p-6">
      <h2 id="photos-title" className="text-lg font-extrabold">{m.photos} <span className="tabular text-sm font-semibold text-ink-faint">({photos.length}/{MAX_PHOTOS})</span></h2>
      <p className="mt-1 text-sm text-ink-soft">{m.photosHint}</p>

      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {photos.map((p, i) => (
          <li key={p.id} className="overflow-hidden rounded-lg border border-line bg-paper">
            <div className="relative aspect-[4/3]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="size-full object-cover" />
              {i === 0 && <span className="absolute left-1.5 top-1.5 rounded bg-action px-1.5 py-0.5 text-[0.6875rem] font-extrabold text-on-action">{t.sell.cover}</span>}
            </div>
            <div className="flex items-center justify-between gap-1 p-1.5">
              <div className="flex gap-1">
                <button type="button" className="grid size-8 place-items-center rounded-md hover:bg-surface disabled:opacity-30" onClick={() => move(i, -1)} disabled={busy || i === 0} aria-label={m.moveBefore} title={m.moveBefore}>
                  <ChevronLeft className="size-4" aria-hidden />
                </button>
                <button type="button" className="grid size-8 place-items-center rounded-md hover:bg-surface disabled:opacity-30" onClick={() => move(i, 1)} disabled={busy || i === photos.length - 1} aria-label={m.moveAfter} title={m.moveAfter}>
                  <ChevronRight className="size-4" aria-hidden />
                </button>
                {i > 0 && (
                  <button type="button" className="grid size-8 place-items-center rounded-md hover:bg-surface disabled:opacity-30" onClick={() => reorder([p.id, ...photos.filter((x) => x.id !== p.id).map((x) => x.id)])} disabled={busy} aria-label={m.makeCover} title={m.makeCover}>
                    <Star className="size-4" aria-hidden />
                  </button>
                )}
              </div>
              <button
                type="button"
                className="grid size-8 place-items-center rounded-md text-danger hover:bg-danger-tint disabled:opacity-30"
                disabled={busy}
                aria-label={m.removePhoto}
                title={m.removePhoto}
                onClick={() => {
                  if (!window.confirm(m.confirmRemovePhoto)) return;
                  call(async () => {
                    await bff(`/ads/${adId}/photos/${p.id}`, { method: 'DELETE' });
                    setPhotos((prev) => prev.filter((x) => x.id !== p.id));
                  });
                }}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          </li>
        ))}
        {photos.length < MAX_PHOTOS && (
          <li>
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy}
              className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line-strong text-sm font-semibold text-brand-ink hover:border-brand disabled:opacity-60"
            >
              <ImagePlus className="size-7" strokeWidth={1.5} aria-hidden />
              {busy ? m.uploading : m.addPhotos}
            </button>
            <input
              ref={input}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS - photos.length);
                e.target.value = '';
                if (!files.length) return;
                call(async () => {
                  const fd = new FormData();
                  files.forEach((f) => fd.append('photos', f));
                  setPhotos(await bff<Photo[]>(`/ads/${adId}/photos`, { method: 'POST', body: fd }));
                });
              }}
            />
          </li>
        )}
      </ul>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    </section>
  );
}

/** Champs modifiables. Marque, modèle et année restent figés (c'est le véhicule vendu). */
export function EditAdForm({ ad, provinces }: { ad: EditableAd; provinces: Province[] }) {
  const t = useDict();
  const m = t.manage;
  const router = useRouter();
  const [state, setState] = useState<{ saving?: boolean; ok?: string; error?: string; fields?: Record<string, string> }>({});

  return (
    <div className="mt-6 space-y-6">
      <p className="flex gap-2 rounded-lg bg-brand-tint px-4 py-3 text-sm text-brand-ink">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> {m.moderationNote}
      </p>

      <form
        className="card space-y-5 p-5 sm:p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = new FormData(form);
          const box = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).checked;
          // N'envoyer que ce qui a changé : un changement de prix seul laisse l'annonce en ligne
          const next: Record<string, unknown> = {
            title: String(fd.get('title')).trim(),
            description: String(fd.get('description')).trim(),
            price_mga: Number(fd.get('price_mga')),
            mileage_km: Number(fd.get('mileage_km')),
            city_id: Number(fd.get('city_id')),
            price_negotiable: box('price_negotiable'),
            show_phone: box('show_phone'),
            whatsapp: box('whatsapp'),
            contact_phone: String(fd.get('contact_phone')).trim(),
          };
          const before: Record<string, unknown> = {
            title: ad.title, description: ad.description ?? '', price_mga: ad.price_mga, mileage_km: ad.mileage_km, city_id: ad.city_id,
            price_negotiable: ad.price_negotiable, show_phone: ad.show_phone, whatsapp: ad.whatsapp,
            contact_phone: ad.contact_phone?.replace(/^\+261/, '0') ?? '',
          };
          const changes = Object.fromEntries(Object.entries(next).filter(([k, v]) => v !== before[k] && !(k === 'contact_phone' && v === '')));
          if (!Object.keys(changes).length) return setState({ ok: m.saved });
          // Les cases et champs numériques arrivent en texte côté API (schéma partagé avec le multipart)
          const payload = Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, typeof v === 'boolean' ? String(v) : v]));
          setState({ saving: true });
          try {
            await bff(`/ads/${ad.id}`, { method: 'PATCH', json: payload });
            const contentChanged = Object.keys(changes).some((k) => ['title', 'description', 'mileage_km', 'city_id'].includes(k));
            setState({ ok: ad.status === 'active' && contentChanged ? m.savedReview : m.saved });
            router.refresh();
          } catch (err) {
            const apiErr = err as ApiError;
            setState({ error: apiErr.message, fields: Object.fromEntries((apiErr.fields ?? []).map((f) => [f.path, f.message])) });
          }
        }}
      >
        <div className="rounded-lg bg-paper px-4 py-3">
          <p className="text-xs font-semibold text-ink-soft">{m.vehicle}</p>
          <p className="font-extrabold">{ad.brand} {ad.model}{ad.version ? ` · ${ad.version}` : ''} · {ad.year}</p>
          <p className="mt-0.5 text-xs text-ink-faint">{m.vehicleLocked}</p>
        </div>

        <div>
          <label htmlFor="e-title" className="label">{t.sell.adTitle}</label>
          <input id="e-title" name="title" defaultValue={ad.title} required minLength={5} maxLength={140} className="field" aria-invalid={Boolean(state.fields?.title)} />
        </div>
        <div>
          <label htmlFor="e-desc" className="label">{t.sell.description}</label>
          <textarea id="e-desc" name="description" defaultValue={ad.description ?? ''} maxLength={10000} className="field-area min-h-36" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="e-price" className="label">{t.sell.price}</label>
            <input id="e-price" name="price_mga" type="number" inputMode="numeric" min={100000} step={100000} defaultValue={ad.price_mga} required className="field tabular" aria-invalid={Boolean(state.fields?.price_mga)} />
          </div>
          <div>
            <label htmlFor="e-km" className="label">{t.sell.mileage}</label>
            <input id="e-km" name="mileage_km" type="number" inputMode="numeric" min={0} defaultValue={ad.mileage_km} required className="field tabular" aria-describedby="e-km-now" />
            <p id="e-km-now" className="tabular mt-1 text-xs text-ink-faint">{formatKm(ad.mileage_km)}</p>
          </div>
          <div>
            <label htmlFor="e-city" className="label">{t.sell.city}</label>
            <select id="e-city" name="city_id" defaultValue={ad.city_id} className="field">
              {provinces.map((p) => (
                <optgroup key={p.id} label={p.name}>
                  {p.cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="e-phone" className="label">{t.sell.contactPhone}</label>
            <input id="e-phone" name="contact_phone" type="tel" defaultValue={ad.contact_phone?.replace(/^\+261/, '0') ?? ''} placeholder={t.auth.phoneHint} className="field tabular" aria-invalid={Boolean(state.fields?.contact_phone)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {([
            ['price_negotiable', t.sell.negotiable, ad.price_negotiable],
            ['show_phone', t.sell.showPhone, ad.show_phone],
            ['whatsapp', t.sell.whatsapp, ad.whatsapp],
          ] as const).map(([name, text, checked]) => (
            <label key={name} className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" name={name} defaultChecked={checked} className="size-4" /> {text}
            </label>
          ))}
        </div>

        {state.ok && <p role="status" className="rounded-lg bg-ok-tint px-4 py-2.5 text-sm font-semibold text-ok">{state.ok}</p>}
        {state.error && <p role="alert" className="rounded-lg bg-danger-tint px-4 py-2.5 text-sm text-danger">{state.error}</p>}
        <div className="flex justify-end">
          <button type="submit" className="btn-primary px-8" disabled={state.saving}>{state.saving ? t.common.loading : t.common.save}</button>
        </div>
      </form>

      <PhotoManager adId={ad.id} initial={ad.photos} />
    </div>
  );
}
