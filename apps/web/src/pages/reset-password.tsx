import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { getSupabase } from '@/lib/supabase';

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    const { error } = await getSupabase().auth.updateUser({ password });
    setBusy(false);
    if (error) setError(error.message);
    else router.replace('/products');
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <h1 className="text-xl font-bold text-slate-800">Choose a new password</h1>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</p>}
        <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2" placeholder="New password" />
        <button disabled={busy} className="w-full bg-emerald-600 text-white rounded-lg py-2.5 font-medium disabled:opacity-60">Save password</button>
      </form>
    </div>
  );
}
