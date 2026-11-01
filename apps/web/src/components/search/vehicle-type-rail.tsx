'use client';

import { useRef } from 'react';
import { Car, Caravan, Motorbike, Truck } from 'lucide-react';
import { HEAVY_CATEGORIES } from '@/lib/format';
import { useDict } from '@/i18n/client';

/** Chaque type de véhicule correspond à un ensemble de catégories de la base. */
export const VEHICLE_TYPES = [
  { id: 'voiture', Icon: Car, categories: 'voiture,suv_4x4,pickup' },
  { id: 'moto', Icon: Motorbike, categories: 'moto' },
  { id: 'camping_car', Icon: Caravan, categories: 'camping_car' },
  { id: 'camion', Icon: Truck, categories: HEAVY_CATEGORIES.join(',') },
] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number]['id'];

/**
 * Barre verticale sur fond sombre (dans les deux thèmes), icônes à traits fins :
 * type actif en orange, autres en gris. Groupe radio accessible au clavier (flèches haut / bas).
 */
export function VehicleTypeRail({ value, onChange }: { value: VehicleType; onChange: (v: VehicleType) => void }) {
  const t = useDict();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (from: number, delta: number) => {
    const next = (from + delta + VEHICLE_TYPES.length) % VEHICLE_TYPES.length;
    onChange(VEHICLE_TYPES[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={t.search.vehicleType}
      aria-orientation="vertical"
      className="flex shrink-0 flex-col self-stretch overflow-hidden rounded-l-[inherit] bg-brand-deep dark:bg-[#0e0e10]"
    >
      {VEHICLE_TYPES.map(({ id, Icon }, i) => {
        const active = value === id;
        const label = t.search.vehicles[id];
        return (
          <button
            key={id}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); move(i, 1); }
              if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); move(i, -1); }
            }}
            className={`group relative grid h-14 w-14 place-items-center border-b border-white/[0.07] transition-colors last:border-b-0 sm:h-16 sm:w-16 ${
              active ? 'bg-white/[0.06] text-action' : 'text-white/40 hover:bg-white/[0.04] hover:text-white/75'
            }`}
          >
            <span className={`absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-action transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`} aria-hidden />
            <Icon className="size-7 transition-transform duration-200 group-active:scale-90" strokeWidth={1.4} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
