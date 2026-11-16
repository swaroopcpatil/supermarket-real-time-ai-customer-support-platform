import React, { useCallback, useEffect, useState } from 'react';
import Papa from 'papaparse';
import { Download, Package, Search, Upload } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import { authFetch } from '@/lib/auth';
import { formatINR, type Product } from '@/lib/types';

interface SearchHit {
  barcode: string;
  name: string;
  brand: string | null;
  category: string;
  quantity_label: string | null;
  image_url: string | null;
  already_imported: boolean;
}

interface ImportRow { barcode: string; name?: string | null; brand?: string | null; category?: string | null; price?: number | null; mrp?: number | null; stock?: number | null }

const CSV_TEMPLATE = 'barcode,price,mrp,stock,name,brand,category\n8901262010016,58,60,40,,,\n8901058000290,14,14,120,,,\n';

function num(v: unknown): number | null {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = Number(String(v).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function ProductRow({ p, onSaved }: { p: Product; onSaved: () => void }) {
  const [price, setPrice] = useState(p.price?.toString() ?? '');
  const [mrp, setMrp] = useState(p.mrp?.toString() ?? '');
  const [stock, setStock] = useState(String(p.stock_quantity));
  const [state, setState] = useState('');
  const dirty = price !== (p.price?.toString() ?? '') || mrp !== (p.mrp?.toString() ?? '') || stock !== String(p.stock_quantity);

  useEffect(() => {
    setPrice(p.price?.toString() ?? '');
    setMrp(p.mrp?.toString() ?? '');
    setStock(String(p.stock_quantity));
  }, [p.price, p.mrp, p.stock_quantity]);

  async function save() {
    setState('…');
    const { error } = await getSupabase()
      .from('products')
      .update({ price: num(price), mrp: num(mrp), stock_quantity: Math.max(0, Math.floor(num(stock) ?? 0)) })
      .eq('id', p.id);
    setState(error ? error.message : 'Saved');
    if (!error) onSaved();
  }

  async function toggleActive() {
    await getSupabase().from('products').update({ is_active: !p.is_active }).eq('id', p.id);
    onSaved();
  }

  const live = p.is_active && p.price !== null && p.stock_quantity > 0;
  return (
    <tr className={`border-t border-slate-100 ${!p.is_active ? 'opacity-50' : ''}`}>
      <td className="p-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-slate-50 rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-contain" /> : <Package className="w-4 h-4 text-slate-300" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate max-w-[220px]">{p.name}</p>
            <p className="text-[11px] text-slate-500">{p.brand} · {p.category} · {p.barcode}</p>
          </div>
        </div>
      </td>
      <td className="p-2"><input aria-label="Price" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="—" className="w-20 border border-slate-300 rounded px-2 py-1 text-sm" /></td>
      <td className="p-2"><input aria-label="MRP" value={mrp} onChange={(e) => setMrp(e.target.value)} placeholder="—" className="w-20 border border-slate-300 rounded px-2 py-1 text-sm" /></td>
      <td className="p-2"><input aria-label="Stock" value={stock} onChange={(e) => setStock(e.target.value)} className="w-16 border border-slate-300 rounded px-2 py-1 text-sm" /></td>
      <td className="p-2 text-xs">
        {live ? <span className="text-emerald-700">Live</span> : !p.is_active ? <span className="text-slate-500">Hidden</span> : p.price === null ? <span className="text-amber-700">Needs price</span> : <span className="text-red-600">Out of stock</span>}
      </td>
      <td className="p-2 whitespace-nowrap">
        <button onClick={save} disabled={!dirty} className="text-xs bg-emerald-600 text-white rounded px-2 py-1 disabled:opacity-30">Save</button>
        <button onClick={toggleActive} className="text-xs ml-2 text-slate-500 hover:text-slate-800">{p.is_active ? 'Hide' : 'Show'}</button>
        {state && <span className="text-[11px] ml-2 text-slate-500">{state}</span>}
      </td>
    </tr>
  );
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState('');
  const [view, setView] = useState<'all' | 'unpriced' | 'low'>('all');
  const [importMsg, setImportMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [barcodes, setBarcodes] = useState('');
  const [offQuery, setOffQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const { data } = await getSupabase().from('products').select('*').order('name').limit(2000);
    setProducts((data as Product[]) || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runImport(rows: ImportRow[]) {
    setBusy(true);
    setImportMsg(`Importing ${rows.length} product(s)…`);
    let created = 0, updated = 0, skipped = 0;
    const problems: string[] = [];
    for (let i = 0; i < rows.length; i += 50) {
      const res = await authFetch('/api/admin/import', { method: 'POST', body: JSON.stringify({ mode: 'barcodes', rows: rows.slice(i, i + 50) }) });
      const body = await res.json();
      if (!res.ok) {
        problems.push(body.error || `HTTP ${res.status}`);
        break;
      }
      created += body.created;
      updated += body.updated;
      skipped += body.skipped;
      for (const r of body.report) if (r.status === 'skipped') problems.push(`${r.barcode}: ${r.message}`);
      setImportMsg(`Imported ${Math.min(i + 50, rows.length)} of ${rows.length}…`);
    }
    setBusy(false);
    setImportMsg(`Done: ${created} created, ${updated} updated, ${skipped} skipped.${problems.length ? ` Problems: ${problems.slice(0, 5).join('; ')}${problems.length > 5 ? '…' : ''}` : ''}`);
    load();
  }

  function onCsv(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (result) => {
        const rows: ImportRow[] = [];
        const bad: string[] = [];
        for (const r of result.data) {
          const barcode = String(r.barcode || r.ean || r.code || '').replace(/\D/g, '');
          if (barcode.length < 8 || barcode.length > 14) {
            bad.push(r.barcode || '(blank)');
            continue;
          }
          rows.push({
            barcode,
            price: num(r.price ?? r.selling_price),
            mrp: num(r.mrp),
            stock: num(r.stock ?? r.quantity ?? r.stock_quantity) !== null ? Math.floor(num(r.stock ?? r.quantity ?? r.stock_quantity) as number) : null,
            name: r.name?.trim() || null,
            brand: r.brand?.trim() || null,
            category: r.category?.trim() || null,
          });
        }
        if (bad.length) setImportMsg(`Skipping ${bad.length} row(s) without a valid barcode.`);
        if (rows.length) runImport(rows);
      },
      error: (err) => setImportMsg(`Could not read CSV: ${err.message}`),
    });
  }

  async function search() {
    setBusy(true);
    setHits([]);
    setSelected(new Set());
    const res = await authFetch('/api/admin/import', { method: 'POST', body: JSON.stringify({ mode: 'search', query: offQuery }) });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) setImportMsg(body.error || 'Search failed');
    else {
      setHits(body.results);
      setImportMsg(body.results.length ? '' : 'No matches on Open Food Facts.');
    }
  }

  const visible = products.filter((p) => {
    const q = filter.trim().toLowerCase();
    if (q && !`${p.name} ${p.brand ?? ''} ${p.barcode ?? ''} ${p.category}`.toLowerCase().includes(q)) return false;
    if (view === 'unpriced') return p.price === null;
    if (view === 'low') return p.price !== null && p.stock_quantity <= 5;
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
          <h4 className="font-semibold text-sm flex items-center gap-2"><Upload className="w-4 h-4" /> Import CSV from your POS</h4>
          <p className="text-xs text-slate-500">Columns: barcode, price, mrp, stock (optional: name, brand, category). Names and images are filled in from Open Food Facts.</p>
          <input type="file" accept=".csv,text/csv" disabled={busy} onChange={(e) => e.target.files?.[0] && onCsv(e.target.files[0])} className="text-xs" />
          <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`} download="products-template.csv" className="text-xs text-emerald-700 inline-flex items-center gap-1"><Download className="w-3 h-3" /> Download template</a>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
          <h4 className="font-semibold text-sm">Add by barcode</h4>
          <textarea value={barcodes} onChange={(e) => setBarcodes(e.target.value)} rows={3} placeholder="Scan or paste barcodes, one per line" className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2" />
          <button
            disabled={busy || !barcodes.trim()}
            onClick={() => runImport(barcodes.split(/[\s,]+/).map((b) => b.replace(/\D/g, '')).filter((b) => b.length >= 8 && b.length <= 14).map((barcode) => ({ barcode })))}
            className="text-sm bg-slate-900 text-white rounded-lg px-3 py-1.5 disabled:opacity-40"
          >
            Look up &amp; add
          </button>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
          <h4 className="font-semibold text-sm flex items-center gap-2"><Search className="w-4 h-4" /> Search Open Food Facts (India)</h4>
          <div className="flex gap-2">
            <input value={offQuery} onChange={(e) => setOffQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && offQuery.trim().length > 1 && search()} placeholder="e.g. amul, parle, basmati" className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-1.5" />
            <button disabled={busy || offQuery.trim().length < 2} onClick={search} className="text-sm bg-slate-900 text-white rounded-lg px-3 disabled:opacity-40">Search</button>
          </div>
          <p className="text-[11px] text-slate-400">Pick products to add to your catalogue, then set prices below.</p>
        </div>
      </div>

      {importMsg && <p className="text-sm bg-slate-100 rounded-lg p-3">{importMsg}</p>}

      {hits.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm font-semibold">{hits.length} result(s) from Open Food Facts</p>
            <button
              disabled={busy || selected.size === 0}
              onClick={() => {
                runImport([...selected].map((barcode) => ({ barcode })));
                setHits([]);
              }}
              className="text-sm bg-emerald-600 text-white rounded-lg px-3 py-1.5 disabled:opacity-40"
            >
              Add {selected.size} selected
            </button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {hits.map((h) => (
              <label key={h.barcode} className={`flex items-center gap-2 border rounded-xl p-2 text-sm ${h.already_imported ? 'opacity-50' : 'cursor-pointer hover:border-emerald-300'}`}>
                <input
                  type="checkbox"
                  disabled={h.already_imported}
                  checked={selected.has(h.barcode)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(h.barcode);
                    else next.delete(h.barcode);
                    setSelected(next);
                  }}
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {h.image_url ? <img src={h.image_url} alt="" className="w-10 h-10 object-contain" /> : <Package className="w-10 h-10 text-slate-200" />}
                <span className="min-w-0">
                  <span className="block truncate">{h.name}</span>
                  <span className="block text-[11px] text-slate-500">{h.brand} · {h.quantity_label || h.category}{h.already_imported ? ' · already added' : ''}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-3 flex flex-wrap gap-2 items-center border-b border-slate-100">
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter catalogue" className="text-sm border border-slate-300 rounded-lg px-3 py-1.5" />
          {(['all', 'unpriced', 'low'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`text-xs px-3 py-1.5 rounded-full border ${view === v ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300'}`}>
              {v === 'all' ? `All (${products.length})` : v === 'unpriced' ? `Needs price (${products.filter((p) => p.price === null).length})` : 'Low stock'}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[11px] uppercase text-slate-500 bg-slate-50">
              <tr><th className="p-2">Product</th><th className="p-2">Price ₹</th><th className="p-2">MRP ₹</th><th className="p-2">Stock</th><th className="p-2">Status</th><th className="p-2" /></tr>
            </thead>
            <tbody>
              {visible.map((p) => <ProductRow key={p.id} p={p} onSaved={load} />)}
            </tbody>
          </table>
          {visible.length === 0 && <p className="p-6 text-sm text-slate-500">No products.</p>}
        </div>
        <p className="p-3 text-[11px] text-slate-400">Customers only see products that are visible and priced; out-of-stock items show as unavailable. Price changes reach shoppers instantly. Example: {formatINR(58)}.</p>
      </div>
    </div>
  );
}
