import React, { useState } from 'react';
import { useRouter } from 'next/router';

export default function LoginPage() {
  const [email, setEmail] = useState('customer@supermarket.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json')
        ? await response.json()
        : null;
      if (!response.ok) {
        throw new Error(
          data?.detail || 'Unable to sign in. Please try again in a moment.'
        );
      }
      if (!data) throw new Error('Unable to sign in. Please try again in a moment.');
      localStorage.setItem('supermarket_auth', JSON.stringify(data));
      router.push(data.role === 'ADMIN' ? '/admin' : '/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Customer Login</h2>
        <p className="text-xs text-slate-500 mt-1">Sign in to access your supermarket orders and AI Assistant</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-md transition-all text-sm"
        >
          {submitting ? 'Signing in…' : 'Sign In'}
        </button>
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      </form>
      <p className="text-center text-xs text-slate-500">New customer? <a className="font-semibold text-emerald-700 hover:underline" href="/register">Create an account</a></p>
    </div>
  );
}
