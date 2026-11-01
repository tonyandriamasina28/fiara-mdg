'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Heart, MessageSquare, Send } from 'lucide-react';
import { useDict } from '@/i18n/client';
import { bff } from '@/lib/bff';

/** Formulaire de premier contact depuis la fiche annonce (messagerie interne). */
export function ContactSeller({ adId, loggedIn }: { adId: number; loggedIn: boolean }) {
  const t = useDict();
  const [body, setBody] = useState(t.ad.contactPlaceholder);
  const [state, setState] = useState<{ sending?: boolean; error?: string; conversationId?: number }>({});

  if (!loggedIn) {
    return (
      <Link href={`/connexion?suite=/annonces/${adId}`} className="btn-primary h-12 w-full">
        <MessageSquare className="size-5" aria-hidden /> {t.ad.contactLogin}
      </Link>
    );
  }

  if (state.conversationId) {
    return (
      <div role="status" className="rounded-lg bg-ok-tint p-3 text-sm text-ok">
        <p className="font-semibold">{t.ad.contactSent}</p>
        <Link href={`/compte/messages?c=${state.conversationId}`} className="mt-1 inline-block font-bold underline">
          {t.ad.openConversation}
        </Link>
      </div>
    );
  }

  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setState({ sending: true });
        try {
          const r = await bff<{ conversation_id: number }>(`/conversations/ads/${adId}`, { method: 'POST', json: { body } });
          setState({ conversationId: r.conversation_id });
        } catch (err) {
          setState({ error: (err as Error).message });
        }
      }}
    >
      <label htmlFor="contact-body" className="text-sm font-bold">{t.ad.contactTitle}</label>
      <textarea id="contact-body" className="field-area min-h-24" value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} required />
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <button type="submit" className="btn-primary h-12 w-full" disabled={state.sending || !body.trim()}>
        <Send className="size-4" aria-hidden /> {state.sending ? t.common.loading : t.common.send}
      </button>
    </form>
  );
}

export function FavoriteButton({ adId, initial, loggedIn }: { adId: number; initial: boolean; loggedIn: boolean }) {
  const t = useDict();
  const [fav, setFav] = useState(initial);
  const [busy, setBusy] = useState(false);
  const label = fav ? t.ad.favoriteRemove : t.ad.favoriteAdd;

  if (!loggedIn) {
    return (
      <Link href={`/connexion?suite=/annonces/${adId}`} className="grid size-11 place-items-center rounded-lg border border-line-strong bg-surface text-ink-soft hover:text-action-ink" aria-label={label} title={label}>
        <Heart className="size-5" aria-hidden />
      </Link>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={fav}
      aria-label={label}
      title={label}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await bff(`/ads/${adId}/favorite`, { method: fav ? 'DELETE' : 'POST' });
          setFav(!fav);
        } finally {
          setBusy(false);
        }
      }}
      className={`grid size-11 place-items-center rounded-lg border bg-surface transition-colors ${fav ? 'border-action text-action-ink' : 'border-line-strong text-ink-soft hover:text-action-ink'}`}
    >
      <Heart className="size-5" fill={fav ? 'currentColor' : 'none'} aria-hidden />
    </button>
  );
}
