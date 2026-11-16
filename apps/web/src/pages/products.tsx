import React, { useEffect, useMemo, useState } from 'react';
import { Check, Package, Search, ShoppingCart } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import { useCart } from '@/lib/cart';
import { formatINR, type Product } from '@/lib/types';

export default function Products() {
  const cart = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .not('price', 'is', null)
      .order('name')
      .limit(1000)
      .then(({ data }) => {
        setProducts((data as Product[]) || []);
        setLoading(false);
      });

    // Live price and stock updates from the store.
    const channel = supabase
      .channel('products-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
        setProducts((prev) => {
          if (payload.eventType === 'DELETE') return prev.filter((p) => p.id !== (payload.old as Product).id);
          const p = payload.new as Product;
          const visible = p.is_active && p.price !== null;
          const rest = prev.filter((x) => x.id !== p.id);
          return visible ? [...rest, p].sort((a, b) => a.name.localeCompare(b.name)) : rest;
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const categories = useMemo(() => ['All', ...Array.from(new Set(products.map((p) => p.category))).sort()], [products]);
  const filtered = products.filter((p) => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || `${p.name} ${p.brand ?? ''} ${p.category}`.toLowerCase().includes(q);
    return matchesQuery && (category === 'All' || p.category === category);
  });

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products or brands" className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl bg-white" />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="border border-slate-300 rounded-xl px-3 py-2.5 bg-white">
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading catalogue…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <Package className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="mt-3 text-slate-600">{products.length === 0 ? 'The store has not published any products yet.' : 'No products match your search.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((p) => {
            const out = p.stock_quantity <= 0;
            const inCart = cart.lines.find((l) => l.product_id === p.id)?.quantity ?? 0;
            return (
              <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col">
                <div className="aspect-square bg-slate-50 rounded-xl flex items-center justify-center overflow-hidden">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.name} loading="lazy" className="object-contain w-full h-full" />
                  ) : (
                    <Package className="w-10 h-10 text-slate-300" />
                  )}
                </div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400 mt-3">{p.brand || p.category}</p>
                <h3 className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">{p.name}</h3>
                {p.quantity_label && <p className="text-xs text-slate-500">{p.quantity_label}</p>}
                <div className="mt-auto pt-3">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-slate-900">{formatINR(p.price)}</span>
                    {p.mrp && p.price !== null && p.mrp > p.price && <span className="text-xs text-slate-400 line-through">{formatINR(p.mrp)}</span>}
                  </div>
                  <p className={`text-xs ${out ? 'text-red-600' : p.stock_quantity <= 5 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {out ? 'Out of stock' : p.stock_quantity <= 5 ? `Only ${p.stock_quantity} left` : 'In stock'}
                  </p>
                  <button
                    disabled={out || inCart >= Math.min(p.stock_quantity, 50)}
                    onClick={() => {
                      cart.add(p);
                      setAdded(p.id);
                      setTimeout(() => setAdded((a) => (a === p.id ? null : a)), 1200);
                    }}
                    className="mt-2 w-full flex items-center justify-center gap-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-2 disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    {added === p.id ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
                    {added === p.id ? 'Added' : inCart ? `Add (${inCart} in cart)` : 'Add to cart'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[11px] text-slate-400 text-center">Product information and images from Open Food Facts (openfoodfacts.org), available under the Open Database License.</p>
    </div>
  );
}
