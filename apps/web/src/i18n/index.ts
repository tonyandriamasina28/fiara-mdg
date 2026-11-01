import fr, { type Dict } from './fr';
import mg from './mg';

export type Locale = 'fr' | 'mg';
export type { Dict };

export const LOCALES: { code: Locale; label: string; short: string }[] = [
  { code: 'fr', label: 'Français', short: 'FR' },
  { code: 'mg', label: 'Malagasy', short: 'MG' },
];
export const LOCALE_COOKIE = 'fiara_lang';
export const DEFAULT_LOCALE: Locale = 'fr';

export const dictionaries: Record<Locale, Dict> = { fr, mg };

export const isLocale = (v: unknown): v is Locale => v === 'fr' || v === 'mg';

/** « {n} véhicules » + { n: 3 } → « 3 véhicules » */
export function fmt(template: string, vars: Record<string, string | number> = {}) {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

/** Locale BCP 47 pour Intl (dates) : le malgache est servi par « mg-MG ». */
export const intlLocale = (l: Locale) => (l === 'mg' ? 'mg-MG' : 'fr-FR');
