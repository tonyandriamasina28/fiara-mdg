'use client';

import { createContext, useContext } from 'react';
import { dictionaries, type Locale } from './index';

const I18nContext = createContext<Locale>('fr');

/** Fournit la langue aux composants client ; le dictionnaire est résolu localement (pas de sérialisation). */
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <I18nContext.Provider value={locale}>{children}</I18nContext.Provider>;
}

export function useLocale() {
  return useContext(I18nContext);
}

export function useDict() {
  return dictionaries[useContext(I18nContext)];
}
