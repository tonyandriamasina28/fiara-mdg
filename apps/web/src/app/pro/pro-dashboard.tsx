'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Gauge, Lock, Scale, Send, Sparkles, Users } from 'lucide-react';
import { fmt } from '@/i18n';
import { useDict } from '@/i18n/client';
import { TOOLS, firstPlanWith, type Plan, type ProContext, type ProTool } from '@/lib/pro';
import { DemandPanel } from './panels/demand';
import { LeadsPanel } from './panels/leads';
import { MarketPanel } from './panels/market';
import { OffersPanel } from './panels/offers';
import { QualityPanel } from './panels/quality';
import { TeamPanel } from './panels/team';

type Tab = ProTool | 'team';

const ICONS: Record<Tab, typeof BarChart3> = {
  analyse_demande: BarChart3,
  comparaison_marche: Scale,
  lead_manager: Users,
  offre_directe: Send,
  controle_qualite: Sparkles,
  team: Gauge,
};

/** Onglets des 5 outils pro ; un outil absent de la formule affiche une invitation à monter en gamme. */
export function ProDashboard({ ctx, plans }: { ctx: ProContext; plans: Plan[] }) {
  const t = useDict();
  const [tab, setTab] = useState<Tab>('analyse_demande');

  useEffect(() => {
    const fromHash = window.location.hash.slice(1) as Tab;
    if ([...TOOLS, 'team'].includes(fromHash)) setTab(fromHash);
  }, []);

  const select = (next: Tab) => {
    setTab(next);
    window.history.replaceState(null, '', `#${next}`);
  };

  const tabs: Tab[] = [...TOOLS, 'team'];
  const access = tab === 'team' ? null : ctx.tools[tab];
  const limited = access?.access === 'limite';

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[15rem_1fr]">
      <div role="tablist" aria-label={t.pro.title} aria-orientation="vertical" className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        {tabs.map((id) => {
          const Icon = ICONS[id];
          const locked = id !== 'team' && !ctx.tools[id];
          return (
            <button
              key={id}
              role="tab"
              id={`tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`panel-${id}`}
              onClick={() => select(id)}
              className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                tab === id ? 'bg-brand text-white' : 'text-ink-soft hover:bg-surface hover:text-ink'
              }`}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="flex-1">{id === 'team' ? t.pro.team : t.tools[id].name}</span>
              {locked && <Lock className="size-3.5 shrink-0 opacity-70" aria-label={t.pro.locked} />}
              {id === 'lead_manager' && ctx.usage.new_leads > 0 && (
                <span className="tabular rounded-full bg-action px-1.5 text-xs font-extrabold text-on-action" aria-label={fmt(t.pro.newLeads, { n: ctx.usage.new_leads })}>
                  {ctx.usage.new_leads}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="min-w-0">
        {tab !== 'team' && (
          <header className="mb-5">
            <h2 className="text-2xl font-extrabold tracking-tight">{t.tools[tab].name}</h2>
            <p className="mt-1 text-ink-soft">{t.tools[tab].text}</p>
          </header>
        )}

        {tab !== 'team' && !access ? (
          <div className="card p-8 text-center">
            <Lock className="mx-auto size-10 text-ink-faint" strokeWidth={1.5} aria-hidden />
            <h3 className="mt-3 text-lg font-extrabold">{t.pro.locked}</h3>
            <p className="mt-1 text-ink-soft">{fmt(t.pro.lockedText, { plan: firstPlanWith(plans, tab)?.name ?? 'Gold' })}</p>
            {ctx.role === 'proprietaire' && <Link href="/pro/tarifs" className="btn-primary mt-5">{t.pro.changePlan}</Link>}
          </div>
        ) : (
          <>
            {limited && (
              <p className="mb-4 rounded-lg bg-brand-tint px-4 py-2.5 text-sm text-brand-ink">
                {t.pro.limited}{' '}
                {ctx.role === 'proprietaire' && <Link href="/pro/tarifs" className="font-bold underline">{t.pro.changePlan}</Link>}
              </p>
            )}
            {tab === 'analyse_demande' && <DemandPanel />}
            {tab === 'comparaison_marche' && <MarketPanel />}
            {tab === 'lead_manager' && <LeadsPanel full={access?.access === 'complet'} />}
            {tab === 'offre_directe' && <OffersPanel />}
            {tab === 'controle_qualite' && <QualityPanel />}
            {tab === 'team' && <TeamPanel ctx={ctx} />}
          </>
        )}
      </section>
    </div>
  );
}
