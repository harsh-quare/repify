'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/db/supabase-browser';
import { PasswordField } from '@/components/PasswordField';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
    <div className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-4"
      >
        <h1 className="text-2xl font-semibold">New password</h1>
        <PasswordField
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? '…' : 'Save password'}
        </button>
      </form>
    </div>
  );
}
