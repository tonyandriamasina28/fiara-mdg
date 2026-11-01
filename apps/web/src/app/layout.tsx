import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { themeInitScript } from '@/components/theme-toggle';
import { I18nProvider } from '@/i18n/client';
import { getDict, getLocale } from '@/i18n/server';
import './globals.css';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDict();
  return {
    title: { default: `fiara.mdg — ${t.home.title}`, template: '%s · fiara.mdg' },
    description: t.home.subtitle,
  };
}

export const viewport: Viewport = { themeColor: '#121214', viewportFit: 'cover' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, t] = await Promise.all([getLocale(), getDict()]);
  return (
    // data-theme est fixé avant l'affichage par themeInitScript (sombre par défaut, choix gardé dans localStorage)
    <html lang={locale} className={manrope.variable} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-dvh flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] font-sans antialiased md:pb-0">
        <I18nProvider locale={locale}>
          <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-surface focus:px-4 focus:py-2">
            {t.nav.skip}
          </a>
          <SiteHeader />
          <main id="contenu" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </I18nProvider>
      </body>
    </html>
  );
}
