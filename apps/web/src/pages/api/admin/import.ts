import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { supabaseForToken } from '@/lib/supabase';
import { fetchManyByBarcode, searchProducts } from '@/lib/openfoodfacts';

export const config = { maxDuration: 60 };

const Row = z.object({
  barcode: z.string().trim().regex(/^\d{8,14}$/, 'Barcode must be 8-14 digits'),
  name: z.string().trim().max(160).optional().nullable(),
  brand: z.string().trim().max(80).optional().nullable(),
  category: z.string().trim().max(60).optional().nullable(),
  price: z.number().nonnegative().optional().nullable(),
  mrp: z.number().nonnegative().optional().nullable(),
  stock: z.number().int().nonnegative().optional().nullable(),
});

const Body = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('search'), query: z.string().trim().min(2).max(100) }),
  z.object({ mode: z.literal('barcodes'), rows: z.array(Row).min(1).max(100) }),
]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Not signed in' });

  const db = supabaseForToken(token);
  const { data: isStaff, error: roleError } = await db.rpc('is_staff');
  if (roleError || !isStaff) return res.status(403).json({ error: 'Staff only' });

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });

  if (parsed.data.mode === 'search') {
    try {
      const results = await searchProducts(parsed.data.query);
      const codes = results.map((r) => r.barcode);
      const { data: existing } = codes.length
        ? await db.from('products').select('barcode').in('barcode', codes)
        : { data: [] as { barcode: string }[] };
      const have = new Set((existing || []).map((e) => e.barcode));
      return res.status(200).json({ results: results.map((r) => ({ ...r, already_imported: have.has(r.barcode) })) });
    } catch (err) {
      return res.status(502).json({ error: err instanceof Error ? err.message : 'Open Food Facts search failed. Try importing by barcode.' });
    }
  }

  // Barcode import: enrich each row from Open Food Facts, keep store-owned
  // fields (price, MRP, stock) from the uploaded row.
  const rows = parsed.data.rows;
  const off = await fetchManyByBarcode(rows.map((r) => r.barcode));
  const { data: existingRows } = await db.from('products').select('id, barcode').in('barcode', rows.map((r) => r.barcode));
  const existing = new Map((existingRows || []).map((e) => [e.barcode as string, e.id as string]));

  const report: { barcode: string; status: 'created' | 'updated' | 'skipped'; name?: string; message?: string }[] = [];
  for (const row of rows) {
    const info = off.get(row.barcode) || null;
    const name = info?.name || row.name || null;
    if (!name && !existing.has(row.barcode)) {
      report.push({ barcode: row.barcode, status: 'skipped', message: 'Not found on Open Food Facts; add a name column to create it manually' });
      continue;
    }

    const storeFields: Record<string, unknown> = {};
    if (row.price !== undefined && row.price !== null) storeFields.price = row.price;
    if (row.mrp !== undefined && row.mrp !== null) storeFields.mrp = row.mrp;
    if (row.stock !== undefined && row.stock !== null) storeFields.stock_quantity = row.stock;

    const catalogFields: Record<string, unknown> = info
      ? {
          name: row.name || info.name,
          brand: row.brand || info.brand,
          category: row.category || info.category,
          quantity_label: info.quantity_label,
          description: info.description,
          ingredients: info.ingredients,
          nutriscore_grade: info.nutriscore_grade,
          image_url: info.image_url,
          source: 'openfoodfacts',
          source_synced_at: new Date().toISOString(),
        }
      : {
          ...(row.name ? { name: row.name } : {}),
          ...(row.brand ? { brand: row.brand } : {}),
          ...(row.category ? { category: row.category } : {}),
        };

    const id = existing.get(row.barcode);
    if (id) {
      const { error } = await db.from('products').update({ ...catalogFields, ...storeFields }).eq('id', id);
      report.push(error ? { barcode: row.barcode, status: 'skipped', message: error.message } : { barcode: row.barcode, status: 'updated', name: (catalogFields.name as string) || undefined });
    } else {
      const { error } = await db.from('products').insert({
        barcode: row.barcode,
        source: info ? 'openfoodfacts' : 'csv',
        ...catalogFields,
        name,
        ...storeFields,
      });
      report.push(error ? { barcode: row.barcode, status: 'skipped', message: error.message } : { barcode: row.barcode, status: 'created', name: name || undefined });
    }
  }

  return res.status(200).json({
    created: report.filter((r) => r.status === 'created').length,
    updated: report.filter((r) => r.status === 'updated').length,
    skipped: report.filter((r) => r.status === 'skipped').length,
    report,
  });
}
