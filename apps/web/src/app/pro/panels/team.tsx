'use client';

import { useState } from 'react';
import { MapPin, UserPlus } from 'lucide-react';
import { fmt } from '@/i18n';
import { useDict } from '@/i18n/client';
import { bff } from '@/lib/bff';
import { formatPhone } from '@/lib/format';
import type { ProContext } from '@/lib/pro';
import { PanelState, useProData } from './use-pro-data';

interface Member { id: number; first_name: string; last_name: string; email: string; phone: string | null; role: string }
interface Site { id: number; name: string; city: string; address: string | null; is_main: boolean; active_ads: number }

/** Équipe (interlocuteurs commerciaux, plafonnés par la formule) et sites (multi-sites en Platinum). */
export function TeamPanel({ ctx }: { ctx: ProContext }) {
  const t = useDict();
  const tt = t.pro.teamTab;
  const team = useProData<Member[]>('/pro/team');
  const sites = useProData<Site[]>('/pro/sites');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const max = ctx.subscription?.max_sales_contacts ?? 0;
  const canManage = ctx.role !== 'commercial';

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section aria-labelledby="team-title" className="card p-5">
        <h2 id="team-title" className="flex items-baseline justify-between gap-2 text-lg font-extrabold">
          {tt.members}
          <span className="tabular text-sm font-semibold text-ink-soft">{fmt(t.pro.usageTeam, { n: ctx.usage.team, max })}</span>
        </h2>
        <PanelState loading={team.loading} error={team.error}>
          <ul className="mt-4 divide-y divide-line">
            {team.data?.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold">{m.first_name} {m.last_name}</p>
                  <p className="truncate text-ink-soft">{m.email}{m.phone ? ` · ${formatPhone(m.phone)}` : ''}</p>
                </div>
                <span className="shrink-0 rounded bg-paper px-2 py-0.5 text-xs font-bold text-ink-soft">{tt.roles[m.role]}</span>
              </li>
            ))}
          </ul>
        </PanelState>
        {canManage && ctx.usage.team < max && (
          <form
            className="mt-4 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setError('');
              try {
                await bff('/pro/team', { method: 'POST', json: { email } });
                setEmail('');
                team.reload();
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            <label htmlFor="team-email" className="sr-only">{tt.email}</label>
            <input id="team-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={tt.email} className="field" />
            <button type="submit" className="btn-secondary shrink-0"><UserPlus className="size-4" aria-hidden /> {tt.add}</button>
          </form>
        )}
        {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      </section>

      <section aria-labelledby="sites-title" className="card p-5">
        <h2 id="sites-title" className="text-lg font-extrabold">{tt.sites}</h2>
        <PanelState loading={sites.loading} error={sites.error}>
          <ul className="mt-4 space-y-2">
            {sites.data?.map((s) => (
              <li key={s.id} className="flex items-start gap-3 rounded-lg bg-paper p-3 text-sm">
                <MapPin className="mt-0.5 size-4 shrink-0 text-brand-ink" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{s.name} {s.is_main && <span className="ml-1 rounded bg-brand-tint px-1.5 text-xs text-brand-ink">{tt.main}</span>}</p>
                  <p className="text-ink-soft">{[s.address, s.city].filter(Boolean).join(', ')}</p>
                </div>
              </li>
            ))}
          </ul>
        </PanelState>
        {!ctx.subscription?.multi_site && <p className="mt-3 text-sm text-ink-soft">{tt.multiSiteHint}</p>}
      </section>
    </div>
  );
}
