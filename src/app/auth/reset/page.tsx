'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/AuthShell';
import { PasswordField } from '@/components/PasswordField';
import { getSupabaseBrowser } from '@/lib/db/supabase-browser';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords don’t match.');
      return;
    }
    setLoading(true);
    const { error } = await getSupabaseBrowser().auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <AuthShell>
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 space-y-4 shadow-xl shadow-black/40 sm:p-8"
      >
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="text-sm text-zinc-400">Use at least 6 characters. You’ll be signed in after saving.</p>
        <div>
          <label htmlFor="new-password" className="mb-1 block text-xs uppercase tracking-wider text-zinc-400">
            New password
          </label>
          <PasswordField
            id="new-password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            placeholder="At least 6 characters"
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className="mb-1 block text-xs uppercase tracking-wider text-zinc-400">
            Confirm password
          </label>
          <PasswordField
            id="confirm-password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            placeholder="Repeat password"
          />
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {loading ? '…' : 'Save password'}
        </button>
        <Link href="/auth/sign-in" className="block text-center text-sm text-zinc-400 hover:text-zinc-200">
          Back to sign in
        </Link>
      </form>
    </AuthShell>
  );
}
