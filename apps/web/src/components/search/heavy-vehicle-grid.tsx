'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useDict } from '@/i18n/client';
import { HEAVY_CATEGORIES } from '@/lib/format';
import { HEAVY_ICONS } from './heavy-vehicle-icons';

/** Panneau « Camion & utilitaires » : grille de sous-catégories, chacune ouvre la recherche filtrée. */
export function HeavyVehicleGrid() {
  const t = useDict();
  return (
    <div>
      <h2 className="sr-only">{t.search.heavyTitle}</h2>
      <ul className="grid grid-cols-2 border-l border-t border-line sm:grid-cols-3 lg:grid-cols-5">
        {HEAVY_CATEGORIES.map((cat) => {
          const Icon = HEAVY_ICONS[cat];
          return (
            <li key={cat} className="border-b border-r border-line">
              <Link
                href={`/recherche?category=${cat}`}
                className="group flex h-full min-h-28 flex-col items-center justify-center gap-2.5 px-2 py-4 text-center transition-colors hover:bg-paper"
              >
                <span className="text-action transition-transform duration-200 group-hover:-translate-y-0.5">
                  <Icon className="size-10" strokeWidth={1.5} />
                </span>
                <span className="text-sm font-semibold leading-tight text-ink">{t.search.heavy[cat]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link href={`/recherche?category=${HEAVY_CATEGORIES.join(',')}`} className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-brand-ink hover:underline">
        {t.search.heavyAll} <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}
