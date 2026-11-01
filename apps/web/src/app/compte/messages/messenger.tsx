'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Car, MessageSquare, Send } from 'lucide-react';
import { fmt, intlLocale } from '@/i18n';
import { useDict, useLocale } from '@/i18n/client';
import { bff } from '@/lib/bff';
import { formatMGA } from '@/lib/format';

interface ConversationSummary {
  id: number;
  ad_id: number;
  ad_title: string;
  price_mga: number;
  cover_url: string | null;
  side: 'achat' | 'vente';
  other_name: string;
  last_message: string | null;
  last_message_at: string;
  unread: number;
}

interface Message { id: number; sender_id: number; body: string; created_at: string; read_at: string | null; mine: boolean }
interface Thread extends Omit<ConversationSummary, 'last_message' | 'last_message_at' | 'unread'> { messages: Message[] }

const POLL_MS = 5000;

/**
 * Messagerie acheteur ↔ vendeur. Rafraîchissement par interrogation toutes les 5 s
 * (à remplacer par WebSocket / SSE quand le trafic le justifiera).
 */
export function Messenger({ initialId }: { userId: number; initialId: number | null }) {
  const t = useDict();
  const locale = useLocale();
  const [list, setList] = useState<ConversationSummary[] | null>(null);
  const [activeId, setActiveId] = useState<number | null>(initialId);
  const [thread, setThread] = useState<Thread | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottom = useRef<HTMLDivElement>(null);

  const time = (iso: string) => {
    const d = new Date(iso);
    const sameDay = d.toDateString() === new Date().toDateString();
    return d.toLocaleString(intlLocale(locale), sameDay ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const loadList = useCallback(() => bff<ConversationSummary[]>('/conversations').then(setList).catch(() => setList([])), []);
  const loadThread = useCallback((id: number) => bff<Thread>(`/conversations/${id}`).then(setThread).catch(() => setThread(null)), []);

  useEffect(() => {
    loadList();
    const timer = setInterval(loadList, POLL_MS);
    return () => clearInterval(timer);
  }, [loadList]);

  useEffect(() => {
    if (!activeId) return setThread(null);
    loadThread(activeId).then(loadList);
    const timer = setInterval(() => loadThread(activeId), POLL_MS);
    const url = new URL(window.location.href);
    url.searchParams.set('c', String(activeId));
    window.history.replaceState(null, '', url);
    return () => clearInterval(timer);
  }, [activeId, loadThread, loadList]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [thread?.messages.length]);

  const send = async () => {
    if (!activeId || !draft.trim()) return;
    setSending(true);
    setError('');
    try {
      await bff(`/conversations/${activeId}/messages`, { method: 'POST', json: { body: draft } });
      setDraft('');
      await Promise.all([loadThread(activeId), loadList()]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card grid h-[calc(100dvh-9rem-env(safe-area-inset-bottom))] min-h-[26rem] md:h-[calc(100dvh-10rem)] md:min-h-[32rem] overflow-hidden md:grid-cols-[20rem_1fr]">
      {/* Liste des conversations */}
      <section aria-labelledby="inbox-title" className={`flex min-h-0 flex-col border-line md:border-r ${activeId ? 'hidden md:flex' : 'flex'}`}>
        <h1 id="inbox-title" className="border-b border-line px-4 py-3 text-lg font-extrabold">{t.messages.title}</h1>
        {list === null ? (
          <p className="p-4 text-sm text-ink-soft">{t.common.loading}</p>
        ) : list.length === 0 ? (
          <div className="p-6 text-center">
            <MessageSquare className="mx-auto size-9 text-ink-faint" strokeWidth={1.5} aria-hidden />
            <p className="mt-3 font-semibold">{t.messages.empty}</p>
            <p className="mt-1 text-sm text-ink-soft">{t.messages.emptyHint}</p>
          </div>
        ) : (
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {list.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  aria-current={c.id === activeId}
                  className={`flex w-full gap-3 border-b border-line px-4 py-3 text-left transition-colors hover:bg-paper ${c.id === activeId ? 'bg-brand-tint' : ''}`}
                >
                  <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-md bg-paper">
                    {c.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.cover_url} alt="" className="size-full object-cover" />
                    ) : (
                      <Car className="size-5 text-ink-faint" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={`truncate text-sm ${c.unread ? 'font-extrabold' : 'font-semibold'}`}>{c.other_name}</p>
                      <span className="shrink-0 text-xs text-ink-faint">{time(c.last_message_at)}</span>
                    </div>
                    <p className="truncate text-xs text-ink-soft">
                      <span className={`mr-1 rounded px-1 font-semibold ${c.side === 'achat' ? 'bg-brand-tint text-brand-ink' : 'bg-action-tint text-action-ink'}`}>
                        {c.side === 'achat' ? t.messages.buying : t.messages.selling}
                      </span>
                      {c.ad_title}
                    </p>
                    <p className={`mt-0.5 truncate text-sm ${c.unread ? 'font-semibold text-ink' : 'text-ink-soft'}`}>{c.last_message}</p>
                  </div>
                  {c.unread > 0 && (
                    <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-action text-[0.6875rem] font-extrabold text-on-action" aria-label={fmt(t.messages.unread, { n: c.unread })}>
                      {c.unread}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Fil de discussion */}
      <section aria-label={thread?.other_name ?? t.messages.select} className={`min-h-0 flex-col ${activeId ? 'flex' : 'hidden md:flex'}`}>
        {!thread ? (
          <div className="grid flex-1 place-items-center p-6 text-ink-soft">{activeId ? t.common.loading : t.messages.select}</div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-line px-4 py-3">
              <button type="button" onClick={() => setActiveId(null)} className="grid size-9 place-items-center rounded-md hover:bg-paper md:hidden" aria-label={t.messages.back}>
                <ArrowLeft className="size-5" aria-hidden />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{thread.other_name}</p>
                <p className="truncate text-sm text-ink-soft">
                  {thread.ad_title} · <span className="tabular font-semibold text-brand-ink">{formatMGA(thread.price_mga)}</span>
                </p>
              </div>
              <Link href={`/annonces/${thread.ad_id}`} className="hidden shrink-0 text-sm font-bold text-brand-ink hover:underline sm:block">{t.messages.viewAd}</Link>
            </header>

            <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-paper px-4 py-4">
              {thread.messages.map((m) => (
                <li key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[0.9375rem] leading-relaxed shadow-[0_1px_2px_rgb(7_44_68/0.08)] ${m.mine ? 'rounded-br-md bg-brand text-white' : 'rounded-bl-md bg-surface text-ink'}`}>
                    <p className="whitespace-pre-line break-words">{m.body}</p>
                    <p className={`mt-1 text-right text-[0.6875rem] ${m.mine ? 'text-white/70' : 'text-ink-faint'}`}>
                      {m.mine ? `${t.messages.you} · ` : ''}{time(m.created_at)}
                    </p>
                  </div>
                </li>
              ))}
              <div ref={bottom} />
            </ol>

            <form
              className="flex items-end gap-2 border-t border-line p-3"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <label htmlFor="msg-input" className="sr-only">{t.messages.inputLabel}</label>
              <textarea
                id="msg-input"
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={t.messages.placeholder}
                maxLength={4000}
                className="field-area max-h-32 min-h-11 flex-1 resize-none py-2.5"
              />
              <button type="submit" className="btn-primary size-11 shrink-0 px-0" disabled={sending || !draft.trim()} aria-label={t.common.send}>
                <Send className="size-5" aria-hidden />
              </button>
            </form>
            {error && <p role="alert" className="px-3 pb-3 text-sm text-danger">{error}</p>}
          </>
        )}
      </section>
    </div>
  );
}
