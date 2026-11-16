import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { formatINR, type StoreSettings } from '@/lib/types';

const PAYMENT_OPTIONS = [
  { value: 'COD', label: 'Cash on delivery' },
  { value: 'UPI_ON_DELIVERY', label: 'UPI on delivery' },
  { value: 'CARD_ON_DELIVERY', label: 'Card on delivery' },
];

export default function Cart() {
  const router = useRouter();
  const cart = useCart();
  const { profile } = useAuth();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [address, setAddress] = useState('');
  const [payment, setPayment] = useState('COD');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSupabase().from('store_settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => setSettings(data as StoreSettings));
  }, []);
  useEffect(() => {
    if (profile?.default_address && !address) setAddress(profile.default_address);
  }, [profile, address]);

  const fee = settings ? (cart.subtotal >= Number(settings.free_delivery_threshold) ? 0 : Number(settings.delivery_fee)) : 0;

  async function placeOrder() {
    setBusy(true);
    setError('');
    const { data, error } = await getSupabase().rpc('place_order', {
      p_items: cart.lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity })),
      p_delivery_address: address,
      p_payment_method: payment,
      p_notes: notes || null,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (profile && !profile.default_address) {
      await getSupabase().from('profiles').update({ default_address: address }).eq('id', profile.id);
    }
    cart.clear();
    router.push(`/orders/${data.order_number}`);
  }

  if (cart.lines.length === 0) {
    return (
      <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-10 text-center">
        <p className="text-slate-600">Your cart is empty.</p>
        <Link href="/products" className="inline-block mt-4 bg-emerald-600 text-white rounded-lg px-4 py-2 text-sm">Browse products</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
        {cart.lines.map((l) => (
          <div key={l.product_id} className="p-4 flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-50 rounded-lg overflow-hidden flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {l.image_url && <img src={l.image_url} alt="" className="w-full h-full object-contain" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{l.name}</p>
              <p className="text-xs text-slate-500">{formatINR(l.price)} each</p>
            </div>
            <div className="flex items-center gap-2">
              <button aria-label="Decrease" onClick={() => cart.setQuantity(l.product_id, l.quantity - 1)} className="p-1.5 border rounded-lg"><Minus className="w-3 h-3" /></button>
              <span className="w-6 text-center text-sm">{l.quantity}</span>
              <button aria-label="Increase" onClick={() => cart.setQuantity(l.product_id, l.quantity + 1)} disabled={l.quantity >= l.max} className="p-1.5 border rounded-lg disabled:opacity-40"><Plus className="w-3 h-3" /></button>
            </div>
            <p className="w-20 text-right text-sm font-semibold">{formatINR(l.price * l.quantity)}</p>
            <button aria-label="Remove" onClick={() => cart.remove(l.product_id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 h-fit">
        <h3 className="font-semibold text-slate-800">Checkout</h3>
        <label className="block text-sm">
          <span className="text-slate-700">Delivery address</span>
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" placeholder="House no., street, area, city, PIN code" />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Payment (collected on delivery)</span>
          <select value={payment} onChange={(e) => setPayment(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2">
            {PAYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Delivery notes (optional)</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" />
        </label>
        <div className="text-sm space-y-1 border-t border-slate-100 pt-3">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatINR(cart.subtotal)}</span></div>
          <div className="flex justify-between"><span>Delivery</span><span>{fee === 0 ? 'Free' : formatINR(fee)}</span></div>
          {settings && fee > 0 && <p className="text-xs text-slate-500">Add {formatINR(Number(settings.free_delivery_threshold) - cart.subtotal)} more for free delivery.</p>}
          <div className="flex justify-between font-bold text-base pt-1"><span>Total</span><span>{formatINR(cart.subtotal + fee)}</span></div>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</p>}
        <button onClick={placeOrder} disabled={busy || !address.trim()} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-2.5 font-medium disabled:opacity-50">
          {busy ? 'Placing order…' : 'Place order'}
        </button>
        <p className="text-[11px] text-slate-400">Final prices and stock are confirmed by the store when you place the order.</p>
      </div>
    </div>
  );
}
