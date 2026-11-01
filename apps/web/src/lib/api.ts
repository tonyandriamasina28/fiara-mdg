/** Client de l'API fiara.mdg (utilisable côté serveur et côté navigateur). */
// Navigateur : URL publique de l'API. Serveur Next : URL interne si fournie (même machine / réseau Docker).
export const API_URL =
  (typeof window === 'undefined' ? process.env.INTERNAL_API_URL : undefined) ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export interface Brand { id: number; name: string; slug: string; is_popular: boolean; ad_count: number }
export interface Model { id: number; name: string; slug: string; category: string }
export interface City { id: number; name: string; common_name: string | null; is_capital: boolean }
export interface Province { id: number; code: string; name: string; common_name: string | null; cities: City[] }

export interface AdSummary {
  id: number;
  title: string;
  price_mga: number;
  price_negotiable: boolean;
  published_at: string;
  is_sponsored: boolean;
  year: number;
  mileage_km: number;
  fuel: string;
  gearbox: string;
  power_hp: number | null;
  category: string;
  origin: string;
  customs: string;
  condition: string;
  brand: string;
  model: string;
  version: string | null;
  city: string;
  province: string;
  seller_type: 'particulier' | 'professionnel';
  company_name: string | null;
  cover_url: string | null;
  photo_count: number;
  seller_verified?: boolean;
}

export interface AdDetail extends AdSummary {
  description: string | null;
  show_phone: boolean;
  whatsapp: boolean;
  views_count: number;
  body: string | null;
  drive: string | null;
  engine_cc: number | null;
  doors: number | null;
  seats: number | null;
  exterior_color: string | null;
  previous_owners: number | null;
  seller_first_name: string;
  seller_since: string;
  dealer_verified: boolean | null;
  photos: { id: number; url: string }[];
  equipment: string[];
}

export interface SearchResult { items: AdSummary[]; total: number; page: number; per_page: number }

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: { path: string; message: string }[],
    public details?: { upgrade?: boolean },
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit & { revalidate?: number }): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    next: init?.revalidate !== undefined ? { revalidate: init.revalidate } : undefined,
    cache: init?.revalidate === undefined ? 'no-store' : undefined,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? `Erreur ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Convertit les paramètres d'URL de la page en query string pour l'API (clés identiques). */
export function toQuery(params: Record<string, string | string[] | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    q.set(k, Array.isArray(v) ? v.join(',') : v);
  }
  return q.toString();
}
