import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { getSupabase } from '@/lib/supabase';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setError(error.message === 'Email not confirmed' ? 'Please confirm your email first — check your inbox for the link.' : error.message);
      return;
    }
    const next = typeof router.query.next === 'string' && router.query.next.startsWith('/') ? router.query.next : '/products';
    router.replace(next);
  }

  async function forgot() {
    if (!email.trim()) {
      setError('Enter your email above first.');
      return;
    }
    const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) setError(error.message);
    else setInfo('If that email has an account, a password reset link is on its way.');
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
        <div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold text-xl mb-3">S</div>
          <h1 className="text-xl font-bold text-slate-800">Sign in</h1>
          <p className="text-sm text-slate-500">Shop groceries and get help with your orders.</p>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</p>}
        {info && <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg p-2">{info}</p>}
        <label className="block text-sm">
          <span className="text-slate-700">Email</span>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Password</span>
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" />
        </label>
        <button disabled={busy} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-2.5 font-medium disabled:opacity-60">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <div className="flex justify-between text-sm">
          <button type="button" onClick={forgot} className="text-slate-500 hover:text-slate-800">Forgot password?</button>
          <Link href="/register" className="text-emerald-700 font-medium">Create account</Link>
        </div>
      </form>
    </div>
  );
}
