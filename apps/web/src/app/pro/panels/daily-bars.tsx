'use client';

import { useState } from 'react';
import { intlLocale } from '@/i18n';
import { useLocale } from '@/i18n/client';

/**
 * Histogramme d'une seule série sur 30 jours (une échelle, pas de double axe).
 * Barres fines arrondies en haut, 2 px d'écart, zone de survol plus large que la barre.
 */
export function DailyBars({ title, data, color, valueLabel }: { title: string; data: { day: string; value: number }[]; color: string; valueLabel: string }) {
  const locale = useLocale();
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = 140;
  const pad = { top: 8, bottom: 22, left: 0, right: 0 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = (W - pad.left - pad.right) / data.length;
  const barW = Math.max(2, step - 2);
  const y = (v: number) => pad.top + (H - pad.top - pad.bottom) * (1 - v / max);
  const day = (iso: string) => new Date(iso).toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'short' });
  const total = data.reduce((s, d) => s + d.value, 0);
  const active = hover != null ? data[hover] : null;

  return (
    <figure className="card p-4">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold">{title}</span>
        <span className="tabular text-sm text-ink-soft" aria-live="polite">
          {active ? `${day(active.day)} · ${active.value} ${valueLabel}` : `${total} ${valueLabel}`}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-auto w-full" role="img" aria-label={`${title} : ${total} ${valueLabel}`} onMouseLeave={() => setHover(null)}>
        <line x1={0} x2={W} y1={H - pad.bottom} y2={H - pad.bottom} stroke="var(--color-line-strong)" strokeWidth={1} />
        {data.map((d, i) => {
          const x = pad.left + i * step + 1;
          const top = y(d.value);
          const h = H - pad.bottom - top;
          const r = Math.min(4, barW / 2, h);
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={-1}>
              <rect x={pad.left + i * step} y={0} width={step} height={H - pad.bottom} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x},${H - pad.bottom} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${H - pad.bottom} Z`}
                  fill={color}
                  opacity={hover == null || hover === i ? 1 : 0.45}
                />
              )}
            </g>
          );
        })}
        {[0, Math.floor(data.length / 2), data.length - 1].map((i) =>
          data[i] ? (
            <text key={i} x={pad.left + i * step + step / 2} y={H - 6} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} fontSize={11} fill="var(--color-ink-faint)">
              {day(data[i].day)}
            </text>
          ) : null,
        )}
      </svg>
    </figure>
  );
}
