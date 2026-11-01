import { Bus, Forklift, Tractor, Truck, Van } from 'lucide-react';

/**
 * Icônes des sous-catégories poids lourds. Lucide couvre camion, fourgon, bus, tracteur et chariot ;
 * les quatre manquantes sont dessinées dans la même grille (24 × 24, trait arrondi, currentColor).
 */
type IconProps = { className?: string; strokeWidth?: number };

function Svg({ className, strokeWidth = 1.5, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {children}
    </svg>
  );
}

/** Remorque : plateau bâché, timon et un essieu */
export function TrailerIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="5" y="6" width="17" height="9" rx="1" />
      <path d="M5 13H1.5" />
      <circle cx="14" cy="17.5" r="2" />
    </Svg>
  );
}

/** Tracteur routier : cabine + châssis nu avec sellette */
export function TractorUnitIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M14 15V6h4.5l3 4.5V15" />
      <path d="M14 10.5h7.5" />
      <path d="M2 15h20" />
      <path d="M5 13h5" />
      <circle cx="6" cy="17.5" r="2" />
      <circle cx="18" cy="17.5" r="2" />
    </Svg>
  );
}

/** Semi-remorque : long caisson sur essieux arrière, avant posé sur béquille */
export function SemiTrailerIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="1.5" y="6" width="21" height="8" rx="1" />
      <path d="M5 14v3" />
      <circle cx="16" cy="17" r="1.8" />
      <circle cx="20" cy="17" r="1.8" />
    </Svg>
  );
}

/** Engin de chantier : pelleteuse sur chenilles, flèche et godet */
export function ExcavatorIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="2" y="16" width="13" height="4" rx="2" />
      <path d="M4 16v-4h6l1 4" />
      <path d="M10 12l5-7 5 4" />
      <path d="M20 9v4l-2.5 1" />
    </Svg>
  );
}

export const HEAVY_ICONS: Record<string, (p: IconProps) => React.ReactNode> = {
  camion: (p) => <Truck {...p} />,
  remorque: TrailerIcon,
  utilitaire: (p) => <Van {...p} />,
  tracteur_routier: TractorUnitIcon,
  semi_remorque: SemiTrailerIcon,
  bus: (p) => <Bus {...p} />,
  agricole: (p) => <Tractor {...p} />,
  engin_chantier: ExcavatorIcon,
  chariot_elevateur: (p) => <Forklift {...p} />,
};
