import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function OrderDetailPage() {
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (typeof router.query.id !== 'string') return;
    fetch(`/api/orders/${encodeURIComponent(router.query.id)}`).then(async (res) => {
      if (!res.ok) throw new Error('Order not found');
      return res.json();
    }).then(setOrder).catch((err) => setError(err.message));
  }, [router.query.id]);
  if (error) return <div className="bg-white rounded-2xl border border-rose-200 p-6 text-rose-700">{error}</div>;
  if (!order) return <p className="text-slate-500">Loading order…</p>;
  return <div className="max-w-3xl space-y-5">
    <Link className="text-sm font-semibold text-emerald-700 hover:underline" href="/orders">← Back to orders</Link>
    <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"><p className="text-xs text-slate-500">Order</p><h1 className="text-2xl font-bold text-slate-900">{order.id}</h1><p className="mt-3 text-sm">Status: <strong>{order.status}</strong></p><p className="text-sm">Estimated delivery: <strong>{order.estimated_delivery}</strong></p><p className="text-sm">Total: <strong>₹{order.total_amount}</strong></p></section>
    <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"><h2 className="font-bold text-slate-900">Items</h2><div className="mt-3 space-y-2">{order.items?.map((item: any) => <div key={item.id} className="flex justify-between text-sm"><span>{item.name} × {item.quantity}</span><span>₹{item.unit_price * item.quantity}</span></div>)}</div></section>
    <Link href={`/chat?query=${encodeURIComponent(`Where is my order ${order.id}?`)}`} className="inline-block bg-emerald-600 text-white font-semibold px-4 py-2 rounded-xl text-sm">Ask AI about this order</Link>
  </div>;
}
