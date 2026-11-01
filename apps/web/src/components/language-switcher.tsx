'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LOCALES } from '@/i18n';
import { useDict, useLocale } from '@/i18n/client';
import { setLocale } from '@/i18n/actions';

/** Commutateur FR / MG : écrit le cookie de langue puis rafraîchit le rendu serveur. */
export function LanguageSwitcher() {
  const current = useLocale();
  const t = useDict();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div role="group" aria-label={t.nav.language} className={`flex rounded-md border border-line p-0.5 ${pending ? 'opacity-60' : ''}`}>
      {LOCALES.map((l) => (
        <button
          key={l.code}
          type="button"
          lang={l.code}
          title={l.label}
          aria-pressed={current === l.code}
          onClick={() =>
            startTransition(async () => {
              await setLocale(l.code);
              router.refresh();
            })
          }
          className={`h-8 min-w-9 rounded px-2 text-xs font-bold transition-colors ${
            current === l.code ? 'bg-brand text-white' : 'text-ink-soft hover:bg-paper hover:text-ink'
          }`}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}
