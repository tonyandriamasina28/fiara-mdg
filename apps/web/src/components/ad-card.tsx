import Link from 'next/link';
import { Camera, Car, MapPin } from 'lucide-react';
import type { Dict } from '@/i18n';
import type { AdSummary } from '@/lib/api';
import { formatKm, formatMGA } from '@/lib/format';
import { VerifiedBadge } from './verified-badge';

export function CustomsBadge({ status, t }: { status: string; t: Dict }) {
  const tone =
    status === 'dedouane' ? 'bg-ok-tint text-ok' : status === 'non_dedouane' ? 'bg-warn-tint text-warn' : 'bg-paper text-ink-soft';
  return <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${tone}`}>{t.labels.customs[status]}</span>;
}

/** Ligne de résultat horizontale, sur le modèle des listes de mobile.de. */
export function AdCard({ ad, t }: { ad: AdSummary; t: Dict }) {
  const specs = [
    `${ad.year}`,
    formatKm(ad.mileage_km),
    t.labels.fuel[ad.fuel],
    t.labels.gearbox[ad.gearbox],
    ad.power_hp ? `${ad.power_hp} ${t.card.hp}` : null,
  ].filter(Boolean);

  return (
    <article
      className={`group relative grid grid-cols-1 overflow-hidden rounded-lg border bg-surface transition-shadow hover:shadow-[0_8px_24px_-10px_rgb(7_44_68/0.35)] sm:grid-cols-[16rem_1fr] ${
        ad.is_sponsored ? 'border-action' : 'border-line'
      }`}
    >
      <div className="relative aspect-[4/3] bg-paper sm:aspect-auto sm:min-h-44">
        {ad.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.cover_url} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-line-strong">
            <Car className="size-12" strokeWidth={1.25} aria-hidden />
          </div>
        )}
        {ad.photo_count > 0 && (
          <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded bg-ink/75 px-1.5 py-0.5 text-xs font-semibold text-white">
            <Camera className="size-3.5" aria-hidden />
            {ad.photo_count}
          </span>
        )}
        {ad.is_sponsored && (
          <span className="absolute left-2 top-2 rounded bg-action px-1.5 py-0.5 text-xs font-extrabold text-on-action">{t.card.featured}</span>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-4">
          <h3 className="min-w-0 text-base font-bold leading-snug text-ink">
            <Link href={`/annonces/${ad.id}`} className="after:absolute after:inset-0 group-hover:text-brand-ink">
              {ad.title}
            </Link>
          </h3>
          <div className="shrink-0 text-right">
            <p className="tabular text-lg font-extrabold text-brand-ink">{formatMGA(ad.price_mga)}</p>
            {ad.price_negotiable && <p className="text-xs text-ink-faint">{t.card.negotiable}</p>}
          </div>
        </div>

        <p className="tabular text-sm text-ink-soft">{specs.join(' · ')}</p>

        <div className="flex flex-wrap items-center gap-1.5">
          <CustomsBadge status={ad.customs} t={t} />
          <span className="rounded bg-brand-tint px-1.5 py-0.5 text-xs font-semibold text-brand-ink">{t.labels.origin[ad.origin]}</span>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2 text-sm text-ink-soft">
          <span className="flex items-center gap-1">
            <MapPin className="size-4" strokeWidth={1.75} aria-hidden />
            {ad.city}
          </span>
          <span className="flex items-center gap-1.5 font-semibold">
            {ad.seller_type === 'professionnel' ? (ad.company_name ?? t.card.pro) : t.card.private}
            {ad.seller_verified && <VerifiedBadge t={t} compact />}
          </span>
        </div>
      </div>
    </article>
  );
}
