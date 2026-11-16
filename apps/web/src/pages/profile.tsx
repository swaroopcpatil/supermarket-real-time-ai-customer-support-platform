import React, { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export default function Profile() {
  const { profile, refreshProfile } = useAuth();
  const [form, setForm] = useState({ full_name: '', phone: '', default_address: '' });
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (profile) setForm({ full_name: profile.full_name || '', phone: profile.phone || '', default_address: profile.default_address || '' });
  }, [profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    const { error } = await getSupabase()
      .from('profiles')
      .update({ full_name: form.full_name.trim(), phone: form.phone.trim() || null, default_address: form.default_address.trim() || null })
      .eq('id', profile.id);
    setStatus(error ? error.message : 'Saved.');
    if (!error) refreshProfile();
  }

  return (
    <form onSubmit={save} className="max-w-lg mx-auto bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
      <div>
        <p className="text-sm text-slate-500">Signed in as</p>
        <p className="font-semibold text-slate-800">{profile?.email}</p>
      </div>
      <label className="block text-sm">
        <span className="text-slate-700">Full name</span>
        <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" />
      </label>
      <label className="block text-sm">
        <span className="text-slate-700">Mobile number</span>
        <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" />
      </label>
      <label className="block text-sm">
        <span className="text-slate-700">Default delivery address</span>
        <textarea rows={3} value={form.default_address} onChange={(e) => setForm({ ...form, default_address: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" />
      </label>
      <div className="flex items-center gap-3">
        <button className="bg-emerald-600 text-white rounded-lg px-4 py-2 text-sm">Save</button>
        {status && <span className="text-sm text-slate-600">{status}</span>}
      </div>
    </form>
  );
}
