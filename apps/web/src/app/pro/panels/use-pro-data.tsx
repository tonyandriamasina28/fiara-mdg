'use client';

import { useCallback, useEffect, useState } from 'react';
import { bff } from '@/lib/bff';

/** Charge une ressource /pro/… et expose un rechargement. */
export function useProData<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError('');
    try {
      setData(await bff<T>(path));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload };
}

export function PanelState({ loading, error, children }: { loading: boolean; error: string; children: React.ReactNode }) {
  if (error) return <p role="alert" className="rounded-lg bg-danger-tint p-4 text-sm text-danger">{error}</p>;
  if (loading && !children) return <div className="card h-48 animate-pulse" />;
  return <>{children}</>;
}
