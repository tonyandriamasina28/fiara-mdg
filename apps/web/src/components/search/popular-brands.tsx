'use client';

import { siAudi, siBmw, siFord, siOpel, siRenault, siSkoda, siTesla, siToyota, siVolkswagen, siVolvo } from 'simple-icons';
import type { Brand } from '@/lib/api';
import { useDict } from '@/i18n/client';

/**
 * Grille « Marques populaires » : uniquement les marques dont on dispose d'un logo net
 * (tracés monochromes « simple-icons », adaptés aux deux thèmes).
 * Mercedes-Benz et Cupra en sont absentes : leurs logos ont été retirés de simple-icons à la demande des marques.
 * Pour les ajouter, récupérer le SVG officiel (kit presse) et ajouter une entrée avec son tracé.
 * Les logos restent la propriété de leurs titulaires : vérifier leurs conditions d'usage avant la mise en ligne.
 */
const POPULAR: { slug: string; name: string; path: string }[] = [
  { slug: 'audi', name: 'Audi', path: siAudi.path },
  { slug: 'bmw', name: 'BMW', path: siBmw.path },
  { slug: 'ford', name: 'Ford', path: siFord.path },
  { slug: 'opel', name: 'Opel', path: siOpel.path },
  { slug: 'renault', name: 'Renault', path: siRenault.path },
  { slug: 'skoda', name: 'Škoda', path: siSkoda.path },
  { slug: 'tesla', name: 'Tesla', path: siTesla.path },
  { slug: 'toyota', name: 'Toyota', path: siToyota.path },
  { slug: 'volvo', name: 'Volvo', path: siVolvo.path },
  { slug: 'volkswagen', name: 'Volkswagen', path: siVolkswagen.path },
];

/** Grille de logos : un clic choisit la marque dans le moteur de recherche. */
export function PopularBrands({ brands, selectedId, onSelect }: { brands: Brand[]; selectedId: string; onSelect: (id: string) => void }) {
  const t = useDict();
  const bySlug = new Map(brands.map((b) => [b.slug, b]));
  const items = POPULAR.filter((p) => bySlug.has(p.slug));

  return (
    // 10 logos : 2 colonnes sur mobile, 5 au-delà → lignes toujours pleines
    <ul className="grid grid-cols-2 border-l border-t border-line sm:grid-cols-5">
      {items.map(({ slug, name, path }) => {
        const brand = bySlug.get(slug)!;
        const active = selectedId === String(brand.id);
        return (
          <li key={slug} className="border-b border-r border-line">
            <button
              type="button"
              onClick={() => onSelect(String(brand.id))}
              aria-pressed={active}
              title={`${t.search.popularBrandsHint} : ${name}`}
              className={`group flex h-full min-h-28 w-full flex-col items-center justify-center gap-2.5 px-2 py-4 transition-colors ${
                active ? 'bg-action-tint text-action-ink' : 'text-ink hover:bg-paper'
              }`}
            >
              <svg viewBox="0 0 24 24" className="size-10 transition-transform duration-200 group-hover:scale-110" fill="currentColor" aria-hidden>
                <path d={path} />
              </svg>
              <span className="text-sm font-bold">{name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
