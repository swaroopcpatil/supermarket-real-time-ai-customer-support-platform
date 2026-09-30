import React, { useState } from 'react';
import { useRouter } from 'next/router';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function register(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Unable to create account.');
      localStorage.setItem('supermarket_auth', JSON.stringify(data));
      router.push('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account.');
    } finally { setSubmitting(false); }
  }

  return <div className="max-w-md mx-auto my-12 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
    <div><h2 className="text-2xl font-bold text-slate-900">Create your account</h2><p className="text-xs text-slate-500 mt-1">Get help with supermarket orders and products.</p></div>
    <form onSubmit={register} className="space-y-4">
      <input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" />
      <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" />
      <input required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (8+ characters)" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" />
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      <button disabled={submitting} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm">{submitting ? 'Creating account…' : 'Create account'}</button>
    </form>
    <p className="text-center text-xs text-slate-500">Already registered? <a className="font-semibold text-emerald-700 hover:underline" href="/login">Sign in</a></p>
  </div>;
}
