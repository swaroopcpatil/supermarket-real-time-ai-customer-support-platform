import React, { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import StatusBadge from '@/components/StatusBadge';
import type { Ticket } from '@/lib/types';

const CATEGORIES = ['GENERAL', 'ORDER', 'REFUND', 'PRODUCT', 'DELIVERY', 'PAYMENT', 'COMPLAINT'];

export default function Tickets() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: '', description: '', category: 'GENERAL' });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await getSupabase().from('tickets').select('*').eq('customer_id', userId).order('created_at', { ascending: false });
    setTickets((data as Ticket[]) || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    load();
    const supabase = getSupabase();
    const channel = supabase
      .channel(`tickets:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter: `customer_id=eq.${userId}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const { error } = await getSupabase().from('tickets').insert({ customer_id: userId, ...form, priority: 'MEDIUM' });
    if (error) setError(error.message);
    else {
      setForm({ subject: '', description: '', category: 'GENERAL' });
      setOpen(false);
      load();
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">Tickets are answered by our support team. You get a notification when they reply.</p>
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-sm bg-emerald-600 text-white rounded-lg px-3 py-2"><Plus className="w-4 h-4" /> New ticket</button>
      </div>

      {open && (
        <form onSubmit={create} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <input required maxLength={200} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Subject" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
          </select>
          <textarea required maxLength={4000} rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the problem. Include your order number if it is about an order." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <button className="text-sm bg-slate-900 text-white rounded-lg px-4 py-2">Submit ticket</button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading tickets…</p>
      ) : tickets.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-600">No support tickets yet.</div>
      ) : (
        tickets.map((t) => (
          <div key={t.id} className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-800">{t.subject}</p>
                <p className="text-xs text-slate-500">{t.ticket_number} · {t.category.toLowerCase()} · {new Date(t.created_at).toLocaleString('en-IN')}</p>
              </div>
              <div className="flex gap-2 items-start"><StatusBadge value={t.priority} /><StatusBadge value={t.status} /></div>
            </div>
            <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{t.description}</p>
            {t.resolution && <p className="text-sm mt-3 bg-emerald-50 text-emerald-800 rounded-lg p-3"><strong>Support team:</strong> {t.resolution}</p>}
          </div>
        ))
      )}
    </div>
  );
}
