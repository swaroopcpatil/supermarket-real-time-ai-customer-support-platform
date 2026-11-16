/**
 * Open Food Facts client (https://world.openfoodfacts.org) — a free, open
 * database of real packaged food products, with strong coverage of Indian
 * brands. It provides names, brands, images, ingredients and nutrition.
 * It does NOT provide prices or stock; those come from the store.
 */

const USER_AGENT = 'SupermarketSupportPlatform/1.0 (+https://github.com/openfoodfacts)';
const PRODUCT_FIELDS = [
  'code', 'product_name', 'product_name_en', 'generic_name', 'brands', 'quantity',
  'categories_tags', 'image_front_url', 'image_url', 'ingredients_text', 'ingredients_text_en',
  'nutriscore_grade',
].join(',');

export interface OffProduct {
  barcode: string;
  name: string;
  brand: string | null;
  category: string;
  quantity_label: string | null;
  description: string | null;
  ingredients: string | null;
  nutriscore_grade: string | null;
  image_url: string | null;
}

// Map Open Food Facts category tags onto simple supermarket aisles.
const AISLES: [RegExp, string][] = [
  [/noodles|pastas|instant/, 'Instant Food'],
  [/sauces|condiments|ketchups|pickles|spreads|jams/, 'Sauces & Spreads'],
  [/dairies|milks|cheeses|butters|yogurts|creams|paneer|ghee/, 'Dairy'],
  [/beverages|drinks|juices|sodas|waters|teas|coffees/, 'Beverages'],
  [/snacks|chips|crisps|biscuits|cookies|namkeen|chocolates|candies|confectioner|sweets/, 'Snacks'],
  [/breakfast|cereals|oats|muesli/, 'Breakfast'],
  [/flours|atta|rices|cereal-grains|pulses|lentils|dals|legumes/, 'Staples'],
  [/oils|fats/, 'Oils & Ghee'],
  [/spices|salts|sugars|masalas|seasonings/, 'Spices & Condiments'],
  [/frozen/, 'Frozen'],
  [/breads|bakery/, 'Bakery'],
  [/fruits|vegetables/, 'Fruits & Vegetables'],
];

// Open Food Facts orders category tags from generic to specific, and almost
// everything is tagged with umbrella categories like
// "plant-based-foods-and-beverages". Match the most specific tag first and
// skip the umbrella ones.
const UMBRELLA_TAGS = /plant-based-foods|foods-and-beverages|^en:foods?$|^en:groceries$/;

function aisleFor(tags: string[] | undefined): string {
  const specificFirst = [...(tags || [])].reverse().map((t) => t.toLowerCase()).filter((t) => !UMBRELLA_TAGS.test(t));
  for (const tag of specificFirst) {
    for (const [re, aisle] of AISLES) if (re.test(tag)) return aisle;
  }
  return 'Groceries';
}

function tidyName(name: string): string {
  const trimmed = name.length > 160 ? name.slice(0, 160) : name;
  // Some entries are typed in all lower case ("maggi"); capitalise those.
  return trimmed === trimmed.toLowerCase() ? trimmed.replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : trimmed;
}

const ENTITIES: Record<string, string> = { '&quot;': '"', '&amp;': '&', '&#39;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value
    .replace(/&(quot|amp|#39|apos|lt|gt|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return v ? v : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeOffProduct(raw: any): OffProduct | null {
  if (!raw) return null;
  const barcode = clean(raw.code);
  const name = clean(raw.product_name_en) || clean(raw.product_name) || clean(raw.generic_name);
  if (!barcode || !name) return null;
  const brand = clean(typeof raw.brands === 'string' ? raw.brands.split(',')[0] : Array.isArray(raw.brands) ? raw.brands[0] : null);
  const grade = clean(raw.nutriscore_grade);
  return {
    barcode,
    name: tidyName(name),
    brand,
    category: aisleFor(raw.categories_tags),
    quantity_label: clean(raw.quantity),
    description: clean(raw.generic_name),
    ingredients: clean(raw.ingredients_text_en) || clean(raw.ingredients_text),
    nutriscore_grade: grade && /^[a-e]$/.test(grade) ? grade : null,
    image_url: clean(raw.image_front_url) || clean(raw.image_url),
  };
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Open Food Facts returned HTTP ${res.status}`);
  const type = res.headers.get('content-type') || '';
  if (!type.includes('json')) throw new Error('Open Food Facts is temporarily unavailable');
  return res.json();
}

/** Look up one product by its barcode (EAN/UPC). */
export async function fetchByBarcode(barcode: string): Promise<OffProduct | null> {
  const code = barcode.replace(/\D/g, '');
  if (code.length < 8 || code.length > 14) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await getJson(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${PRODUCT_FIELDS}`);
  if (data?.status !== 1) return null;
  return normalizeOffProduct(data.product);
}

/** Look up many barcodes with limited concurrency. */
export async function fetchManyByBarcode(barcodes: string[], concurrency = 5): Promise<Map<string, OffProduct | null>> {
  const results = new Map<string, OffProduct | null>();
  const queue = [...new Set(barcodes.map((b) => b.replace(/\D/g, '')).filter(Boolean))];
  async function worker() {
    while (queue.length) {
      const code = queue.shift() as string;
      try {
        results.set(code, await fetchByBarcode(code));
      } catch {
        results.set(code, null);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
  return results;
}

/**
 * Search Indian products by text. Uses the official search service first and
 * falls back to the classic search API.
 */
export async function searchProducts(query: string, pageSize = 24): Promise<OffProduct[]> {
  const q = query.trim();
  if (!q) return [];
  const attempts = [
    `https://search.openfoodfacts.org/search?q=${encodeURIComponent(`${q} countries_tags:"en:india"`)}&page_size=${pageSize}&fields=${PRODUCT_FIELDS}`,
    `https://world.openfoodfacts.org/api/v2/search?search_terms=${encodeURIComponent(q)}&countries_tags_en=india&page_size=${pageSize}&fields=${PRODUCT_FIELDS}`,
  ];
  let lastError: unknown = null;
  for (const url of attempts) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await getJson(url);
      const hits = data?.hits || data?.products || [];
      return hits.map(normalizeOffProduct).filter(Boolean) as OffProduct[];
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Open Food Facts search failed');
}
