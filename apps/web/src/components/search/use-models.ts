'use client';

import { useEffect, useState } from 'react';
import { API_URL, type Brand, type Model } from '@/lib/api';

/** Charge les modèles de la marque choisie (dépendance Marque > Modèle), filtrés par catégorie si fournie. */
export function useModels(brandId: string, category = '') {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!brandId) {
      setModels([]);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`${API_URL}/reference/brands/${brandId}/models${category ? `?category=${category}` : ''}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then(setModels)
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [brandId, category]);

  return { models, loading };
}

/** Marques proposées pour un type de véhicule (rechargées quand le type change). */
export function useBrands(initial: Brand[], category: string) {
  const [brands, setBrands] = useState(initial);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`${API_URL}/reference/brands?category=${category}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then(setBrands)
      .catch(() => {});
    return () => ctrl.abort();
  }, [category]);
  return brands;
}

/** Nombre d'annonces correspondant aux critères, recalculé 250 ms après la dernière modification. */
export function useLiveCount(query: string) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`${API_URL}/ads/count?${query}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d) => setCount(d.total))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  return count;
}
