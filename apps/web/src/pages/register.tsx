import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { getSupabase } from '@/lib/supabase';

export default function Register() {
  const router = useRouter();
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    setError('');
    const { data, error } = await getSupabase().auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: { full_name: form.full_name.trim(), phone: form.phone.trim() || null },
        emailRedirectTo: `${window.location.origin}/products`,
      },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) router.replace('/products');
    else setDone(true);
  }

  const field = (key: keyof typeof form, label: string, type = 'text', extra: Record<string, unknown> = {}) => (
    <label className="block text-sm">
      <span className="text-slate-700">{label}</span>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
        {...extra}
      />
    </label>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
        <h1 className="text-xl font-bold text-slate-800">Create your account</h1>
        {done ? (
          <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg p-3">
            Check your email to confirm your account, then sign in.
          </p>
        ) : (
          <>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</p>}
            {field('full_name', 'Full name', 'text', { required: true, autoComplete: 'name' })}
            {field('phone', 'Mobile number (optional)', 'tel', { autoComplete: 'tel' })}
            {field('email', 'Email', 'email', { required: true, autoComplete: 'email' })}
            {field('password', 'Password (min 8 characters)', 'password', { required: true, autoComplete: 'new-password', minLength: 8 })}
            <button disabled={busy} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-2.5 font-medium disabled:opacity-60">
              {busy ? 'Creating account…' : 'Create account'}
            </button>
          </>
        )}
        <p className="text-sm text-center text-slate-500">
          Already have an account? <Link href="/login" className="text-emerald-700 font-medium">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
