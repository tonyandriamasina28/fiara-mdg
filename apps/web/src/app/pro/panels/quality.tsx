'use client';

import Link from 'next/link';
import { CheckCircle2, Circle, RefreshCw } from 'lucide-react';
import { useDict } from '@/i18n/client';
import { PanelState, useProData } from './use-pro-data';

interface Quality {
  access: 'limite' | 'complet';
  reports: {
    ad_id: number;
    title: string;
    score: number;
    grade: string;
    checks: { code: string; label: string; passed: boolean }[];
    recommendations: { code: string; advice: string }[];
  }[];
}

const GRADE_TONE: Record<string, string> = {
  excellente: 'text-ok',
  bonne: 'text-brand-ink',
  a_ameliorer: 'text-action-ink',
};

/** Contrôle qualité : score par annonce, critères et recommandations (moteur à règles, IA à venir). */
export function QualityPanel() {
  const t = useDict();
  const q = t.pro.quality;
  const { data, error, loading, reload } = useProData<Quality>('/pro/quality');

  return (
    <PanelState loading={loading} error={error}>
      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">{q.engine}</p>
            <button type="button" className="btn-secondary h-9 text-sm" onClick={reload} disabled={loading}>
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} aria-hidden /> {q.run}
            </button>
          </div>
          {data.access === 'limite' && <p className="text-sm text-ink-soft">{q.limitedHint}</p>}
          <ul className="space-y-3">
            {data.reports.map((r) => (
              <li key={r.ad_id} className="card grid gap-4 p-4 md:grid-cols-[7rem_1fr_1fr]">
                <div className="text-center md:border-r md:border-line md:pr-4">
                  <p className="text-xs font-semibold text-ink-soft">{q.score}</p>
                  <p className={`tabular text-4xl font-extrabold ${GRADE_TONE[r.grade]}`}>{r.score}</p>
                  <p className={`text-sm font-bold ${GRADE_TONE[r.grade]}`}>{q.grades[r.grade]}</p>
                </div>
                <div className="min-w-0">
                  <Link href={`/annonces/${r.ad_id}`} className="block truncate font-bold hover:text-brand-ink">{r.title}</Link>
                  <ul className="mt-2 space-y-1 text-sm">
                    {r.checks.map((c) => (
                      <li key={c.code} className={`flex items-center gap-2 ${c.passed ? 'text-ink' : 'text-ink-soft'}`}>
                        {c.passed ? <CheckCircle2 className="size-4 shrink-0 text-ok" aria-label="OK" /> : <Circle className="size-4 shrink-0 text-line-strong" aria-label="—" />}
                        {q.checks[c.code] ?? c.label}
                      </li>
                    ))}
                  </ul>
                </div>
                {r.recommendations.length > 0 && (
                  <div>
                    <p className="text-sm font-bold">{q.recommendations}</p>
                    <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-ink-soft">
                      {r.recommendations.map((rec) => <li key={rec.code}>{q.advice[rec.code] ?? rec.advice}</li>)}
                    </ol>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </PanelState>
  );
}
