'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookUser, Clock, FileText, Lock, ShieldCheck, Upload, XCircle } from 'lucide-react';
import { fmt } from '@/i18n';
import { useDict } from '@/i18n/client';
import type { ApiError } from '@/lib/api';
import { bff } from '@/lib/bff';

export interface VerificationState {
  verified_at: string | null;
  current: { status: 'en_attente' | 'valide' | 'refuse'; rejection_reason: string | null; declared_full_name: string } | null;
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 10 * 1024 * 1024;

/** Téléversement du passeport + affichage du statut (en attente, validé, refusé). */
export function IdentityForm({ initial, defaultName }: { initial: VerificationState; defaultName: string }) {
  const t = useDict();
  const v = t.verify;
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<{ sending?: boolean; error?: string; fields?: Record<string, string> }>({});

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const status = initial.verified_at ? 'valide' : initial.current?.status;
  const canSubmit = status !== 'valide' && status !== 'en_attente';

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!ACCEPTED.includes(f.type) || f.size > MAX_BYTES) {
      setState({ error: v.uploadHint });
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
    setState({});
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-5">
        {status && (
          <div
            role="status"
            className={`flex gap-3 rounded-xl border p-4 ${
              status === 'valide' ? 'border-brand/50 bg-brand-tint' : status === 'en_attente' ? 'border-warn/40 bg-warn-tint' : 'border-danger/40 bg-danger-tint'
            }`}
          >
            {status === 'valide' ? <ShieldCheck className="size-6 shrink-0 text-brand-ink" aria-hidden /> : status === 'en_attente' ? <Clock className="size-6 shrink-0 text-warn" aria-hidden /> : <XCircle className="size-6 shrink-0 text-danger" aria-hidden />}
            <div>
              <p className="font-extrabold">{v.status[status]}</p>
              <p className="mt-0.5 text-sm text-ink-soft">
                {status === 'valide' ? v.validText : status === 'en_attente' ? v.pendingText : fmt(v.refusedText, { reason: initial.current?.rejection_reason ?? '' })}
              </p>
            </div>
          </div>
        )}

        {canSubmit && (
          <form
            className="card grid gap-5 p-5 md:grid-cols-[14rem_1fr]"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!file) {
                setState({ error: v.uploadHint });
                return;
              }
              const fd = new FormData(e.currentTarget);
              fd.delete('picker');
              fd.append('document', file);
              if (!String(fd.get('document_last4') ?? '').trim()) fd.delete('document_last4');
              setState({ sending: true });
              try {
                await bff('/verifications', { method: 'POST', body: fd });
                router.refresh();
              } catch (err) {
                const apiErr = err as ApiError;
                setState({ error: apiErr.message, fields: Object.fromEntries((apiErr.fields ?? []).map((f) => [f.path, f.message])) });
              }
            }}
          >
            {/* Zone de dépôt : aperçu du document, glisser-déposer */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-line-strong p-4 text-center"
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="max-h-44 w-full rounded-md object-contain" />
              ) : file ? (
                <FileText className="size-14 text-ink-faint" strokeWidth={1.25} aria-hidden />
              ) : (
                <div className="grid h-40 w-28 place-items-center rounded-md bg-[#7a1b2a] text-[#f2d9a0] shadow-[0_6px_16px_-6px_rgb(0_0_0/0.5)]" aria-hidden>
                  <BookUser className="size-10" strokeWidth={1.25} />
                </div>
              )}
              <button type="button" className="btn-secondary h-10 text-sm" onClick={() => input.current?.click()}>
                <Upload className="size-4" aria-hidden /> {file ? v.replace : v.upload}
              </button>
              {file && <p className="max-w-full truncate text-xs text-ink-faint">{file.name}</p>}
              <input ref={input} name="picker" type="file" accept={ACCEPTED.join(',')} className="sr-only" tabIndex={-1} onChange={(e) => pick(e.target.files?.[0])} />
            </div>

            <div className="space-y-4">
              <p className="text-sm text-ink-soft">{v.uploadHint}</p>
              <input type="hidden" name="document_type" value="passeport" />
              <div>
                <label htmlFor="id-name" className="label">{v.fullName}</label>
                <input id="id-name" name="declared_full_name" required minLength={3} maxLength={160} defaultValue={defaultName} autoComplete="name" className="field uppercase" aria-invalid={Boolean(state.fields?.declared_full_name)} />
              </div>
              <div>
                <label htmlFor="id-last4" className="label">{v.last4}</label>
                <input id="id-last4" name="document_last4" maxLength={4} pattern="[A-Za-z0-9]{4}" inputMode="text" autoComplete="off" className="field tabular w-32 uppercase" aria-invalid={Boolean(state.fields?.document_last4)} />
                <p className="mt-1 text-xs text-ink-faint">{v.last4Hint}</p>
              </div>
              {state.error && <p role="alert" className="rounded-md bg-danger-tint px-3 py-2 text-sm text-danger">{state.error}</p>}
              <button type="submit" className="btn-primary w-full" disabled={state.sending}>
                <Lock className="size-4" aria-hidden /> {state.sending ? v.sending : v.submit}
              </button>
            </div>
          </form>
        )}
      </div>

      <aside className="card h-fit p-5">
        <h2 className="flex items-center gap-2 font-extrabold"><ShieldCheck className="size-5 text-brand-ink" aria-hidden /> {v.privacyTitle}</h2>
        <ul className="mt-3 space-y-2.5 text-sm text-ink-soft">
          {v.privacy.map((line) => (
            <li key={line} className="flex gap-2"><Lock className="mt-0.5 size-3.5 shrink-0 text-ink-faint" aria-hidden /> {line}</li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
