'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BadgeCheck, Pause, Pencil, Play, Send, Trash2 } from 'lucide-react';
import { useDict } from '@/i18n/client';
import { bff } from '@/lib/bff';

type Action = 'suspend' | 'reactivate' | 'resubmit' | 'markSold' | 'delete';

/** Mêmes transitions que l'API (PATCH /ads/:id/status) : pas de bouton qui finirait en erreur. */
const ACTIONS_BY_STATUS: Record<string, Action[]> = {
  active: ['suspend', 'markSold', 'delete'],
  suspendue: ['reactivate', 'markSold', 'delete'],
  en_attente: ['delete'],
  brouillon: ['resubmit', 'delete'],
  expiree: ['resubmit', 'delete'],
  vendue: ['delete'],
};
const TARGET: Partial<Record<Action, string>> = { suspend: 'suspendue', reactivate: 'active', resubmit: 'en_attente', markSold: 'vendue' };
const ICONS = { suspend: Pause, reactivate: Play, resubmit: Send, markSold: BadgeCheck, delete: Trash2 };

export function AdActions({ adId, status }: { adId: number; status: string }) {
  const t = useDict();
  const m = t.manage;
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState('');

  const run = async (action: Action) => {
    if (action === 'markSold' && !window.confirm(m.confirmSold)) return;
    if (action === 'delete' && !window.confirm(m.confirmDelete)) return;
    setBusy(action);
    setError('');
    try {
      if (action === 'delete') await bff(`/ads/${adId}`, { method: 'DELETE' });
      else await bff(`/ads/${adId}/status`, { method: 'PATCH', json: { status: TARGET[action] } });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const actions = ACTIONS_BY_STATUS[status] ?? ['delete'];
  const btn = 'inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-2.5 text-sm font-semibold transition-colors disabled:opacity-50';

  return (
    <div role="group" aria-label={m.menu} className="flex flex-wrap items-center gap-1.5">
      {status !== 'vendue' && (
        <Link href={`/compte/annonces/${adId}`} className={`${btn} text-ink hover:border-brand hover:text-brand-ink`}>
          <Pencil className="size-4" aria-hidden /> {m.edit}
        </Link>
      )}
      {actions.map((action) => {
        const Icon = ICONS[action];
        return (
          <button
            key={action}
            type="button"
            onClick={() => run(action)}
            disabled={busy !== null}
            className={`${btn} ${action === 'delete' ? 'text-danger hover:border-danger hover:bg-danger-tint' : 'text-ink-soft hover:border-line-strong hover:text-ink'}`}
            aria-label={action === 'delete' ? m.delete : undefined}
            title={m[action]}
          >
            <Icon className="size-4" aria-hidden />
            <span className={action === 'delete' ? 'sr-only sm:not-sr-only' : ''}>{busy === action ? t.common.loading : m[action]}</span>
          </button>
        );
      })}
      {error && <p role="alert" className="w-full text-sm text-danger">{error}</p>}
    </div>
  );
}
