import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ArrowLeft, Check } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import StatusBadge from '@/components/StatusBadge';
import { formatINR, type Order, type Refund, type StoreSettings } from '@/lib/types';

const STEPS = ['PLACED', 'CONFIRMED', 'PACKING', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export default function OrderDetail() {
  const router = useRouter();
  const orderNumber = typeof router.query.id === 'string' ? router.query.id.toUpperCase() : '';
  const [order, setOrder] = useState<Order | null>(null);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');

  const load = useCallback(async () => {
    if (!orderNumber) return;
    const supabase = getSupabase();
    const { data } = await supabase.from('orders').select('*, order_items(*)').eq('order_number', orderNumber).maybeSingle();
    setOrder(data as Order);
    if (data) {
      const { data: r } = await supabase.from('refunds').select('*').eq('order_id', data.id).order('created_at', { ascending: false });
      setRefunds((r as Refund[]) || []);
    }
    setLoading(false);
  }, [orderNumber]);

  useEffect(() => {
    load();
    getSupabase().from('store_settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => setSettings(data as StoreSettings));
  }, [load]);

  useEffect(() => {
    if (!order?.id) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel(`order:${order.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` }, (payload) => {
        setOrder((prev) => (prev ? { ...prev, ...(payload.new as Order) } : prev));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'refunds', filter: `order_id=eq.${order.id}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [order?.id, load]);

  async function cancel() {
    if (!order || !confirm(`Cancel order ${order.order_number}?`)) return;
    const { error } = await getSupabase().rpc('cancel_order', { p_order_number: order.order_number, p_reason: 'Cancelled from order page' });
    setMessage(error ? { kind: 'error', text: error.message } : { kind: 'ok', text: 'Order cancelled.' });
    load();
  }

  async function submitRefund(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;
    const { data, error } = await getSupabase().rpc('request_refund', {
      p_order_number: order.order_number,
      p_reason: reason,
      p_amount: amount ? Number(amount) : null,
    });
    if (error) setMessage({ kind: 'error', text: error.message });
    else {
      setMessage({ kind: 'ok', text: `Refund request ${data.refund_number} submitted. Our team will review it.` });
      setRefundOpen(false);
      setReason('');
      setAmount('');
      load();
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading order…</p>;
  if (!order) return <p className="text-sm text-slate-600">Order not found. <Link href="/orders" className="text-emerald-700">Back to orders</Link></p>;

  const cancellable = settings?.cancellable_statuses.includes(order.status);
  const stepIndex = STEPS.indexOf(order.status);
  const deliveredAt = order.delivered_at ? new Date(order.delivered_at).getTime() : null;
  const refundOpenWindow = order.status === 'DELIVERED' && settings && deliveredAt && Date.now() - deliveredAt < settings.refund_window_hours * 3600 * 1000;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Link href="/orders" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="w-4 h-4" /> All orders</Link>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-slate-800">{order.order_number}</h1>
            <p className="text-xs text-slate-500">Placed {new Date(order.created_at).toLocaleString('en-IN')}</p>
          </div>
          <StatusBadge value={order.status} />
        </div>

        {order.status !== 'CANCELLED' && (
          <ol className="mt-5 grid grid-cols-5 gap-1">
            {STEPS.map((s, i) => (
              <li key={s} className="text-center">
                <div className={`mx-auto w-7 h-7 rounded-full flex items-center justify-center text-xs ${i <= stepIndex ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  {i <= stepIndex ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <p className="text-[10px] sm:text-xs mt-1 text-slate-600">{s.replace(/_/g, ' ')}</p>
              </li>
            ))}
          </ol>
        )}
        <p className="text-[11px] text-slate-400 mt-3">Status updates live as the store processes your order.</p>
      </div>

      {message && <p className={`text-sm rounded-lg p-3 ${message.kind === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{message.text}</p>}

      <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
        {order.order_items?.map((it) => (
          <div key={it.id} className="p-4 flex justify-between text-sm">
            <span>{it.name} × {it.quantity}</span>
            <span className="font-medium">{formatINR(it.unit_price * it.quantity)}</span>
          </div>
        ))}
        <div className="p-4 text-sm space-y-1">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatINR(order.subtotal)}</span></div>
          <div className="flex justify-between"><span>Delivery</span><span>{Number(order.delivery_fee) === 0 ? 'Free' : formatINR(order.delivery_fee)}</span></div>
          <div className="flex justify-between font-bold"><span>Total</span><span>{formatINR(order.total_amount)}</span></div>
          <p className="text-xs text-slate-500 pt-2">{order.payment_method.replace(/_/g, ' ')} · Payment {order.payment_status.toLowerCase().replace(/_/g, ' ')}</p>
          <p className="text-xs text-slate-500">Deliver to: {order.delivery_address}</p>
        </div>
      </div>

      {refunds.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
          <h3 className="text-sm font-semibold">Refund requests</h3>
          {refunds.map((r) => (
            <div key={r.id} className="text-sm flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-2">
              <span>{r.refund_number} · {formatINR(r.amount)} · {r.reason}</span>
              <span className="flex items-center gap-2"><StatusBadge value={r.status} />{r.staff_note && <span className="text-xs text-slate-500">{r.staff_note}</span>}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {cancellable && <button onClick={cancel} className="px-4 py-2 text-sm border border-red-200 text-red-700 rounded-lg hover:bg-red-50">Cancel order</button>}
        {refundOpenWindow && <button onClick={() => setRefundOpen((o) => !o)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Request refund</button>}
        <Link href={`/chat?order=${order.order_number}`} className="px-4 py-2 text-sm bg-slate-900 text-white rounded-lg">Get help with this order</Link>
      </div>

      {refundOpen && (
        <form onSubmit={submitRefund} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          <label className="block text-sm">
            <span className="text-slate-700">What went wrong?</span>
            <textarea required value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" placeholder="e.g. The butter packet was leaking" />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Amount (leave empty for the full order)</span>
            <input type="number" min="1" step="0.01" max={order.total_amount} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" />
          </label>
          <button className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg">Submit refund request</button>
        </form>
      )}
    </div>
  );
}
