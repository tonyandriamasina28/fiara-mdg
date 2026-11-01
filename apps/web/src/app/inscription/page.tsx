import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthForms } from '@/app/connexion/auth-forms';
import { getDict } from '@/i18n/server';
import { api, type Province } from '@/lib/api';
import { getSessionUser } from '@/lib/session';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).auth.registerTitle };
}

/** Inscription (particulier ou professionnel) — même formulaire que /connexion, ouvert sur l'onglet création. */
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  const { suite } = await searchParams;
  if (await getSessionUser()) redirect('/compte');
  const provinces = await api<Province[]>('/reference/locations', { revalidate: 3600 });
  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:py-16">
      <AuthForms provinces={provinces} suite={suite ?? ''} initialMode="register" />
    </div>
  );
}
