'use client';

import { useState } from 'react';
import { Phone } from 'lucide-react';
import { useDict } from '@/i18n/client';
import { API_URL } from '@/lib/api';
import { formatPhone } from '@/lib/format';

/** Bouton « Afficher le numéro » : le numéro n'est jamais dans le HTML initial (anti-scraping). */
export function PhoneReveal({ adId }: { adId: number }) {
  const t = useDict();
  const [state, setState] = useState<{ phone?: string; error?: string; loading?: boolean }>({});

  if (state.phone) {
    return (
      <a href={`tel:${state.phone}`} className="btn-secondary tabular h-12 w-full text-lg font-extrabold">
        <Phone className="size-5" aria-hidden /> {formatPhone(state.phone)}
      </a>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={state.loading}
        onClick={async () => {
          setState({ loading: true });
          const res = await fetch(`${API_URL}/ads/${adId}/phone`, { method: 'POST' });
          const body = await res.json().catch(() => ({}));
          setState(res.ok ? { phone: body.phone } : { error: body.error ?? t.ad.phoneUnavailable });
        }}
        className="btn-secondary h-12 w-full"
      >
        <Phone className="size-5" aria-hidden />
        {state.loading ? t.ad.showing : t.ad.showPhone}
      </button>
      {state.error && <p role="alert" className="mt-2 text-sm text-ink-soft">{state.error}</p>}
    </div>
  );
}
