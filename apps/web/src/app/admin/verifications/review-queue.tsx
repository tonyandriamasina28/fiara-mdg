'use client';

import { useState } from 'react';
import { AlertTriangle, Check, ExternalLink, X } from 'lucide-react';
import { fmt, intlLocale } from '@/i18n';
import { useDict, useLocale } from '@/i18n/client';
import { bff } from '@/lib/bff';

export interface PendingVerification {
  id: number;
  declared_full_name: string;
  document_last4: string | null;
  document_type: string;
  mime_type: string;
  submitted_at: string;
  has_document: boolean;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  company_name: string | null;
  same_file_other_accounts: number;
}

/** Le document est lu via /bff (cookie httpOnly de l'admin) : jamais d'URL publique ni de cache. */
export function ReviewQueue({ initial }: { initial: PendingVerification[] }) {
  const t = useDict();
  const v = t.verify;
  const locale = useLocale();
  const [items, setItems] = useState(initial);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const decide = async (id: number, body: object) => {
    await bff(`/admin/verifications/${id}/decision`, { method: 'POST', json: body });
    setItems((prev) => prev.filter((x) => x.id !== id));
    setRejecting(null);
    setMessage(v.adminDone);
  };

  if (items.length === 0) return <p className="card mt-6 p-6 text-ink-soft">{message || v.adminEmpty}</p>;

  return (
    <div className="mt-6 space-y-4">
      {message && <p role="status" className="rounded-lg bg-ok-tint px-4 py-2.5 text-sm font-semibold text-ok">{message}</p>}
      {items.map((item) => {
        const doc = `/bff/admin/verifications/${item.id}/document`;
        return (
          <article key={item.id} className="card grid gap-5 p-5 md:grid-cols-[18rem_1fr]">
            <div className="grid min-h-48 place-items-center overflow-hidden rounded-lg border border-line bg-paper">
              {item.has_document && item.mime_type.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={doc} alt={item.declared_full_name} className="max-h-72 w-full object-contain" />
              ) : item.has_document ? (
                <a href={doc} target="_blank" rel="noopener" className="btn-secondary"><ExternalLink className="size-4" aria-hidden /> {v.adminOpen}</a>
              ) : (
                <p className="text-sm text-ink-faint">{v.adminNoDoc}</p>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-ink-soft">{v.adminDeclared}</p>
                <p className="text-lg font-extrabold">{item.declared_full_name}</p>
                <p className="tabular text-sm text-ink-soft">
                  {item.document_type} · •••• {item.document_last4 ?? '—'} · {new Date(item.submitted_at).toLocaleString(intlLocale(locale))}
                </p>
                <p className="mt-1 text-sm">{item.company_name ?? `${item.first_name} ${item.last_name}`} · {item.email}</p>
              </div>
              {item.same_file_other_accounts > 0 && (
                <p className="flex items-center gap-2 rounded-md bg-warn-tint px-3 py-2 text-sm font-semibold text-warn">
                  <AlertTriangle className="size-4 shrink-0" aria-hidden /> {fmt(v.adminSameFile, { n: item.same_file_other_accounts })}
                </p>
              )}
              {item.has_document && item.mime_type.startsWith('image/') && (
                <a href={doc} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm font-bold text-brand-ink hover:underline">
                  <ExternalLink className="size-4" aria-hidden /> {v.adminOpen}
                </a>
              )}
              {rejecting === item.id ? (
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    decide(item.id, { decision: 'refuse', reason: new FormData(e.currentTarget).get('reason') });
                  }}
                >
                  <label htmlFor={`reason-${item.id}`} className="label">{v.adminReason}</label>
                  <input id={`reason-${item.id}`} name="reason" required minLength={5} className="field" />
                  <div className="flex gap-2">
                    <button type="submit" className="btn-secondary h-10 border-danger text-danger hover:bg-danger-tint">{v.adminReject}</button>
                    <button type="button" className="h-10 px-3 text-sm font-semibold text-ink-soft" onClick={() => setRejecting(null)}>{t.common.cancel}</button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button type="button" className="btn-primary h-10" onClick={() => decide(item.id, { decision: 'valide' })}>
                    <Check className="size-4" aria-hidden /> {v.adminApprove}
                  </button>
                  <button type="button" className="btn-secondary h-10" onClick={() => setRejecting(item.id)}>
                    <X className="size-4" aria-hidden /> {v.adminReject}
                  </button>
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
