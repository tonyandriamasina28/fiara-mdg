'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { fmt } from '@/i18n';
import { useDict } from '@/i18n/client';

interface Props {
  latitude: number;
  longitude: number;
  city: string;
  /** Vrai pour un showroom pro géolocalisé ; faux = zone approximative (particulier) */
  precise: boolean;
  siteName?: string | null;
  siteAddress?: string | null;
}

/**
 * Tuiles : OpenStreetMap par défaut (aucune clé). Pour un trafic soutenu, la politique d'usage d'OSM
 * impose un fournisseur (MapTiler, Stadia, Thunderforest…) ou un serveur de tuiles à soi :
 * NEXT_PUBLIC_MAP_TILE_URL et NEXT_PUBLIC_MAP_ATTRIBUTION suffisent à basculer.
 */
const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const APPROX_RADIUS_M = 1500;

// Épingle orange en SVG : pas d'image externe à héberger
const PIN_SVG = `<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M17 1C8.2 1 1 8 1 16.7 1 28.5 17 43 17 43s16-14.5 16-26.3C33 8 25.8 1 17 1Z" fill="#E87524" stroke="#0B2233" stroke-width="1.5"/>
  <circle cx="17" cy="16.5" r="6" fill="#0B2233"/></svg>`;

/** Carte « Localisation du vendeur » — Leaflet chargé seulement quand l'encadré devient visible. */
export function SellerMap({ latitude, longitude, city, precise, siteName, siteAddress }: Props) {
  const t = useDict();
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    let map: import('leaflet').Map | undefined;
    let cancelled = false;

    const init = async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !container.current) return;
      map = L.map(container.current, { scrollWheelZoom: false, attributionControl: true }).setView([latitude, longitude], precise ? 15 : 13);
      L.tileLayer(TILE_URL, { maxZoom: 18, attribution: ATTRIBUTION }).addTo(map);

      if (!precise) {
        L.circle([latitude, longitude], { radius: APPROX_RADIUS_M, color: '#E87524', weight: 1.5, fillColor: '#E87524', fillOpacity: 0.12 }).addTo(map);
      }
      const icon = L.divIcon({ html: PIN_SVG, className: 'fiara-pin', iconSize: [34, 44], iconAnchor: [17, 43], popupAnchor: [0, -38] });
      L.marker([latitude, longitude], { icon, keyboard: true, title: t.ad.sellerLocation })
        .addTo(map)
        .bindPopup(`<strong>${t.ad.sellerLocation}</strong><br>${precise && siteName ? siteName : city}`);
      setReady(true);
    };

    // Chargement différé : la bibliothèque (~40 ko gzip) et les tuiles ne sont téléchargées qu'à l'affichage
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        init();
      }
    }, { rootMargin: '200px' });
    io.observe(el);

    return () => {
      cancelled = true;
      io.disconnect();
      map?.remove();
    };
  }, [latitude, longitude, precise, city, siteName, t.ad.sellerLocation]);

  const directions = `https://www.openstreetmap.org/directions?to=${latitude}%2C${longitude}`;

  return (
    <section aria-labelledby="seller-map-title" className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
        <h2 id="seller-map-title" className="flex items-center gap-2 text-lg font-extrabold">
          <MapPin className="size-5 text-action-ink" aria-hidden /> {t.ad.sellerLocation}
        </h2>
        <a href={directions} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm font-bold text-brand-ink hover:underline">
          <Navigation className="size-4" aria-hidden /> {t.ad.mapDirections}
        </a>
      </div>
      <div className="relative mx-3 overflow-hidden rounded-lg border border-line">
        <div ref={container} className="h-64 w-full sm:h-72" role="region" aria-label={`${t.ad.sellerLocation} : ${city}`} />
        {!ready && <p className="absolute inset-0 grid place-items-center bg-paper text-sm text-ink-faint">{t.ad.mapLoading}</p>}
      </div>
      <p className="px-5 py-3 text-sm text-ink-soft">
        {precise && siteName ? fmt(t.ad.mapShowroom, { site: siteName, address: siteAddress ?? city }) : fmt(t.ad.mapApprox, { city })}
      </p>
    </section>
  );
}
