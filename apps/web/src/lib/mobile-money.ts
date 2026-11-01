export type Provider = 'mvola' | 'orange_money' | 'airtel_money';

/**
 * Opérateurs Mobile Money. Préfixes = numéros mobiles de chaque réseau ;
 * codes USSD de secours à confirmer avec chaque opérateur lors de l'intégration.
 */
export const PROVIDERS: { code: Provider; name: string; network: string; prefixes: string[]; ussd: string }[] = [
  { code: 'mvola', name: 'MVola', network: 'Telma', prefixes: ['034', '038'], ussd: '#111#' },
  { code: 'orange_money', name: 'Orange Money', network: 'Orange', prefixes: ['032', '037'], ussd: '#144#' },
  { code: 'airtel_money', name: 'Airtel Money', network: 'Airtel', prefixes: ['033'], ussd: '*436#' },
];

/** « +261 34 12 345 67 », « 0341234567 »… → « 034 » (ou null si le format est invalide) */
export function phonePrefix(raw: string) {
  const digits = raw.replace(/[\s.-]/g, '');
  const m = digits.match(/^(?:\+261|0)(3[2-48])\d{7}$/);
  return m ? `0${m[1]}` : null;
}
