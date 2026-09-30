import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, Clock, CheckCircle2, Truck, AlertCircle } from 'lucide-react';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
}

interface Order {
  id: string;
  customer_id: string;
  status: string;
  total_amount: number;
  delivery_address: string;
  estimated_delivery: string;
  items: OrderItem[];
  created_at: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/orders?customer_id=CUS-DEMO');
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'OUT_FOR_DELIVERY':
        return <span className="bg-amber-100 text-amber-800 text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> Out for Delivery</span>;
      case 'DELIVERED':
        return <span className="bg-emerald-100 text-emerald-800 text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Delivered</span>;
      case 'CANCELLED':
        return <span className="bg-rose-100 text-rose-800 text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Cancelled</span>;
      default:
        return <span className="bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">My Orders & Tracking</h1>
          <p className="text-xs text-slate-500 mt-1">Real-time status updates powered by Order Service</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 font-medium">Loading customer orders...</div>
      ) : (
        <div className="space-y-4">
          {orders.map((ord) => (
            <div key={ord.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center space-x-3">
                    <Link href={`/orders/${ord.id}`} className="font-extrabold text-slate-900 text-lg hover:text-emerald-700">{ord.id}</Link>
                    {statusBadge(ord.status)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Delivery Address: {ord.delivery_address}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Total Amount</p>
                  <p className="text-xl font-extrabold text-slate-900">₹{ord.total_amount}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Ordered Items</p>
                <div className="divide-y divide-slate-100">
                  {ord.items.map((item, idx) => (
                    <div key={idx} className="py-2 flex items-center justify-between text-sm">
                      <span className="text-slate-700 font-medium">{item.name} × {item.quantity}</span>
                      <span className="text-slate-900 font-semibold">₹{item.unit_price * item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-xs text-slate-500">
                <span>Estimated Delivery: <strong className="text-slate-800">{ord.estimated_delivery}</strong></span>
                <Link href={`/chat?query=Where is my order ${ord.id}`} className="text-emerald-600 hover:underline font-bold">
                  Ask AI Assistant About This Order →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
