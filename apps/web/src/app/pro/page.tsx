import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, BadgeCheck } from 'lucide-react';
import { fmt, intlLocale } from '@/i18n';
import { getDict, getLocale } from '@/i18n/server';
import { api, ApiError } from '@/lib/api';
import type { Plan, ProContext } from '@/lib/pro';
import { apiAuth, requireUser } from '@/lib/session';
import { ProDashboard } from './pro-dashboard';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).pro.metaTitle };
}

export default async function ProPage() {
  await requireUser('/pro');
  let ctx: ProContext;
  try {
    ctx = await apiAuth<ProContext>('/pro/me');
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) redirect('/pro/tarifs');
    throw err;
  }
  const [t, locale, plans] = await Promise.all([getDict(), getLocale(), api<Plan[]>('/pro/plans', { revalidate: 300 })]);
  const sub = ctx.subscription;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight">
            {ctx.company.company_name}
            {ctx.company.is_verified && <BadgeCheck className="size-6 text-brand-ink" aria-label={t.ad.verifiedPro} />}
          </h1>
          <p className="mt-1 text-ink-soft">{t.pro.title} · {t.pro.teamTab.roles[ctx.role]}</p>
        </div>
        {sub ? (
          <div className="card flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 text-sm">
            <div>
              <p className="font-extrabold text-brand-ink">{fmt(t.pro.plan, { plan: sub.plan_name })}</p>
              <p className="text-ink-soft">{fmt(t.pro.until, { date: new Date(sub.ends_at).toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'long', year: 'numeric' }) })}</p>
            </div>
            <p className="tabular font-semibold">{fmt(t.pro.usageAds, { n: ctx.usage.active_ads, max: sub.max_active_ads })}</p>
            <p className="tabular font-semibold">{fmt(t.pro.usageTeam, { n: ctx.usage.team, max: sub.max_sales_contacts })}</p>
            {ctx.role === 'proprietaire' && <Link href="/pro/tarifs" className="font-bold text-brand-ink hover:underline">{t.pro.changePlan}</Link>}
          </div>
        ) : null}
      </div>

      {!sub ? (
        <div className="card mt-8 flex flex-col items-start gap-4 border-action p-6 sm:flex-row sm:items-center">
          <AlertTriangle className="size-8 shrink-0 text-action-ink" aria-hidden />
          <div className="flex-1">
            <h2 className="text-lg font-extrabold">{t.pro.noPlan}</h2>
            <p className="text-ink-soft">{t.pro.noPlanText}</p>
          </div>
          <Link href="/pro/tarifs" className="btn-primary">{t.pro.choosePlan}</Link>
        </div>
      ) : (
        <ProDashboard ctx={ctx} plans={plans} />
      )}
    </div>
  );
}
