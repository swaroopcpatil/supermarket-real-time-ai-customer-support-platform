/**
 * Fetch products from Open Food Facts by barcode and print SQL that upserts
 * them into public.products. Price and stock are left empty: the store sets
 * them in Admin > Products (or by CSV) before customers can order.
 *
 *   npx tsx scripts/off-seed-sql.ts 8901058000290 8901491101837 ... > seed.sql
 */
import { fetchManyByBarcode } from '../src/lib/openfoodfacts';

function lit(v: string | null): string {
  return v === null ? 'null' : `'${v.replace(/'/g, "''")}'`;
}

async function main() {
  const barcodes = process.argv.slice(2);
  if (!barcodes.length) {
    console.error('usage: off-seed-sql.ts <barcode> [barcode...]');
    process.exit(1);
  }
  const found = await fetchManyByBarcode(barcodes, 4);
  const rows: string[] = [];
  for (const [code, p] of found) {
    if (!p) {
      console.error(`not found: ${code}`);
      continue;
    }
    rows.push(`(${[p.barcode, p.name, p.brand, p.category, p.quantity_label, p.description, p.ingredients, p.nutriscore_grade, p.image_url].map(lit).join(', ')}, 'openfoodfacts', now())`);
  }
  console.log(`insert into public.products (barcode, name, brand, category, quantity_label, description, ingredients, nutriscore_grade, image_url, source, source_synced_at) values
${rows.join(',\n')}
on conflict (barcode) do update set
  name = excluded.name, brand = excluded.brand, category = excluded.category,
  quantity_label = excluded.quantity_label, description = excluded.description,
  ingredients = excluded.ingredients, nutriscore_grade = excluded.nutriscore_grade,
  image_url = excluded.image_url, source_synced_at = now();`);
}

main();
