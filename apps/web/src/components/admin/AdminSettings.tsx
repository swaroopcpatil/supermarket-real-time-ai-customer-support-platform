import React, { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Profile, StoreSettings } from '@/lib/types';

export default function AdminSettings() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [status, setStatus] = useState('');
  const [team, setTeam] = useState<Profile[]>([]);
  const [email, setEmail] = useState('');
  const [teamMsg, setTeamMsg] = useState('');

  const loadTeam = useCallback(async () => {
    const { data } = await getSupabase().from('profiles').select('*').in('role', ['staff', 'admin']).order('role');
    setTeam((data as Profile[]) || []);
  }, []);

  useEffect(() => {
    getSupabase().from('store_settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => setSettings(data as StoreSettings));
    loadTeam();
  }, [loadTeam]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    const { error } = await getSupabase()
      .from('store_settings')
      .update({
        store_name: settings.store_name,
        support_email: settings.support_email || null,
        support_phone: settings.support_phone || null,
        store_hours: settings.store_hours,
        support_hours: settings.support_hours,
        free_delivery_threshold: Number(settings.free_delivery_threshold),
        delivery_fee: Number(settings.delivery_fee),
        refund_window_hours: Number(settings.refund_window_hours),
      })
      .eq('id', 1);
    setStatus(error ? error.message : 'Saved. Remember to update the matching policy documents.');
  }

  async function setRole(target: string, role: 'customer' | 'staff' | 'admin') {
    setTeamMsg('');
    const { data: found } = await getSupabase().from('profiles').select('id').ilike('email', target.trim()).maybeSingle();
    if (!found) {
      setTeamMsg('No account with that email. Ask them to register first.');
      return;
    }
    const { error } = await getSupabase().from('profiles').update({ role }).eq('id', found.id);
    setTeamMsg(error ? error.message : `${target} is now ${role}.`);
    setEmail('');
    loadTeam();
  }

  if (!settings) return <p className="text-sm text-slate-500">Loading…</p>;

  const field = (key: keyof StoreSettings, label: string, type = 'text') => (
    <label className="block text-sm">
      <span className="text-slate-700">{label}</span>
      <input
        type={type}
        disabled={!isAdmin}
        value={(settings[key] as string | number | null) ?? ''}
        onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
        className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 disabled:bg-slate-50"
      />
    </label>
  );

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <form onSubmit={save} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <h4 className="font-semibold">Store settings {!isAdmin && <span className="text-xs font-normal text-slate-500">(admins only)</span>}</h4>
        {field('store_name', 'Store name')}
        <div className="grid grid-cols-2 gap-3">{field('support_phone', 'Support phone')}{field('support_email', 'Support email', 'email')}</div>
        <div className="grid grid-cols-2 gap-3">{field('store_hours', 'Store hours')}{field('support_hours', 'Human support hours')}</div>
        <div className="grid grid-cols-3 gap-3">
          {field('free_delivery_threshold', 'Free delivery from ₹', 'number')}
          {field('delivery_fee', 'Delivery fee ₹', 'number')}
          {field('refund_window_hours', 'Refund window (hours)', 'number')}
        </div>
        {isAdmin && <button className="text-sm bg-emerald-600 text-white rounded-lg px-4 py-2">Save settings</button>}
        {status && <p className="text-sm text-slate-600">{status}</p>}
      </form>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <h4 className="font-semibold">Team</h4>
        <ul className="text-sm divide-y divide-slate-100">
          {team.map((m) => (
            <li key={m.id} className="py-2 flex justify-between items-center">
              <span>{m.full_name || m.email} <span className="text-xs text-slate-500">{m.email}</span></span>
              <span className="flex items-center gap-2">
                <span className="text-xs capitalize text-slate-600">{m.role}</span>
                {isAdmin && m.id !== profile?.id && <button onClick={() => setRole(m.email || '', 'customer')} className="text-xs text-red-600">Remove</button>}
              </span>
            </li>
          ))}
        </ul>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Registered user's email" className="flex-1 min-w-[200px] text-sm border border-slate-300 rounded-lg px-3 py-2" />
            <button disabled={!email} onClick={() => setRole(email, 'staff')} className="text-sm bg-slate-900 text-white rounded-lg px-3 py-2 disabled:opacity-40">Make staff</button>
            <button disabled={!email} onClick={() => setRole(email, 'admin')} className="text-sm border border-slate-300 rounded-lg px-3 py-2 disabled:opacity-40">Make admin</button>
          </div>
        )}
        {teamMsg && <p className="text-sm text-slate-600">{teamMsg}</p>}
      </div>
    </div>
  );
}
