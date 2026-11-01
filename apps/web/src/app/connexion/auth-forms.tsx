'use client';

import { useActionState, useState } from 'react';
import type { Province } from '@/lib/api';
import { useDict } from '@/i18n/client';
import { login, register, type AuthState } from './actions';

function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-sm text-danger">{msg}</p> : null;
}

export function AuthForms({ provinces, suite, initialMode }: { provinces: Province[]; suite: string; initialMode: 'login' | 'register' }) {
  const t = useDict();
  const [mode, setMode] = useState(initialMode);
  const [role, setRole] = useState<'particulier' | 'professionnel'>('particulier');
  const [loginState, loginAction, loggingIn] = useActionState<AuthState, FormData>(login, {});
  const [registerState, registerAction, registering] = useActionState<AuthState, FormData>(register, {});
  const f = registerState.fields ?? {};

  if (mode === 'login') {
    return (
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold">{t.auth.loginTitle}</h1>
        <p className="mt-1 text-ink-soft">{t.auth.loginIntro}</p>
        <form action={loginAction} className="mt-6 space-y-4">
          <input type="hidden" name="suite" value={suite} />
          <div>
            <label htmlFor="l-email" className="label">{t.auth.email}</label>
            <input id="l-email" name="email" type="email" autoComplete="email" required className="field" />
          </div>
          <div>
            <label htmlFor="l-password" className="label">{t.auth.password}</label>
            <input id="l-password" name="password" type="password" autoComplete="current-password" required className="field" />
          </div>
          {loginState.error && <p role="alert" className="rounded-md bg-danger-tint px-3 py-2 text-sm text-danger">{loginState.error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loggingIn}>
            {loggingIn ? t.common.loading : t.auth.submitLogin}
          </button>
        </form>
        <p className="mt-5 text-sm text-ink-soft">
          {t.auth.noAccount}{' '}
          <button type="button" onClick={() => setMode('register')} className="font-bold text-brand-ink hover:underline">{t.auth.registerTitle}</button>
        </p>
        <p className="mt-4 rounded-md bg-paper px-3 py-2 text-xs text-ink-soft">{t.auth.demo}</p>
      </div>
    );
  }

  return (
    <div className="card p-6 sm:p-8">
      <h1 className="text-2xl font-extrabold">{t.auth.registerTitle}</h1>
      <p className="mt-1 text-ink-soft">{t.auth.registerIntro}</p>
      <form action={registerAction} className="mt-6 space-y-4">
        <input type="hidden" name="suite" value={suite} />
        <fieldset>
          <legend className="label">{t.auth.accountType}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['particulier', 'professionnel'] as const).map((r) => (
              <label key={r} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm font-semibold ${role === r ? 'border-brand bg-brand-tint text-brand-ink' : 'border-line-strong'}`}>
                <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="size-4" />
                {r === 'particulier' ? t.auth.private : t.auth.pro}
              </label>
            ))}
          </div>
        </fieldset>

        {role === 'professionnel' && (
          <div className="grid gap-4 rounded-lg bg-paper p-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="r-company" className="label">{t.auth.company}</label>
              <input id="r-company" name="company_name" required className="field" aria-invalid={Boolean(f.company_name)} />
              <FieldError msg={f.company_name} />
            </div>
            <div>
              <label htmlFor="r-nif" className="label">{t.auth.nif} <span className="font-normal">({t.common.optional})</span></label>
              <input id="r-nif" name="nif" className="field" />
            </div>
            <div>
              <label htmlFor="r-stat" className="label">{t.auth.stat} <span className="font-normal">({t.common.optional})</span></label>
              <input id="r-stat" name="stat" className="field" />
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="r-first" className="label">{t.auth.firstName}</label>
            <input id="r-first" name="first_name" autoComplete="given-name" required className="field" />
          </div>
          <div>
            <label htmlFor="r-last" className="label">{t.auth.lastName}</label>
            <input id="r-last" name="last_name" autoComplete="family-name" required className="field" />
          </div>
        </div>
        <div>
          <label htmlFor="r-email" className="label">{t.auth.email}</label>
          <input id="r-email" name="email" type="email" autoComplete="email" required className="field" aria-invalid={Boolean(f.email)} />
          <FieldError msg={f.email} />
        </div>
        <div>
          <label htmlFor="r-phone" className="label">{t.auth.phone}</label>
          <input id="r-phone" name="phone" type="tel" autoComplete="tel" placeholder={t.auth.phoneHint} className="field tabular" aria-invalid={Boolean(f.phone)} />
          <FieldError msg={f.phone} />
        </div>
        <div>
          <label htmlFor="r-city" className="label">{t.sell.city}</label>
          <select id="r-city" name="city_id" className="field">
            <option value="">—</option>
            {provinces.map((p) => (
              <optgroup key={p.id} label={p.name}>
                {p.cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="r-password" className="label">{t.auth.password}</label>
          <input id="r-password" name="password" type="password" autoComplete="new-password" minLength={8} required className="field" aria-invalid={Boolean(f.password)} />
          <p className="mt-1 text-xs text-ink-faint">{t.auth.passwordHint}</p>
          <FieldError msg={f.password} />
        </div>
        {registerState.error && <p role="alert" className="rounded-md bg-danger-tint px-3 py-2 text-sm text-danger">{registerState.error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={registering}>
          {registering ? t.common.loading : t.auth.submitRegister}
        </button>
      </form>
      <p className="mt-5 text-sm text-ink-soft">
        {t.auth.haveAccount}{' '}
        <button type="button" onClick={() => setMode('login')} className="font-bold text-brand-ink hover:underline">{t.auth.submitLogin}</button>
      </p>
    </div>
  );
}
