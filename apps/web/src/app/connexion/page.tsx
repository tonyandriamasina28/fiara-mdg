import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getDict } from '@/i18n/server';
import { api, type Province } from '@/lib/api';
import { getSessionUser } from '@/lib/session';
import { AuthForms } from './auth-forms';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).auth.loginTitle };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ suite?: string; mode?: string }> }) {
  const { suite, mode } = await searchParams;
  if (await getSessionUser()) redirect(suite?.startsWith('/') ? suite : '/compte');
  const provinces = await api<Province[]>('/reference/locations', { revalidate: 3600 });

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:py-16">
      <AuthForms provinces={provinces} suite={suite ?? ''} initialMode={mode === 'inscription' ? 'register' : 'login'} />
    </div>
  );
}
