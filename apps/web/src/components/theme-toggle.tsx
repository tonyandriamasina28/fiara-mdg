'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useDict } from '@/i18n/client';

export type Theme = 'dark' | 'light';
export const THEME_KEY = 'fiara_theme';
const THEME_COLORS: Record<Theme, string> = { dark: '#121214', light: '#f8f9fa' };

/**
 * Script exécuté dans <head> avant le premier rendu : applique le thème mémorisé
 * (sombre par défaut) pour éviter tout flash de la mauvaise couleur.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t!=='light'&&t!=='dark')t='dark';document.documentElement.dataset.theme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t==='dark'?'${THEME_COLORS.dark}':'${THEME_COLORS.light}');}catch(e){document.documentElement.dataset.theme='dark';}})();`;

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // stockage indisponible (navigation privée) : le choix vaut pour la session
  }
}

/** Bouton soleil / lune : bascule instantanée entre mode sombre et mode clair. */
export function ThemeToggle() {
  const t = useDict();
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  }, []);

  const next: Theme = theme === 'light' ? 'dark' : 'light';
  const label = next === 'dark' ? t.nav.themeDark : t.nav.themeLight;

  return (
    <button
      type="button"
      onClick={() => {
        applyTheme(next);
        setTheme(next);
      }}
      aria-label={label}
      title={label}
      className="group relative grid size-10 place-items-center overflow-hidden rounded-md border border-line text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
    >
      {/* Icône affichée = thème vers lequel on bascule ; rotation courte au changement */}
      <Sun className={`absolute size-[1.125rem] transition-all duration-300 ${theme === 'dark' ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0'}`} aria-hidden />
      <Moon className={`absolute size-[1.125rem] transition-all duration-300 ${theme === 'light' ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-50 opacity-0'}`} aria-hidden />
    </button>
  );
}
