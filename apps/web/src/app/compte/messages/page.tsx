import type { Metadata } from 'next';
import { getDict } from '@/i18n/server';
import { requireUser } from '@/lib/session';
import { Messenger } from './messenger';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).messages.title };
}

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const [{ c }, user] = await Promise.all([searchParams, requireUser('/compte/messages')]);
  return (
    <div className="mx-auto max-w-6xl px-2 py-3 sm:px-6 md:py-6">
      <Messenger userId={user.id} initialId={c ? Number(c) : null} />
    </div>
  );
}
