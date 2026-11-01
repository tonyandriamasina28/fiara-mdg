import Link from 'next/link';
import { Briefcase, LogOut, Plus } from 'lucide-react';
import { logout } from '@/app/connexion/actions';
import { getDict } from '@/i18n/server';
import { getSessionUser } from '@/lib/session';
import { DesktopTabs, MobileTabBar } from './app-nav';
import { LanguageSwitcher } from './language-switcher';
import { ThemeToggle } from './theme-toggle';
import { Logo } from './logo';

const iconLink = 'grid size-10 place-items-center rounded-md text-ink-soft hover:bg-paper hover:text-ink';

/**
 * En-tête : sur ordinateur il porte les 4 accès rapides (Accueil, Recherche, Discussion, Profil) ;
 * sur mobile ils passent dans la barre d'onglets du bas et l'en-tête ne garde que logo, langue et « Vendre ».
 */
export async function SiteHeader() {
  const [t, user] = await Promise.all([getDict(), getSessionUser()]);
  const loggedIn = Boolean(user);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6 md:h-16 lg:gap-6">
          <Link href="/" aria-label={t.nav.home} className="text-xl">
            <Logo />
          </Link>

          <DesktopTabs loggedIn={loggedIn} />

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <LanguageSwitcher />
            {user?.role === 'professionnel' && (
              <Link href="/pro" className={`${iconLink} hidden md:grid`} aria-label={t.nav.pros} title={t.nav.pros}>
                <Briefcase className="size-5" strokeWidth={1.75} />
              </Link>
            )}
            {user && (
              <form action={logout} className="hidden md:block">
                <button type="submit" className={iconLink} aria-label={t.nav.logout} title={t.nav.logout}>
                  <LogOut className="size-5" strokeWidth={1.75} />
                </button>
              </form>
            )}
            <Link href="/vendre" className="btn-primary h-10 px-3.5 text-sm sm:px-4">
              <Plus className="size-4" strokeWidth={2.75} />
              <span>
                {t.nav.sell}
                <span className="hidden xl:inline">{t.nav.sellLong}</span>
              </span>
            </Link>
          </div>
        </div>
      </header>
      <MobileTabBar loggedIn={loggedIn} />
    </>
  );
}
