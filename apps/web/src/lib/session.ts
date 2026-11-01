import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { API_URL, ApiError } from './api';

/** Jeton JWT de l'API, gardé dans un cookie httpOnly : jamais lisible par le JavaScript du navigateur. */
export const SESSION_COOKIE = 'fiara_session';

export interface SessionUser {
  id: number;
  email: string;
  role: 'particulier' | 'professionnel' | 'admin';
  first_name: string;
  last_name: string;
  phone: string | null;
  company_name: string | null;
  created_at: string;
}

export async function getToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** Appel API côté serveur avec le jeton de l'utilisateur connecté. */
export async function apiAuth<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: { ...(init?.headers ?? {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? `Erreur ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!(await getToken())) return null;
  try {
    return await apiAuth<SessionUser>('/auth/me');
  } catch {
    return null;
  }
});

/** Redirige vers la connexion (avec retour) si personne n'est connecté. */
export async function requireUser(returnTo: string) {
  const user = await getSessionUser();
  if (!user) redirect(`/connexion?suite=${encodeURIComponent(returnTo)}`);
  return user;
}
