'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageSquare, Phone, Plus } from 'lucide-react';
import { intlLocale } from '@/i18n';
import { useDict, useLocale } from '@/i18n/client';
import { bff } from '@/lib/bff';
import { formatPhone } from '@/lib/format';
import { PanelState, useProData } from './use-pro-data';

const STATUSES = ['nouveau', 'contacte', 'rdv', 'negociation', 'gagne', 'perdu'] as const;

interface Lead {
  id: number; name: string; phone: string | null; email: string | null; source: string; status: string;
  next_action_at: string | null; notes: string | null; ad_id: number | null; ad_title: string | null;
  conversation_id: number | null; assigned_to: number | null; assigned_name: string | null; last_message: string | null; updated_at: string;
}
interface Activity { id: number; kind: string; body: string; created_at: string; author: string | null }
interface Member { id: number; first_name: string; last_name: string; role: string }

const STATUS_TONE: Record<string, string> = {
  nouveau: 'bg-action-tint text-action-ink',
  contacte: 'bg-brand-tint text-brand-ink',
  rdv: 'bg-brand-tint text-brand-ink',
  negociation: 'bg-warn-tint text-warn',
  gagne: 'bg-ok-tint text-ok',
  perdu: 'bg-paper text-ink-soft',
};

/** CRM : liste des prospects, étape, attribution, relance et historique. */
export function LeadsPanel({ full }: { full: boolean }) {
  const t = useDict();
  const l = t.pro.leads;
  const locale = useLocale();
  const [filter, setFilter] = useState('');
  const { data, error, loading, reload } = useProData<{ leads: Lead[] }>(`/pro/leads${filter ? `?status=${filter}` : ''}`);
  const { data: team } = useProData<Member[]>(full ? '/pro/team' : null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const date = (iso: string) => new Date(iso).toLocaleString(intlLocale(locale), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const patch = async (id: number, body: Record<string, unknown>) => {
    await bff(`/pro/leads/${id}`, { method: 'PATCH', json: body });
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select aria-label={l.status} className="field h-10 w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">{l.all}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{l.statuses[s]}</option>)}
        </select>
        <button type="button" className="btn-secondary h-10" onClick={() => setAdding((v) => !v)}>
          <Plus className="size-4" aria-hidden /> {l.add}
        </button>
      </div>

      {adding && (
        <form
          className="card grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            await bff('/pro/leads', { method: 'POST', json: { name: fd.get('name'), phone: fd.get('phone') || undefined, source: 'telephone' } });
            setAdding(false);
            reload();
          }}
        >
          <div><label htmlFor="lead-name" className="label">{l.name}</label><input id="lead-name" name="name" required minLength={2} className="field" /></div>
          <div><label htmlFor="lead-phone" className="label">{l.phone}</label><input id="lead-phone" name="phone" type="tel" placeholder={t.auth.phoneHint} className="field tabular" /></div>
          <button type="submit" className="btn-primary">{t.common.save}</button>
        </form>
      )}

      {!full && <p className="text-sm text-ink-soft">{l.fullOnly}</p>}

      <PanelState loading={loading} error={error}>
        {data && (data.leads.length === 0 ? (
          <p className="card p-6 text-ink-soft">{l.empty}</p>
        ) : (
          <ul className="space-y-2">
            {data.leads.map((lead) => (
              <li key={lead.id} className="card">
                <div className="flex flex-wrap items-center gap-3 p-4">
                  <button type="button" onClick={() => setOpenId(openId === lead.id ? null : lead.id)} aria-expanded={openId === lead.id} className="min-w-0 flex-1 text-left">
                    <p className="font-bold">{lead.name}</p>
                    <p className="truncate text-sm text-ink-soft">{lead.ad_title ?? '—'} · {l.sources[lead.source]}</p>
                    {lead.last_message && <p className="mt-1 truncate text-sm italic text-ink-soft">« {lead.last_message} »</p>}
                  </button>
                  <select
                    aria-label={l.status}
                    value={lead.status}
                    onChange={(e) => patch(lead.id, { status: e.target.value })}
                    className={`h-9 rounded-md border-0 px-2 text-sm font-bold ${STATUS_TONE[lead.status]}`}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{l.statuses[s]}</option>)}
                  </select>
                  {full && (
                    <select
                      aria-label={l.assigned}
                      value={lead.assigned_to ?? ''}
                      onChange={(e) => patch(lead.id, { assigned_to: e.target.value ? Number(e.target.value) : null })}
                      className="field h-9 w-auto text-sm"
                    >
                      <option value="">{l.unassigned}</option>
                      {team?.map((m) => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
                    </select>
                  )}
                  <div className="flex gap-1">
                    {lead.phone && (
                      <a href={`tel:${lead.phone}`} className="grid size-9 place-items-center rounded-md border border-line hover:bg-paper" aria-label={`${l.phone} ${formatPhone(lead.phone)}`}>
                        <Phone className="size-4" aria-hidden />
                      </a>
                    )}
                    {lead.conversation_id && (
                      <Link href={`/compte/messages?c=${lead.conversation_id}`} className="grid size-9 place-items-center rounded-md border border-line hover:bg-paper" aria-label={l.openChat}>
                        <MessageSquare className="size-4" aria-hidden />
                      </Link>
                    )}
                  </div>
                </div>
                {openId === lead.id && <LeadDetail lead={lead} full={full} onChange={reload} date={date} />}
              </li>
            ))}
          </ul>
        ))}
      </PanelState>
    </div>
  );
}

function LeadDetail({ lead, full, onChange, date }: { lead: Lead; full: boolean; onChange: () => void; date: (iso: string) => string }) {
  const t = useDict();
  const l = t.pro.leads;
  const { data: activities, reload } = useProData<Activity[]>(`/pro/leads/${lead.id}/activities`);
  const [note, setNote] = useState('');
  const [kind, setKind] = useState('note');

  return (
    <div className="grid gap-4 border-t border-line p-4 md:grid-cols-2">
      <div className="space-y-3">
        {lead.phone && <p className="tabular text-sm"><span className="text-ink-soft">{l.phone} :</span> <a href={`tel:${lead.phone}`} className="font-semibold text-brand-ink">{formatPhone(lead.phone)}</a></p>}
        {full && (
          <div>
            <label htmlFor={`next-${lead.id}`} className="label">{l.nextAction}</label>
            <input
              id={`next-${lead.id}`}
              type="datetime-local"
              className="field"
              defaultValue={lead.next_action_at ? lead.next_action_at.slice(0, 16) : ''}
              onBlur={async (e) => {
                await bff(`/pro/leads/${lead.id}`, { method: 'PATCH', json: { next_action_at: e.target.value ? new Date(e.target.value).toISOString() : null } });
                onChange();
              }}
            />
          </div>
        )}
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!note.trim()) return;
            await bff(`/pro/leads/${lead.id}/activities`, { method: 'POST', json: { kind, body: note } });
            setNote('');
            reload();
            onChange();
          }}
        >
          <label htmlFor={`note-${lead.id}`} className="label">{l.notes}</label>
          <div className="flex gap-2">
            <select aria-label={l.timeline} value={kind} onChange={(e) => setKind(e.target.value)} className="field w-auto">
              {['note', 'appel', 'email', 'rdv'].map((k) => <option key={k} value={k}>{l.kinds[k]}</option>)}
            </select>
            <input id={`note-${lead.id}`} value={note} onChange={(e) => setNote(e.target.value)} className="field" />
          </div>
          <button type="submit" className="btn-secondary h-9 text-sm" disabled={!note.trim()}>{l.addNote}</button>
        </form>
      </div>
      <div>
        <h4 className="label">{l.timeline}</h4>
        <ol className="space-y-2 text-sm">
          {lead.notes && <li className="rounded-md bg-paper px-3 py-2">{lead.notes}</li>}
          {activities?.map((a) => (
            <li key={a.id} className="border-l-2 border-line pl-3">
              <p><span className="font-bold">{l.kinds[a.kind] ?? a.kind}</span> · {a.kind === 'statut' ? a.body.split(' → ').map((s) => l.statuses[s] ?? s).join(' → ') : a.body}</p>
              <p className="text-xs text-ink-faint">{a.author ?? ''} · {date(a.created_at)}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
