'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { House, MessageCircle, Search, UserRound } from 'lucide-react';
import { useDict } from '@/i18n/client';

type TabId = 'home' | 'search' | 'chat' | 'profile';

/** Onglet actif selon l'URL : les fiches annonces restent rattachées à « Recherche ». */
export function activeTab(pathname: string): TabId | null {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/recherche') || pathname.startsWith('/annonces')) return 'search';
  if (pathname.startsWith('/compte/messages')) return 'chat';
  if (pathname.startsWith('/compte') || pathname.startsWith('/connexion') || pathname.startsWith('/inscription')) return 'profile';
  return null;
}

/** Nombre de messages non lus, rafraîchi toutes les 30 s et au retour sur l'onglet du navigateur. */
function useUnread(loggedIn: boolean) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!loggedIn) return;
    const load = () =>
      fetch('/bff/conversations/unread')
        .then((r) => (r.ok ? r.json() : { total: 0 }))
        .then((d) => setUnread(d.total ?? 0))
        .catch(() => {});
    load();
    const timer = setInterval(load, 30_000);
    document.addEventListener('visibilitychange', load);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
    };
  }, [loggedIn]);
  return unread;
}

function useTabs(loggedIn: boolean) {
  const t = useDict();
  return [
    { id: 'home' as const, href: '/', label: t.nav.tabHome, Icon: House },
    { id: 'search' as const, href: '/recherche', label: t.nav.tabSearch, Icon: Search },
    { id: 'chat' as const, href: loggedIn ? '/compte/messages' : '/connexion?suite=/compte/messages', label: t.nav.tabChat, Icon: MessageCircle },
    { id: 'profile' as const, href: loggedIn ? '/compte' : '/connexion', label: t.nav.tabProfile, Icon: UserRound },
  ];
}

function UnreadDot({ n, className = '' }: { n: number; className?: string }) {
  if (!n) return null;
  return (
    <span className={`tabular grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-action px-1 text-[0.6875rem] font-extrabold leading-none text-on-action ${className}`}>
      {n > 99 ? '99+' : n}
    </span>
  );
}

/** Les 4 accès rapides dans l'en-tête (tablette et ordinateur). */
export function DesktopTabs({ loggedIn }: { loggedIn: boolean }) {
  const t = useDict();
  const pathname = usePathname();
  const current = activeTab(pathname);
  const unread = useUnread(loggedIn);

  return (
    <nav aria-label={t.nav.tabs} className="hidden md:block">
      <ul className="flex gap-1">
        {useTabs(loggedIn).map(({ id, href, label, Icon }) => (
          <li key={id}>
            <Link
              href={href}
              aria-current={current === id ? 'page' : undefined}
              className={`relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                current === id ? 'bg-brand-tint text-brand-ink' : 'text-ink-soft hover:bg-paper hover:text-ink'
              }`}
            >
              <Icon className="size-[1.125rem]" strokeWidth={current === id ? 2.4 : 1.9} aria-hidden />
              {label}
              {id === 'chat' && <UnreadDot n={unread} />}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Barre d'onglets fixe en bas d'écran (mobile), comme une application native :
 * cibles de 56 px, icône + libellé, prise en compte de la zone de geste iOS/Android.
 */
export function MobileTabBar({ loggedIn }: { loggedIn: boolean }) {
  const t = useDict();
  const pathname = usePathname();
  const current = activeTab(pathname);
  const unread = useUnread(loggedIn);

  return (
    <nav
      aria-label={t.nav.tabs}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {useTabs(loggedIn).map(({ id, href, label, Icon }) => {
          const active = current === id;
          return (
            <li key={id}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-bold transition-colors active:bg-paper ${
                  active ? 'text-brand-ink' : 'text-ink-faint'
                }`}
              >
                <span className={`absolute inset-x-6 top-0 h-0.5 rounded-b-full transition-colors ${active ? 'bg-action' : 'bg-transparent'}`} aria-hidden />
                <span className="relative">
                  <Icon className="size-6" strokeWidth={active ? 2.3 : 1.8} aria-hidden />
                  {id === 'chat' && <UnreadDot n={unread} className="absolute -right-2.5 -top-1.5" />}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
