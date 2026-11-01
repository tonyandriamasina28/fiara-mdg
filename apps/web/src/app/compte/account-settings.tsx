'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { logout } from '@/app/connexion/actions';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useDict } from '@/i18n/client';
import { bff } from '@/lib/bff';

interface Props {
  user: { first_name: string; last_name: string; phone: string | null; email: string };
}

export function AccountSettings({ user }: Props) {
  const t = useDict();
  const router = useRouter();
  const [profileMsg, setProfileMsg] = useState<{ ok?: string; error?: string }>({});
  const [pwdMsg, setPwdMsg] = useState<{ ok?: string; error?: string }>({});

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form
        className="card space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          try {
            await bff('/auth/me', {
              method: 'PATCH',
              json: { first_name: fd.get('first_name'), last_name: fd.get('last_name'), phone: String(fd.get('phone') || '') || undefined },
            });
            setProfileMsg({ ok: t.profile.saved });
            router.refresh();
          } catch (err) {
            setProfileMsg({ error: (err as Error).message });
          }
        }}
      >
        <h3 className="font-extrabold">{t.profile.editProfile}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="s-first" className="label">{t.auth.firstName}</label>
            <input id="s-first" name="first_name" defaultValue={user.first_name} required autoComplete="given-name" className="field" />
          </div>
          <div>
            <label htmlFor="s-last" className="label">{t.auth.lastName}</label>
            <input id="s-last" name="last_name" defaultValue={user.last_name} required autoComplete="family-name" className="field" />
          </div>
        </div>
        <div>
          <label htmlFor="s-phone" className="label">{t.auth.phone}</label>
          <input id="s-phone" name="phone" type="tel" defaultValue={user.phone?.replace(/^\+261/, '0') ?? ''} placeholder={t.auth.phoneHint} autoComplete="tel" className="field tabular" />
        </div>
        <div>
          <label htmlFor="s-email" className="label">{t.auth.email}</label>
          <input id="s-email" value={user.email} disabled className="field" />
        </div>
        {profileMsg.ok && <p role="status" className="text-sm font-semibold text-ok">{profileMsg.ok}</p>}
        {profileMsg.error && <p role="alert" className="text-sm text-danger">{profileMsg.error}</p>}
        <button type="submit" className="btn-secondary">{t.common.save}</button>
      </form>

      <div className="space-y-4">
        <form
          className="card space-y-4 p-5"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            try {
              await bff('/auth/password', { method: 'POST', json: { current_password: fd.get('current'), new_password: fd.get('next') } });
              setPwdMsg({ ok: t.profile.passwordChanged });
              form.reset();
            } catch (err) {
              setPwdMsg({ error: (err as Error).message });
            }
          }}
        >
          <h3 className="font-extrabold">{t.profile.changePassword}</h3>
          <div>
            <label htmlFor="s-current" className="label">{t.profile.currentPassword}</label>
            <input id="s-current" name="current" type="password" required autoComplete="current-password" className="field" />
          </div>
          <div>
            <label htmlFor="s-next" className="label">{t.profile.newPassword}</label>
            <input id="s-next" name="next" type="password" required minLength={8} autoComplete="new-password" className="field" />
            <p className="mt-1 text-xs text-ink-faint">{t.auth.passwordHint}</p>
          </div>
          {pwdMsg.ok && <p role="status" className="text-sm font-semibold text-ok">{pwdMsg.ok}</p>}
          {pwdMsg.error && <p role="alert" className="text-sm text-danger">{pwdMsg.error}</p>}
          <button type="submit" className="btn-secondary">{t.common.save}</button>
        </form>

        <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="font-extrabold">{t.profile.language}</p>
          </div>
          <LanguageSwitcher />
        </div>

        <form action={logout}>
          <button type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface font-bold text-danger hover:bg-danger-tint">
            <LogOut className="size-5" aria-hidden /> {t.nav.logout}
          </button>
        </form>
      </div>
    </div>
  );
}
