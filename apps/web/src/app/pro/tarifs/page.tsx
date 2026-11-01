import type { Metadata } from 'next';
import { Check, Minus } from 'lucide-react';
import { fmt } from '@/i18n';
import { getDict } from '@/i18n/server';
import { api } from '@/lib/api';
import { TOOLS, type Plan, type ProContext } from '@/lib/pro';
import { apiAuth, getSessionUser } from '@/lib/session';
import { SubscribeButton } from './subscribe-button';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).pricing.metaTitle };
}

export default async function PricingPage() {
  const [t, plans, user] = await Promise.all([getDict(), api<Plan[]>('/pro/plans', { revalidate: 300 }), getSessionUser()]);
  const ctx = user?.role === 'professionnel' ? await apiAuth<ProContext>('/pro/me').catch(() => null) : null;
  const current = ctx?.subscription?.plan_code;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{t.pricing.title}</h1>
        <p className="mt-3 text-lg text-ink-soft">{t.pricing.subtitle}</p>
      </div>

      <ol className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => {
          const highlighted = plan.code === 'gold';
          const copy = t.pricing.plans[plan.code];
          return (
            <li
              key={plan.code}
              className={`relative flex flex-col rounded-xl border-2 bg-surface p-6 ${highlighted ? 'border-action shadow-[0_16px_40px_-16px_rgb(232_117_36/0.55)]' : 'border-line'}`}
            >
              {highlighted && (
                <span className="absolute -top-3 left-6 rounded-full bg-action px-3 py-0.5 text-xs font-extrabold text-on-action">{t.pricing.recommended}</span>
              )}
              <h2 className="text-xl font-extrabold">
                {plan.name} <span className="font-semibold text-ink-soft">— {copy?.tagline ?? plan.tagline}</span>
              </h2>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="tabular text-3xl font-extrabold tracking-tight text-brand-ink">{new Intl.NumberFormat('fr-FR').format(plan.price_mga ?? 0)}</span>
                <span className="font-bold text-brand-ink">Ar</span>
                <span className="text-sm text-ink-soft">{t.common.perMonth}</span>
              </p>
              <p className="mt-3 min-h-12 text-sm leading-relaxed text-ink-soft">{copy?.text}</p>

              <ul className="mt-5 space-y-2.5 border-t border-line pt-5 text-sm">
                <li className="flex gap-2 font-bold"><Check className="size-4 shrink-0 text-ok" aria-hidden /> {fmt(t.pricing.vehicles, { n: plan.max_active_ads })}</li>
                <li className="flex gap-2"><Check className="size-4 shrink-0 text-ok" aria-hidden /> {t.pricing.visibility[plan.visibility_level]}</li>
                <li className="flex gap-2">
                  <Check className="size-4 shrink-0 text-ok" aria-hidden />
                  {plan.max_sales_contacts ? fmt(t.pricing.contacts, { n: plan.max_sales_contacts }) : t.pricing.contactsNone}
                </li>
                {plan.multi_site && <li className="flex gap-2"><Check className="size-4 shrink-0 text-ok" aria-hidden /> {t.pricing.multiSite}</li>}
                {plan.exclusive_recommendations && <li className="flex gap-2"><Check className="size-4 shrink-0 text-ok" aria-hidden /> {t.pricing.recommendations}</li>}
              </ul>

              <div className="mt-auto pt-6">
                {current === plan.code ? (
                  <p className="flex h-11 items-center justify-center rounded-lg bg-ok-tint font-bold text-ok">{t.pricing.current}</p>
                ) : (
                  <SubscribeButton
                    plan={{ code: plan.code, name: plan.name, price_mga: plan.price_mga ?? 0 }}
                    state={!user ? 'login' : user.role !== 'professionnel' ? 'not_pro' : ctx?.role !== 'proprietaire' ? 'not_owner' : 'ok'}
                    phone={user?.phone ?? null}
                    primary={highlighted}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-6 text-sm text-ink-soft">
        {t.pricing.quote}{' '}
        <a href="mailto:pro@fiara.mg?subject=Devis%20Platinum" className="font-bold text-brand-ink hover:underline">{t.pricing.quoteCta}</a>
      </p>

      <section aria-labelledby="tools-title" className="mt-14">
        <h2 id="tools-title" className="text-2xl font-extrabold tracking-tight">{t.pricing.toolsTitle}</h2>
        <div className="mt-5 overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-left">
                <th scope="col" className="px-4 py-3 font-bold">{t.pricing.tool}</th>
                {plans.map((p) => <th key={p.code} scope="col" className="px-4 py-3 text-center font-bold">{p.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {TOOLS.map((tool) => (
                <tr key={tool} className="border-b border-line last:border-0">
                  <th scope="row" className="px-4 py-3 text-left font-normal">
                    <span className="font-bold">{t.tools[tool].name}</span>
                    <span className="block text-ink-soft">{t.tools[tool].text}</span>
                  </th>
                  {plans.map((p) => {
                    const a = p.tools[tool];
                    return (
                      <td key={p.code} className="px-4 py-3 text-center">
                        {a ? (
                          <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${a.access === 'complet' ? 'bg-ok-tint text-ok' : 'bg-brand-tint text-brand-ink'}`}>
                            {t.pricing.access[a.access]}
                            {a.monthly_quota ? ` · ${fmt(t.pricing.quota, { n: a.monthly_quota })}` : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-ink-faint"><Minus className="size-4" aria-hidden /><span className="sr-only">{t.pricing.access.none}</span></span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
