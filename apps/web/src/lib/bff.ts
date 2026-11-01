import { ApiError } from './api';

/** Appel authentifié depuis le navigateur, via le proxy /bff (le jeton reste côté serveur). */
export async function bff<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(`/bff${path}`, {
    ...rest,
    headers: json !== undefined ? { 'content-type': 'application/json', ...(rest.headers ?? {}) } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? `Erreur ${res.status}`, body.fields, body.details);
  return body as T;
}
