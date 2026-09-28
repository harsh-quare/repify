'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthShell } from '@/components/AuthShell';
import { PasswordField } from '@/components/PasswordField';
import { friendlyAuthError, safeNextPath } from '@/lib/auth/next';
import { getSupabaseBrowser } from '@/lib/db/supabase-browser';

type Mode = 'sign_in' | 'sign_up';
type Panel = 'password' | 'forgot';
type Busy = null | 'google' | 'password' | 'forgot';

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

const inputClass =
  'w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mode, setMode] = useState<Mode>('sign_in');
  const [panel, setPanel] = useState<Panel>('password');
  const [error, setError] = useState<string | null>(() => {
    const raw = params.get('error');
    return raw ? friendlyAuthError(raw) : null;
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);

  function resetAlerts() {
    setError(null);
    setNotice(null);
  }

  async function finishSignedIn() {
    router.replace(next);
    router.refresh();
  }

  async function onGoogle() {
    resetAlerts();
    setBusy('google');
    try {
      const origin = window.location.origin;
      const { error } = await getSupabaseBrowser().auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}&intent=${mode === 'sign_up' ? 'sign_up' : 'sign_in'}`,
        },
      });
      if (error) setError(friendlyAuthError(error.message));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(friendlyAuthError(message));
    } finally {
      setBusy(null);
    }
  }

  async function onPassword(e: React.FormEvent) {
    e.preventDefault();
    resetAlerts();
    if (mode === 'sign_up' && password !== confirm) {
      setError('Passwords don’t match.');
      return;
    }
    setBusy('password');
    try {
      const sb = getSupabaseBrowser();
      const origin = window.location.origin;
      if (mode === 'sign_in') {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) {
          setError(friendlyAuthError(error.message));
          return;
        }
      } else {
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (error) {
          setError(friendlyAuthError(error.message));
          return;
        }
        const identities = data.user?.identities ?? [];
        if (!data.session && identities.length === 0) {
          setError('This email already has an account. Use Sign in or Continue with Google.');
          return;
        }
        if (!data.session) {
          const signed = await sb.auth.signInWithPassword({ email, password });
          if (signed.error) {
            setError(
              'Account created, but it isn’t signed in yet. In Supabase → Authentication → Providers → Email, turn off Confirm email, then sign in.',
            );
            return;
          }
        }
      }
    } catch (err) {
      console.warn('[auth] sign-in failed:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(friendlyAuthError(message));
      return;
    } finally {
      setBusy(null);
    }
    await finishSignedIn();
  }

  async function onForgot(e: React.FormEvent) {
    e.preventDefault();
    resetAlerts();
    if (!email) {
      setError('Enter your email first.');
      return;
    }
    setBusy('forgot');
    try {
      const origin = window.location.origin;
      const { error } = await getSupabaseBrowser().auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/callback?next=/auth/reset`,
      });
      if (error) {
        setError(friendlyAuthError(error.message));
        return;
      }
      setNotice('Reset link sent. Open it, then choose a new password.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(friendlyAuthError(message));
    } finally {
      setBusy(null);
    }
  }

  const title =
    panel === 'forgot'
      ? 'Reset password'
      : mode === 'sign_in'
        ? 'Welcome back'
        : 'Create your account';

  const subtitle =
    panel === 'forgot'
      ? 'We’ll email a link to set a new password.'
      : mode === 'sign_in'
        ? 'Sign in with Google or email. New here? Use Create account.'
        : 'Google or email — you’ll be signed in as soon as the account is created.';

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-xl shadow-black/40 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>

      {panel === 'password' && (
        <div className="mt-5 grid grid-cols-2 rounded-lg bg-zinc-800 p-1 text-sm">
          <button
            type="button"
            onClick={() => {
              resetAlerts();
              setMode('sign_in');
            }}
            className={`rounded-md py-1.5 font-medium ${
              mode === 'sign_in' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              resetAlerts();
              setMode('sign_up');
            }}
            className={`rounded-md py-1.5 font-medium ${
              mode === 'sign_up' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Create account
          </button>
        </div>
      )}

      {panel === 'password' && (
        <>
          <button
            type="button"
            onClick={() => void onGoogle()}
            disabled={busy != null}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-white py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-50"
          >
            <GoogleMark />
            {busy === 'google' ? 'Redirecting…' : 'Continue with Google'}
          </button>
          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-zinc-500">
            <span className="h-px flex-1 bg-zinc-800" />
            or email
            <span className="h-px flex-1 bg-zinc-800" />
          </div>
        </>
      )}

      {panel === 'password' && (
        <form
          className="space-y-4"
          onSubmit={(e) => void onPassword(e)}
        >
          <div>
            <label htmlFor="auth-email" className="mb-1 block text-xs uppercase tracking-wider text-zinc-400">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              name="email"
              autoComplete="email"
              required
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="auth-password" className="text-xs uppercase tracking-wider text-zinc-400">
                Password
              </label>
              {mode === 'sign_in' && (
                <button
                  type="button"
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                  onClick={() => {
                    resetAlerts();
                    setPanel('forgot');
                  }}
                >
                  Forgot password?
                </button>
              )}
            </div>
            <PasswordField
              id="auth-password"
              value={password}
              onChange={setPassword}
              autoComplete={mode === 'sign_up' ? 'new-password' : 'current-password'}
              placeholder={mode === 'sign_up' ? 'At least 6 characters' : undefined}
            />
          </div>
          {mode === 'sign_up' && (
            <div>
              <label htmlFor="auth-confirm" className="mb-1 block text-xs uppercase tracking-wider text-zinc-400">
                Confirm password
              </label>
              <PasswordField
                id="auth-confirm"
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
                placeholder="Repeat password"
              />
            </div>
          )}
          {error && <p className="text-sm text-rose-400">{error}</p>}
          {notice && <p className="text-sm text-emerald-400">{notice}</p>}
          <button
            type="submit"
            disabled={busy != null}
            className="w-full rounded-lg bg-indigo-500 py-2.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
          >
            {busy === 'password' ? '…' : mode === 'sign_in' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      )}

      {panel === 'forgot' && (
        <form className="mt-6 space-y-4" onSubmit={(e) => void onForgot(e)}>
          <div>
            <label htmlFor="forgot-email" className="mb-1 block text-xs uppercase tracking-wider text-zinc-400">
              Email
            </label>
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              required
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          {notice && <p className="text-sm text-emerald-400">{notice}</p>}
          <button
            type="submit"
            disabled={busy != null}
            className="w-full rounded-lg bg-indigo-500 py-2.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
          >
            {busy === 'forgot' ? '…' : 'Send reset link'}
          </button>
          <button
            type="button"
            className="w-full text-sm text-zinc-400 hover:text-zinc-200"
            onClick={() => {
              resetAlerts();
              setPanel('password');
            }}
          >
            Back to sign in
          </button>
        </form>
      )}
    </div>
  );
}

export default function SignInPage() {
  return (
    <AuthShell>
      <Suspense fallback={<div className="text-center text-sm text-zinc-500">Loading…</div>}>
        <SignInForm />
      </Suspense>
    </AuthShell>
  );
}
