import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BadgeCheck, Car, MapPin } from 'lucide-react';
import { CustomsBadge } from '@/components/ad-card';
import { ContactSeller, FavoriteButton } from '@/components/contact-seller';
import { PhoneReveal } from '@/components/phone-reveal';
import { SellerMap } from '@/components/seller-map';
import { VerifiedBadge } from '@/components/verified-badge';
import { fmt, intlLocale } from '@/i18n';
import { getDict, getLocale } from '@/i18n/server';
import { ApiError, type AdDetail } from '@/lib/api';
import { formatKm, formatMGA, formatNumber } from '@/lib/format';
import { apiAuth, getSessionUser } from '@/lib/session';

type Props = { params: Promise<{ id: string }> };
type Ad = AdDetail & {
  is_favorite: boolean;
  is_owner: boolean;
  seller_verified: boolean;
  latitude: number | null;
  longitude: number | null;
  precise_location: boolean;
  site_name: string | null;
  site_address: string | null;
};

async function loadAd(id: string) {
  try {
    // Avec le jeton : le vendeur voit son annonce en attente, l'acheteur ses favoris
    return await apiAuth<Ad>(`/ads/${Number(id)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ad = await loadAd((await params).id);
  return { title: `${ad.title} — ${formatMGA(ad.price_mga)}` };
}

export default async function AdPage({ params }: Props) {
  const [ad, t, locale, user] = await Promise.all([loadAd((await params).id), getDict(), getLocale(), getSessionUser()]);

  const specs: [string, string | null][] = [
    [t.ad.year, String(ad.year)],
    [t.ad.mileage, formatKm(ad.mileage_km)],
    [t.ad.fuel, t.labels.fuel[ad.fuel]],
    [t.ad.gearbox, t.labels.gearbox[ad.gearbox]],
    [t.ad.power, ad.power_hp ? `${ad.power_hp} ${t.card.hp}` : null],
    [t.ad.engine, ad.engine_cc ? `${formatNumber(ad.engine_cc)} cm³` : null],
    [t.ad.drive, ad.drive ? t.labels.drive[ad.drive] : null],
    [t.ad.category, t.labels.category[ad.category]],
    [t.ad.origin, t.labels.origin[ad.origin]],
    [t.ad.customs, t.labels.customs[ad.customs]],
    [t.ad.doorsSeats, ad.doors || ad.seats ? `${ad.doors ?? '–'} / ${ad.seats ?? '–'}` : null],
    [t.ad.color, ad.exterior_color],
    [t.ad.owners, ad.previous_owners != null ? String(ad.previous_owners) : null],
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <nav aria-label={t.ad.breadcrumb} className="mb-4 text-sm text-ink-soft">
        <Link href="/recherche" className="hover:underline">{t.ad.search}</Link>
        <span aria-hidden> / </span>
        <Link href={`/recherche?q=${encodeURIComponent(ad.brand)}`} className="hover:underline">{ad.brand}</Link>
        <span aria-hidden> / </span>
        <span>{ad.model}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-8">
          <div className="grid aspect-[16/10] place-items-center overflow-hidden rounded-xl bg-surface">
            {ad.photos[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ad.photos[0].url} alt={ad.title} className="size-full object-cover" />
            ) : (
              <div className="text-center text-ink-faint">
                <Car className="mx-auto size-16" strokeWidth={1} aria-hidden />
                <p className="mt-2 text-sm">{t.ad.noPhoto}</p>
              </div>
            )}
          </div>

          {ad.photos.length > 1 && (
            <ul className="-mt-5 flex gap-2 overflow-x-auto pb-1">
              {ad.photos.slice(1).map((p) => (
                <li key={p.id} className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="h-20 w-28 rounded-md object-cover" loading="lazy" />
                </li>
              ))}
            </ul>
          )}

          <section aria-labelledby="specs-title">
            <h2 id="specs-title" className="mb-3 text-xl font-extrabold">{t.ad.specs}</h2>
            <dl className="grid overflow-hidden rounded-lg border border-line bg-surface sm:grid-cols-2">
              {specs.filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-line px-4 py-3 text-sm">
                  <dt className="text-ink-soft">{k}</dt>
                  <dd className="tabular text-right font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          {ad.equipment.length > 0 && (
            <section aria-labelledby="equip-title">
              <h2 id="equip-title" className="mb-3 text-xl font-extrabold">{t.ad.equipment}</h2>
              <ul className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {ad.equipment.map((e) => (
                  <li key={e} className="flex items-center gap-2">
                    <BadgeCheck className="size-4 text-brand-ink" aria-hidden /> {e}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {ad.description && (
            <section aria-labelledby="desc-title">
              <h2 id="desc-title" className="mb-3 text-xl font-extrabold">{t.ad.description}</h2>
              <p className="max-w-[70ch] whitespace-pre-line leading-relaxed text-ink-soft">{ad.description}</p>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-extrabold leading-snug text-balance">{ad.title}</h1>
              {!ad.is_owner && <FavoriteButton adId={ad.id} initial={ad.is_favorite} loggedIn={Boolean(user)} />}
            </div>
            {ad.version && <p className="mt-1 text-sm text-ink-soft">{ad.version}</p>}
            <p className="tabular mt-4 text-3xl font-extrabold tracking-tight text-brand-ink">{formatMGA(ad.price_mga)}</p>
            {ad.price_negotiable && <p className="text-sm text-ink-soft">{t.ad.negotiable}</p>}
            <div className="mt-3"><CustomsBadge status={ad.customs} t={t} /></div>

            <div className="mt-5 space-y-3">
              {ad.is_owner ? (
                <div className="rounded-lg bg-brand-tint p-3 text-sm text-brand-ink">
                  <p className="font-semibold">{t.ad.ownAd}</p>
                  <Link href="/compte" className="font-bold underline">{t.ad.manage}</Link>
                </div>
              ) : (
                <>
                  <ContactSeller adId={ad.id} loggedIn={Boolean(user)} />
                  {ad.show_phone && <PhoneReveal adId={ad.id} />}
                </>
              )}
            </div>
          </div>

          <div className="card p-5 text-sm">
            <p className="font-bold">
              {ad.seller_type === 'professionnel' ? ad.company_name : fmt(t.ad.privateSeller, { name: ad.seller_first_name })}
              {ad.seller_verified && <VerifiedBadge t={t} className="ml-2" />}
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-ink-soft">
              <MapPin className="size-4" aria-hidden /> {fmt(t.ad.location, { city: ad.city, province: ad.province })}
            </p>
            <p className="mt-1 text-ink-faint">
              {fmt(t.ad.memberSince, {
                date: new Date(ad.seller_since).toLocaleDateString(intlLocale(locale), { month: 'long', year: 'numeric' }),
              })}
            </p>
          </div>

          {ad.latitude != null && ad.longitude != null && (
            <SellerMap
              latitude={ad.latitude}
              longitude={ad.longitude}
              city={ad.city}
              precise={ad.precise_location}
              siteName={ad.site_name}
              siteAddress={ad.site_address}
            />
          )}

          <p className="px-1 text-xs leading-relaxed text-ink-faint">{t.ad.safety}</p>
        </aside>
      </div>
    </div>
  );
}
