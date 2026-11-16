import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Package } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import StatusBadge from '@/components/StatusBadge';
import { formatINR, type Order } from '@/lib/types';

export default function Orders() {
  const { session } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabase();
    supabase
      .from('orders')
      .select('*, order_items(id, name, quantity, unit_price, product_id)')
      .eq('customer_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOrders((data as Order[]) || []);
        setLoading(false);
      });

    const channel = supabase
      .channel(`orders:${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `customer_id=eq.${userId}` }, (payload) => {
        const updated = payload.new as Order;
        setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (loading) return <p className="text-sm text-slate-500">Loading orders…</p>;
  if (orders.length === 0) {
    return (
      <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-10 text-center">
        <Package className="w-10 h-10 text-slate-300 mx-auto" />
        <p className="mt-3 text-slate-600">You have not placed any orders yet.</p>
        <Link href="/products" className="inline-block mt-4 bg-emerald-600 text-white rounded-lg px-4 py-2 text-sm">Start shopping</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-3">
      {orders.map((o) => (
        <Link key={o.id} href={`/orders/${o.order_number}`} className="block bg-white border border-slate-200 rounded-2xl p-4 hover:border-emerald-300">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-800">{o.order_number}</p>
              <p className="text-xs text-slate-500">{new Date(o.created_at).toLocaleString('en-IN')} · {o.order_items?.length ?? 0} item(s)</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge value={o.status} />
              <span className="font-semibold text-sm">{formatINR(o.total_amount)}</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
