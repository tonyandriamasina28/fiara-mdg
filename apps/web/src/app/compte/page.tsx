import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Briefcase, Car, Eye, Heart, MessageCircle, MessageSquare, Plus, Search, ShieldCheck } from 'lucide-react';
import { AdCard } from '@/components/ad-card';
import { BoostButton, type SponsorshipPlan } from '@/components/payment/boost-button';
import { fmt, intlLocale } from '@/i18n';
import { getDict, getLocale } from '@/i18n/server';
import { api, type AdSummary } from '@/lib/api';
import { formatMGA } from '@/lib/format';
import { apiAuth, requireUser } from '@/lib/session';
import { VerifiedBadge } from '@/components/verified-badge';
import { AccountSettings } from './account-settings';
import { AdActions } from './ad-actions';
import type { VerificationState } from './verification/identity-form';
import { RecentSearches, type RecentSearch } from './recent-searches';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).profile.metaTitle };
}

type MyAd = AdSummary & { status: string; views_count: number; sponsored_until: string | null; conversation_count: number; favorite_count: number };
type Conversation = { id: number; ad_title: string; other_name: string; side: 'achat' | 'vente'; last_message: string | null; last_message_at: string; unread: number; cover_url: string | null };
type Overview = { favorites: number; searches: number; conversations: number; unread: number; ads: number };

const STATUS_TONE: Record<string, string> = {
  active: 'bg-ok-tint text-ok',
  en_attente: 'bg-warn-tint text-warn',
  suspendue: 'bg-paper text-ink-soft',
  vendue: 'bg-brand-tint text-brand-ink',
  expiree: 'bg-danger-tint text-danger',
  brouillon: 'bg-paper text-ink-soft',
};

function SectionTitle({ id, title, children }: { id: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 id={id} className="text-xl font-extrabold tracking-tight">{title}</h2>
      {children}
    </div>
  );
}

/**
 * Profil : point central du compte. Tout ce qui est affiché ici est stocké côté serveur
 * (recherches récentes, favoris, discussions) et donc identique sur tous les appareils.
 */
export default async function ProfilePage() {
  const user = await requireUser('/compte');
  const [t, locale, overview, searches, favorites, conversations, ads, plans] = await Promise.all([
    getDict(),
    getLocale(),
    apiAuth<Overview>('/me/overview'),
    apiAuth<RecentSearch[]>('/me/searches'),
    apiAuth<AdSummary[]>('/ads/favorites'),
    apiAuth<Conversation[]>('/conversations'),
    apiAuth<MyAd[]>('/ads/mine'),
    api<SponsorshipPlan[]>('/reference/sponsorship-plans', { revalidate: 3600 }),
  ]);
  const verification = await apiAuth<VerificationState>('/verifications/me');
  const verifyStatus = verification.verified_at ? 'valide' : verification.current?.status;
  const date = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString(intlLocale(locale), opts);
  const initials = `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase();

  const stats = [
    { href: '#favoris', label: t.profile.stats.favorites, value: overview.favorites, Icon: Heart },
    { href: '#recherches', label: t.profile.stats.searches, value: overview.searches, Icon: Search },
    { href: '#discussions', label: t.profile.stats.conversations, value: overview.conversations, Icon: MessageCircle, badge: overview.unread },
    { href: '#annonces', label: t.profile.stats.ads, value: overview.ads, Icon: Car },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-8">
      {/* En-tête du profil */}
      <section className="card flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        <div className="grid size-16 shrink-0 place-items-center rounded-full bg-brand text-xl font-extrabold text-white" aria-hidden>{initials}</div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold tracking-tight">{user.company_name ?? `${user.first_name} ${user.last_name}`}
            {verification.verified_at && <VerifiedBadge t={t} className="ml-2 align-middle" />}
          </h1>
          <p className="text-sm text-ink-soft">
            {user.role === 'professionnel' ? t.card.pro : t.card.private} · {fmt(t.profile.memberSince, { date: date(user.created_at, { month: 'long', year: 'numeric' }) })}
          </p>
          <p className="mt-1 text-xs text-ink-faint">{t.profile.sync}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.role === 'professionnel' && (
            <Link href="/pro" className="btn-secondary h-10"><Briefcase className="size-4" aria-hidden /> {t.account.proDashboard}</Link>
          )}
          <Link href="/vendre" className="btn-primary h-10"><Plus className="size-4" aria-hidden /> {t.account.newAd}</Link>
        </div>
      </section>

      {/* Compteurs = raccourcis vers les sections */}
      <nav aria-label={t.profile.sectionsAria} className="mt-4 grid grid-cols-4 gap-2">
        {stats.map(({ href, label, value, Icon, badge }) => (
          <a key={href} href={href} className="card relative flex flex-col items-center gap-1 px-2 py-3 text-center hover:border-brand">
            <Icon className="size-5 text-brand-ink" aria-hidden />
            <span className="tabular text-lg font-extrabold leading-none">{value}</span>
            <span className="text-[0.6875rem] font-semibold text-ink-soft sm:text-xs">{label}</span>
            {badge ? <span className="tabular absolute right-2 top-2 rounded-full bg-action px-1.5 text-[0.6875rem] font-extrabold text-on-action">{badge}</span> : null}
          </a>
        ))}
      </nav>

      {/* Vérification d'identité : statut et accès au téléversement du passeport */}
      {verifyStatus !== 'valide' && (
        <Link href="/compte/verification" className="card mt-4 flex items-center gap-4 p-4 transition-colors hover:border-brand">
          <ShieldCheck className="size-8 shrink-0 text-brand-ink" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-extrabold">{t.verify.profileCard}</p>
            <p className="text-sm text-ink-soft">{verifyStatus ? t.verify.status[verifyStatus] : t.verify.intro}</p>
          </div>
          <span className="hidden shrink-0 text-sm font-bold text-brand-ink sm:block">{verifyStatus ? t.verify.profileSee : t.verify.profileCta}</span>
        </Link>
      )}

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="recherches-title" id="recherches" className="scroll-mt-24">
            <SectionTitle id="recherches-title" title={t.profile.recentSearches} />
            <RecentSearches initial={searches} />
          </section>

          <section aria-labelledby="favoris-title" id="favoris" className="scroll-mt-24">
            <SectionTitle id="favoris-title" title={t.account.favorites} />
            {favorites.length === 0 ? (
              <p className="card p-5 text-ink-soft">{t.account.noFavorites}</p>
            ) : (
              <ol className="space-y-3">
                {favorites.map((ad) => <li key={ad.id}><AdCard ad={ad} t={t} /></li>)}
              </ol>
            )}
          </section>

          <section aria-labelledby="annonces-title" id="annonces" className="scroll-mt-24">
            <SectionTitle id="annonces-title" title={t.account.myAds} />
            {ads.length === 0 ? (
              <div className="card flex flex-wrap items-center justify-between gap-3 p-5 text-ink-soft">
                <p>{t.account.noAds}</p>
                <Link href="/vendre" className="btn-primary h-10">{t.nav.sell}</Link>
              </div>
            ) : (
              <ul className="space-y-3">
                {ads.map((ad) => (
                  <li key={ad.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:flex-wrap sm:items-center">
                    <div className="grid h-20 w-28 shrink-0 place-items-center overflow-hidden rounded-md bg-paper">
                      {ad.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ad.cover_url} alt="" className="size-full object-cover" />
                      ) : (
                        <Car className="size-7 text-line-strong" aria-hidden />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${STATUS_TONE[ad.status] ?? ''}`}>{t.labels.adStatus[ad.status]}</span>
                        {ad.sponsored_until && new Date(ad.sponsored_until) > new Date() && (
                          <span className="rounded bg-action-tint px-1.5 py-0.5 text-xs font-bold text-action-ink">
                            {fmt(t.account.boosted, { date: date(ad.sponsored_until, { day: 'numeric', month: 'long' }) })}
                          </span>
                        )}
                      </div>
                      <Link href={`/annonces/${ad.id}`} className="mt-1 block truncate font-bold hover:text-brand-ink">{ad.title}</Link>
                      <p className="tabular mt-0.5 font-extrabold text-brand-ink">{formatMGA(ad.price_mga)}</p>
                    </div>
                    <ul className="tabular flex gap-4 text-sm text-ink-soft">
                      <li className="flex items-center gap-1" title={fmt(t.account.views, { n: ad.views_count })}><Eye className="size-4" aria-hidden /> {ad.views_count}</li>
                      <li className="flex items-center gap-1" title={fmt(t.account.favoritesCount, { n: ad.favorite_count })}><Heart className="size-4" aria-hidden /> {ad.favorite_count}</li>
                      <li className="flex items-center gap-1" title={fmt(t.account.conversations, { n: ad.conversation_count })}><MessageSquare className="size-4" aria-hidden /> {ad.conversation_count}</li>
                    </ul>
                    {/* Gestion de l'annonce : modifier, suspendre, vendue, supprimer + mise en avant payante */}
                    <div className="flex w-full flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                      <AdActions adId={ad.id} status={ad.status} />
                      {['active', 'en_attente'].includes(ad.status) && <BoostButton adId={ad.id} plans={plans} phone={user.phone} />}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-10">
          <section aria-labelledby="discussions-title" id="discussions" className="scroll-mt-24">
            <SectionTitle id="discussions-title" title={t.profile.discussions}>
              <Link href="/compte/messages" className="flex items-center gap-1 text-sm font-bold text-brand-ink hover:underline">
                {t.profile.allDiscussions} <ArrowRight className="size-4" aria-hidden />
              </Link>
            </SectionTitle>
            {conversations.length === 0 ? (
              <p className="card p-5 text-ink-soft">{t.profile.noDiscussions}</p>
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {conversations.slice(0, 6).map((c) => (
                  <li key={c.id}>
                    <Link href={`/compte/messages?c=${c.id}`} className="flex gap-3 px-4 py-3 hover:bg-paper">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className={`truncate text-sm ${c.unread ? 'font-extrabold' : 'font-semibold'}`}>{c.other_name}</p>
                          <span className="shrink-0 text-xs text-ink-faint">{date(c.last_message_at, { day: 'numeric', month: 'short' })}</span>
                        </div>
                        <p className="truncate text-xs text-ink-soft">{c.side === 'achat' ? t.messages.buying : t.messages.selling} · {c.ad_title}</p>
                        <p className={`truncate text-sm ${c.unread ? 'text-ink' : 'text-ink-soft'}`}>{c.last_message}</p>
                      </div>
                      {c.unread > 0 && <span className="tabular mt-1 h-5 shrink-0 rounded-full bg-action px-1.5 text-xs font-extrabold leading-5 text-on-action">{c.unread}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      <section aria-labelledby="parametres-title" id="parametres" className="mt-12 scroll-mt-24">
        <SectionTitle id="parametres-title" title={t.profile.settings} />
        <AccountSettings user={{ first_name: user.first_name, last_name: user.last_name, phone: user.phone, email: user.email }} />
      </section>
    </div>
  );
}
