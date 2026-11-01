import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { API_URL } from '@/lib/api';
import { SESSION_COOKIE } from '@/lib/session';

/**
 * Proxy « backend for frontend » : le navigateur appelle /bff/…, Next ajoute le jeton
 * du cookie httpOnly et relaie vers l'API (JSON comme multipart pour les photos).
 */
async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const target = `${API_URL}/${path.map(encodeURIComponent).join('/')}${req.nextUrl.search}`;

  const headers = new Headers();
  const contentType = req.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  if (token) headers.set('authorization', `Bearer ${token}`);
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) headers.set('x-forwarded-for', forwardedFor);

  const hasBody = !['GET', 'HEAD'].includes(req.method);
  const res = await fetch(target, {
    method: req.method,
    headers,
    body: hasBody ? req.body : undefined,
    // Nécessaire pour relayer un corps en flux (upload de photos)
    ...(hasBody ? { duplex: 'half' } : {}),
    cache: 'no-store',
  } as RequestInit);

  return new Response(res.status === 204 ? null : res.body, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as PUT, proxy as DELETE };
