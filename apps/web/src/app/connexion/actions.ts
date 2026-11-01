'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { SESSION_COOKIE } from '@/lib/session';

export interface AuthState {
  error?: string;
  fields?: Record<string, string>;
}

const safeReturn = (v: FormDataEntryValue | null) => {
  const s = typeof v === 'string' ? v : '';
  return s.startsWith('/') && !s.startsWith('//') ? s : '/compte';
};

async function openSession(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

async function call(path: string, payload: unknown): Promise<{ token?: string } & AuthState> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      error: body.error ?? 'Erreur',
      fields: Object.fromEntries((body.fields ?? []).map((f: { path: string; message: string }) => [f.path, f.message])),
    };
  }
  return { token: body.token };
}

export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  const result = await call('/auth/login', { email: form.get('email'), password: form.get('password') });
  if (!result.token) return result;
  await openSession(result.token);
  redirect(safeReturn(form.get('suite')));
}

export async function register(_: AuthState, form: FormData): Promise<AuthState> {
  const role = form.get('role') === 'professionnel' ? 'professionnel' : 'particulier';
  const optional = (k: string) => {
    const v = String(form.get(k) ?? '').trim();
    return v === '' ? undefined : v;
  };
  const result = await call('/auth/register', {
    email: form.get('email'),
    password: form.get('password'),
    first_name: form.get('first_name'),
    last_name: form.get('last_name'),
    phone: optional('phone'),
    city_id: optional('city_id'),
    role,
    company_name: role === 'professionnel' ? optional('company_name') : undefined,
    nif: role === 'professionnel' ? optional('nif') : undefined,
    stat: role === 'professionnel' ? optional('stat') : undefined,
  });
  if (!result.token) return result;
  await openSession(result.token);
  redirect(role === 'professionnel' ? '/pro/tarifs' : safeReturn(form.get('suite')));
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/');
}
