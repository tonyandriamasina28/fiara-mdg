const numberFr = new Intl.NumberFormat('fr-FR');

/** 185000000 → « 185 000 000 Ar » (même écriture en français et en malgache) */
export const formatMGA = (value: number) => `${numberFr.format(value)} Ar`;

export const formatKm = (value: number) => `${numberFr.format(value)} km`;

export const formatNumber = (value: number) => numberFr.format(value);

/** +261341234567 → « 034 12 345 67 » */
export const formatPhone = (e164: string) => e164.replace(/^\+261(\d{2})(\d{2})(\d{3})(\d{2})$/, '0$1 $2 $3 $4');

/** Paliers de prix proposés dans les listes déroulantes (en Ariary). */
export const PRICE_STEPS = [
  10_000_000, 20_000_000, 30_000_000, 40_000_000, 50_000_000, 75_000_000,
  100_000_000, 150_000_000, 200_000_000, 300_000_000,
];

export const KM_STEPS = [10_000, 25_000, 50_000, 75_000, 100_000, 150_000, 200_000];

export const yearSteps = () => {
  const now = new Date().getFullYear();
  return Array.from({ length: 30 }, (_, i) => now - i);
};

export const CATEGORIES = [
  'voiture', 'suv_4x4', 'pickup', 'moto', 'camping_car',
  'utilitaire', 'camion', 'tracteur_routier', 'semi_remorque', 'remorque', 'bus', 'agricole', 'engin_chantier', 'chariot_elevateur',
] as const;
/** Sous-catégories du type « Camion & utilitaires » (grille du moteur de recherche). */
export const HEAVY_CATEGORIES = ['camion', 'remorque', 'utilitaire', 'tracteur_routier', 'semi_remorque', 'bus', 'agricole', 'engin_chantier', 'chariot_elevateur'] as const;
export const FUELS = ['essence', 'diesel', 'hybride', 'electrique', 'gpl'] as const;
export const GEARBOXES = ['manuelle', 'automatique'] as const;
export const ORIGINS = ['occasion_madagascar', 'import_europe', 'import_asie', 'import_autre'] as const;
export const CUSTOMS = ['dedouane', 'non_dedouane', 'en_cours'] as const;
export const SORTS = ['pertinence', 'recent', 'prix_asc', 'prix_desc', 'km_asc', 'annee_desc'] as const;
