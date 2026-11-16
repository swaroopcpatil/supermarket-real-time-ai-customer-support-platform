import React, { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import StatusBadge from '@/components/StatusBadge';
import { formatINR, ORDER_STATUSES, type Order } from '@/lib/types';

type Row = Order & { profiles: { full_name: string | null; email: string | null; phone: string | null } | null };

export default function AdminOrders() {
  const [orders, setOrders] = useState<Row[]>([]);
  const [filter, setFilter] = useState('ACTIVE');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    let q = getSupabase().from('orders').select('*, order_items(*), profiles(full_name, email, phone)').order('created_at', { ascending: false }).limit(200);
    if (filter === 'ACTIVE') q = q.not('status', 'in', '(DELIVERED,CANCELLED)');
    else if (filter !== 'ALL') q = q.eq('status', filter);
    const { data } = await q;
    setOrders((data as Row[]) || []);
  }, [filter]);

  useEffect(() => {
    load();
    const supabase = getSupabase();
    const channel = supabase.channel('admin-orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load()).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  async function setStatus(o: Row, status: string) {
    if (status === 'CANCELLED' && !confirm(`Cancel ${o.order_number}? Stock will be returned.`)) return;
    setError('');
    const { error } = await getSupabase().rpc('set_order_status', { p_order_id: o.id, p_status: status });
    if (error) setError(`${o.order_number}: ${error.message}`);
    load();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {['ACTIVE', 'ALL', ...ORDER_STATUSES].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`text-xs px-3 py-1.5 rounded-full border ${filter === s ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300'}`}>
            {s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
        {orders.length === 0 && <p className="p-6 text-sm text-slate-500">No orders.</p>}
        {orders.map((o) => (
          <div key={o.id} className="p-4">
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <button onClick={() => setExpanded(expanded === o.id ? null : o.id)} className="text-left">
                <p className="font-semibold text-sm">{o.order_number} <span className="font-normal text-slate-500">· {o.profiles?.full_name || o.profiles?.email}</span></p>
                <p className="text-xs text-slate-500">{new Date(o.created_at).toLocaleString('en-IN')} · {formatINR(o.total_amount)} · {o.payment_method.replace(/_/g, ' ')}</p>
              </button>
              <div className="flex items-center gap-2">
                <StatusBadge value={o.status} />
                <select value={o.status} onChange={(e) => setStatus(o, e.target.value)} disabled={o.status === 'CANCELLED'} className="text-xs border border-slate-300 rounded-lg px-2 py-1">
                  {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>
            {expanded === o.id && (
              <div className="mt-3 text-sm bg-slate-50 rounded-xl p-3 space-y-1">
                {o.order_items?.map((it) => <p key={it.id}>{it.quantity} × {it.name} — {formatINR(it.unit_price * it.quantity)}</p>)}
                <p className="text-xs text-slate-500 pt-2">Deliver to: {o.delivery_address}</p>
                {o.profiles?.phone && <p className="text-xs text-slate-500">Phone: {o.profiles.phone}</p>}
                {o.notes && <p className="text-xs text-slate-500 whitespace-pre-wrap">Notes: {o.notes}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
