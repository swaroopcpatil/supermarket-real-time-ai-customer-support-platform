import React, { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import StatusBadge from '@/components/StatusBadge';
import type { Ticket } from '@/lib/types';

type Row = Ticket & { profiles: { full_name: string | null; email: string | null; phone: string | null } | null; orders: { order_number: string } | null };

interface Msg { role: string; content: string; created_at: string }

export default function AdminTickets() {
  const { session } = useAuth();
  const [tickets, setTickets] = useState<Row[]>([]);
  const [showClosed, setShowClosed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<Msg[]>([]);
  const [resolution, setResolution] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    let q = getSupabase().from('tickets').select('*, profiles!tickets_customer_id_fkey(full_name, email, phone), orders(order_number)').order('created_at', { ascending: false }).limit(200);
    if (!showClosed) q = q.in('status', ['OPEN', 'IN_PROGRESS']);
    const { data, error } = await q;
    if (error) setError(error.message);
    setTickets((data as Row[]) || []);
  }, [showClosed]);

  useEffect(() => {
    load();
    const supabase = getSupabase();
    const channel = supabase.channel('admin-tickets').on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => load()).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  async function open(t: Row) {
    if (openId === t.id) {
      setOpenId(null);
      return;
    }
    setOpenId(t.id);
    setResolution(t.resolution || '');
    setTranscript([]);
    if (t.conversation_id) {
      const { data } = await getSupabase().from('chat_messages').select('role, content, created_at').eq('conversation_id', t.conversation_id).order('created_at');
      setTranscript((data as Msg[]) || []);
    }
  }

  async function update(t: Row, status: string) {
    setError('');
    const { error } = await getSupabase()
      .from('tickets')
      .update({ status, resolution: resolution.trim() || null, assigned_to: session?.user.id })
      .eq('id', t.id);
    if (error) setError(error.message);
    load();
  }

  return (
    <div className="space-y-3">
      <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> Show resolved and closed</label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
        {tickets.length === 0 && <p className="p-6 text-sm text-slate-500">No open tickets.</p>}
        {tickets.map((t) => (
          <div key={t.id} className="p-4">
            <button onClick={() => open(t)} className="w-full text-left flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-semibold text-sm">{t.subject}</p>
                <p className="text-xs text-slate-500">{t.ticket_number} · {t.profiles?.full_name || t.profiles?.email} · {t.category.toLowerCase()}{t.orders ? ` · ${t.orders.order_number}` : ''} · {new Date(t.created_at).toLocaleString('en-IN')}</p>
              </div>
              <div className="flex gap-2"><StatusBadge value={t.priority} /><StatusBadge value={t.status} /></div>
            </button>
            {openId === t.id && (
              <div className="mt-3 space-y-3">
                <p className="text-sm whitespace-pre-wrap bg-slate-50 rounded-xl p-3">{t.description}</p>
                {t.profiles?.phone && <p className="text-xs text-slate-500">Customer phone: {t.profiles.phone} · {t.profiles.email}</p>}
                {transcript.length > 0 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-slate-600">AI chat transcript ({transcript.length} messages)</summary>
                    <div className="mt-2 max-h-72 overflow-y-auto space-y-2 bg-slate-50 rounded-xl p-3">
                      {transcript.map((m, i) => (
                        <p key={i} className="whitespace-pre-wrap"><strong className={m.role === 'user' ? 'text-slate-800' : 'text-emerald-700'}>{m.role === 'user' ? 'Customer' : 'Assistant'}:</strong> {m.content}</p>
                      ))}
                    </div>
                  </details>
                )}
                <textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={3} placeholder="Reply / resolution shown to the customer" className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2" />
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => update(t, 'IN_PROGRESS')} className="text-sm border border-slate-300 rounded-lg px-3 py-1.5">Mark in progress</button>
                  <button onClick={() => update(t, 'RESOLVED')} className="text-sm bg-emerald-600 text-white rounded-lg px-3 py-1.5">Resolve</button>
                  <button onClick={() => update(t, 'CLOSED')} className="text-sm border border-slate-300 rounded-lg px-3 py-1.5">Close</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
