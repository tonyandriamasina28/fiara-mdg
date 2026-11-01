import { z } from 'zod';

// Numéros malgaches : +261 / 0 suivi de 32, 33, 34, 37, 38 (opérateurs mobiles) + 7 chiffres
export const mgPhone = z
  .string()
  .transform((v) => v.replace(/[\s.-]/g, ''))
  .pipe(z.string().regex(/^(\+261|0)3[2-48]\d{7}$/, 'Numéro malgache invalide (ex. 034 12 345 67)'))
  .transform((v) => (v.startsWith('0') ? '+261' + v.slice(1) : v));

export const fuelTypes = ['essence', 'diesel', 'hybride', 'electrique', 'gpl'] as const;
export const gearboxes = ['manuelle', 'automatique'] as const;
export const categories = ['voiture', 'suv_4x4', 'pickup', 'utilitaire', 'camion', 'moto', 'bus', 'velo_electrique', 'camping_car',
  'remorque', 'tracteur_routier', 'semi_remorque', 'agricole', 'engin_chantier', 'chariot_elevateur'] as const;
export const bodyTypes = ['berline', 'citadine', 'break', 'monospace', 'suv', 'coupe', 'cabriolet', 'pickup', 'fourgon', 'autre'] as const;
export const origins = ['occasion_madagascar', 'import_europe', 'import_asie', 'import_autre'] as const;
export const customsStatuses = ['dedouane', 'non_dedouane', 'en_cours'] as const;
export const conditions = ['neuf', 'occasion', 'accidente'] as const;

export const profileSchema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  phone: mgPhone.optional(),
  city_id: z.coerce.number().int().positive().optional(),
});

export const registerSchema = profileSchema
  .extend({
    email: z.email('Adresse e-mail invalide').transform((v) => v.toLowerCase()),
    password: z.string().min(8, '8 caractères minimum'),
    role: z.enum(['particulier', 'professionnel']).default('particulier'),
    company_name: z.string().trim().min(2).max(160).optional(),
    nif: z.string().trim().max(20).optional(),
    stat: z.string().trim().max(30).optional(),
  })
  .refine((v) => v.role !== 'professionnel' || v.company_name, {
    path: ['company_name'],
    message: 'Raison sociale obligatoire pour un compte professionnel',
  });

export const loginSchema = z.object({
  email: z.email().transform((v) => v.toLowerCase()),
  password: z.string().min(1),
});

const optionalInt = (min: number, max: number) => z.coerce.number().int().min(min).max(max).optional();

/** Corps d'une annonce (multipart : tous les champs arrivent en texte). */
export const adSchema = z.object({
  brand_id: z.coerce.number().int().positive(),
  model_id: z.coerce.number().int().positive(),
  version: z.string().trim().max(120).optional(),
  category: z.enum(categories).default('voiture'),
  body: z.enum(bodyTypes).optional(),
  year: z.coerce.number().int().min(1950).max(new Date().getFullYear() + 1),
  mileage_km: z.coerce.number().int().min(0).max(2_000_000),
  fuel: z.enum(fuelTypes),
  gearbox: z.enum(gearboxes),
  drive: z.enum(['2x4', '4x4', 'awd']).optional(),
  power_hp: optionalInt(1, 2000),
  engine_cc: optionalInt(50, 20000),
  doors: optionalInt(1, 6),
  seats: optionalInt(1, 60),
  exterior_color: z.string().trim().max(40).optional(),
  condition: z.enum(conditions).default('occasion'),
  origin: z.enum(origins),
  customs: z.enum(customsStatuses),
  previous_owners: optionalInt(0, 30),
  vin: z.string().trim().length(17).optional(),
  equipment: z
    .union([z.array(z.coerce.number().int()), z.coerce.number().int()])
    .transform((v) => (Array.isArray(v) ? v : [v]))
    .default([]),

  title: z.string().trim().min(5).max(140),
  description: z.string().trim().max(10_000).optional(),
  price_mga: z.coerce.number().int().min(100_000, 'Prix minimum : 100 000 Ar').max(50_000_000_000),
  price_negotiable: z.stringbool().default(false),
  city_id: z.coerce.number().int().positive(),
  show_phone: z.stringbool().default(true),
  contact_phone: mgPhone.optional(),
  whatsapp: z.stringbool().default(false),
});
export type AdInput = z.infer<typeof adSchema>;

const csv = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .transform((v) => v.split(',').filter(Boolean))
    .pipe(z.array(z.enum(values)))
    .optional();

export const searchSchema = z.object({
  q: z.string().trim().max(100).optional(),
  brand_id: z.coerce.number().int().positive().optional(),
  model_id: z.coerce.number().int().positive().optional(),
  category: csv(categories),
  price_min: z.coerce.number().int().min(0).optional(),
  price_max: z.coerce.number().int().min(0).optional(),
  year_min: z.coerce.number().int().optional(),
  year_max: z.coerce.number().int().optional(),
  km_max: z.coerce.number().int().min(0).optional(),
  fuel: csv(fuelTypes),
  gearbox: csv(gearboxes),
  origin: csv(origins),
  customs: csv(customsStatuses),
  province_id: z.coerce.number().int().positive().optional(),
  city_id: z.coerce.number().int().positive().optional(),
  seller_type: z.enum(['particulier', 'professionnel']).optional(),
  sort: z.enum(['pertinence', 'prix_asc', 'prix_desc', 'recent', 'km_asc', 'annee_desc']).default('pertinence'),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(50).default(20),
});
export type SearchInput = z.infer<typeof searchSchema>;

export const messageSchema = z.object({ body: z.string().trim().min(1).max(4000) });

/**
 * Moyen de paiement choisi. Sans `method`, on suppose du Mobile Money (compatibilité des premiers clients).
 * Carte et PayPal n'ont besoin d'aucune donnée ici : tout se saisit sur la page hébergée de Stripe ou PayPal.
 */
export const paymentStartSchema = z.preprocess(
  (v) => (v && typeof v === 'object' && !('method' in v) ? { ...v, method: 'mobile_money' } : v),
  z.discriminatedUnion('method', [
    z.object({ method: z.literal('mobile_money'), provider: z.enum(['mvola', 'orange_money', 'airtel_money']), payer_msisdn: mgPhone }),
    z.object({ method: z.literal('carte') }),
    z.object({ method: z.literal('paypal') }),
  ]),
);
export type PaymentStart = z.infer<typeof paymentStartSchema>;

export const planCodeSchema = z.object({ plan_code: z.string() });
