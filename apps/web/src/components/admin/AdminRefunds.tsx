import React, { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import StatusBadge from '@/components/StatusBadge';
import { formatINR, type Refund } from '@/lib/types';

type Row = Refund & { orders: { order_number: string; total_amount: number } | null; profiles: { full_name: string | null; email: string | null } | null };

export default function AdminRefunds() {
  const [refunds, setRefunds] = useState<Row[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    let q = getSupabase().from('refunds').select('*, orders(order_number, total_amount), profiles!refunds_customer_id_fkey(full_name, email)').order('created_at', { ascending: false }).limit(200);
    if (!showAll) q = q.eq('status', 'PENDING');
    const { data, error } = await q;
    if (error) setError(error.message);
    setRefunds((data as Row[]) || []);
  }, [showAll]);

  useEffect(() => {
    load();
    const supabase = getSupabase();
    const channel = supabase.channel('admin-refunds').on('postgres_changes', { event: '*', schema: 'public', table: 'refunds' }, () => load()).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  async function review(r: Row, approve: boolean) {
    setError('');
    const { error } = await getSupabase().rpc('review_refund', { p_refund_id: r.id, p_approve: approve, p_note: notes[r.id] || null });
    if (error) setError(error.message);
    load();
  }

  return (
    <div className="space-y-3">
      <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show reviewed refunds</label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
        {refunds.length === 0 && <p className="p-6 text-sm text-slate-500">No refund requests waiting.</p>}
        {refunds.map((r) => (
          <div key={r.id} className="p-4 space-y-2">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-semibold text-sm">{r.refund_number} · {formatINR(r.amount)} <span className="font-normal text-slate-500">of {formatINR(r.orders?.total_amount)} on {r.orders?.order_number}</span></p>
                <p className="text-xs text-slate-500">{r.profiles?.full_name || r.profiles?.email} · {new Date(r.created_at).toLocaleString('en-IN')}</p>
              </div>
              <StatusBadge value={r.status} />
            </div>
            <p className="text-sm text-slate-700">“{r.reason}”</p>
            {r.status === 'PENDING' ? (
              <div className="flex flex-wrap gap-2">
                <input value={notes[r.id] || ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} placeholder="Note to customer (optional)" className="flex-1 min-w-[200px] text-sm border border-slate-300 rounded-lg px-3 py-1.5" />
                <button onClick={() => review(r, true)} className="text-sm bg-emerald-600 text-white rounded-lg px-3 py-1.5">Approve</button>
                <button onClick={() => review(r, false)} className="text-sm border border-red-200 text-red-700 rounded-lg px-3 py-1.5">Reject</button>
              </div>
            ) : (
              r.staff_note && <p className="text-xs text-slate-500">Note: {r.staff_note}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
