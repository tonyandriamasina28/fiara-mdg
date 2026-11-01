import type { Metadata } from 'next';
import { getDict } from '@/i18n/server';
import { apiAuth, requireUser } from '@/lib/session';
import { IdentityForm, type VerificationState } from './identity-form';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).verify.metaTitle };
}

export default async function VerificationPage() {
  const user = await requireUser('/compte/verification');
  const [t, state] = await Promise.all([getDict(), apiAuth<VerificationState>('/verifications/me')]);
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight">{t.verify.title}</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">{t.verify.intro}</p>
      <div className="mt-6">
        <IdentityForm initial={state} defaultName={`${user.first_name} ${user.last_name}`.toUpperCase()} />
      </div>
    </div>
  );
}
