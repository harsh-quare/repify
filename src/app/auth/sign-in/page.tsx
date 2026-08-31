'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/db/supabase-browser';
import { PasswordField } from '@/components/PasswordField';

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'sign_in' | 'sign_up'>('sign_in');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const sb = getSupabaseBrowser();
      if (mode === 'sign_in') {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) {
          setError(error.message);
          return;
        }
      } else {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) {
          setError(error.message);
          return;
        }
        const identities = data.user?.identities ?? [];
        if (!data.session && identities.length === 0) {
          setMode('sign_in');
          setError(
            'This email already has an account. Sign in with the original password, or use Forgot password.',
          );
          return;
        }
        if (!data.session) {
          setMode('sign_in');
          setNotice('Account created. Confirm the email link, then sign in.');
          return;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.warn('[auth] sign-in failed:', message);
      setError(
        message === 'Failed to fetch'
          ? 'Can’t reach the server. Check your connection and try again.'
          : message,
      );
      return;
    } finally {
      setLoading(false);
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">
        {mode === 'sign_in' ? 'Sign in' : 'Create account'}
      </h1>
      <p className="text-sm text-zinc-400 mb-6">Repify — your gym log.</p>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="block text-xs uppercase tracking-wider text-zinc-400 mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-zinc-400 mb-1">Password</label>
          <PasswordField value={password} onChange={setPassword} />
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        {notice && <p className="text-sm text-emerald-400">{notice}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? '…' : mode === 'sign_in' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      <button
        type="button"
        className="mt-3 w-full text-xs text-zinc-400 hover:text-zinc-200"
        onClick={async () => {
          setError(null);
          setNotice(null);
          if (!email) {
            setError('Enter your email first.');
            return;
          }
          const origin = window.location.origin;
          const { error } = await getSupabaseBrowser().auth.resetPasswordForEmail(email, {
            redirectTo: `${origin}/auth/callback?next=/auth/reset`,
          });
          if (error) setError(error.message);
          else setNotice('Password reset email sent. Open the link, then set a new password.');
        }}
      >
        Forgot password?
      </button>
      <button
        type="button"
        className="mt-2 w-full text-xs text-zinc-400 hover:text-zinc-200"
        onClick={() => setMode(mode === 'sign_in' ? 'sign_up' : 'sign_in')}
      >
        {mode === 'sign_in' ? "Don't have an account? Sign up" : 'Have an account? Sign in'}
      </button>
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Suspense fallback={<div className="text-zinc-500 text-sm">Loading…</div>}>
        <SignInForm />
      </Suspense>
    </div>
  );
}
