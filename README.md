# Supermarket Shop & AI Support

A production-ready online supermarket with a real-time AI customer support assistant, built for Indian retail.

- **Storefront**: browse the catalogue, cart, checkout with cash/UPI/card on delivery.
- **Live order tracking**: customers see status changes the moment staff update them, with in-app notifications.
- **AI support assistant** (Claude): answers from your real catalogue, your customers' real orders and your own policies. It can cancel orders, submit refund requests and open tickets for a human. It never approves refunds itself.
- **Store admin**: fulfil orders, review refunds, answer tickets (with the AI chat transcript attached), manage products/prices/stock, edit policies, manage staff.
- **Real product data**: products are imported from [Open Food Facts](https://world.openfoodfacts.org), a free, open database of real packaged foods with strong Indian coverage. Price and stock come from your store (admin screen or CSV export from your POS).

## Architecture

```text
Browser (Next.js pages)  ──supabase-js──►  Supabase
   │                                          ├─ Postgres (tables, RLS, business functions)
   │                                          ├─ Auth (email + password)
   │                                          └─ Realtime (orders, refunds, tickets, notifications, products)
   │
   └── /api/chat (Vercel function) ──► Claude API (tool use, streamed over SSE)
   │         └── tools run as the signed-in customer through Supabase RLS
   └── /api/admin/import (Vercel function) ──► Open Food Facts API
```

It deploys as **one Next.js app on Vercel plus one Supabase project**, with no servers, queues or containers to run. See [docs/architecture.md](docs/architecture.md) for the security model and data flow.

### Why it is safe to put in front of customers

- **Prices, stock, refund limits and cancellation rules are enforced in the database** (`place_order`, `cancel_order`, `request_refund`, `set_order_status`, `review_refund`), not trusted from the browser or the AI.
- **Row level security on every table.** Customers only ever see their own orders, refunds, tickets, chats and notifications. Staff see everything. Customers cannot change their own role.
- **The AI uses the customer's own session.** Its tools go through the same RLS rules, so it cannot read or change another customer's data even if prompted to.
- **No service-role key in the app.** The only secrets are the Anthropic key (server-side) and the Supabase publishable key (safe for browsers).

## Repository layout

| Path | What's there |
| --- | --- |
| `apps/web` | Next.js app (pages, API routes, components). This is the Vercel project root. |
| `apps/web/src/lib/agent.ts` | AI assistant tools and system prompt |
| `apps/web/src/pages/api/chat.ts` | Streaming chat endpoint (Claude tool-use loop over SSE) |
| `apps/web/src/lib/openfoodfacts.ts` | Open Food Facts client (barcode lookup and search) |
| `supabase/migrations` | Database schema, business functions, RLS, realtime |
| `supabase/seed` | Starter policies and an initial set of real products |

## Deploy to production

### 1. Supabase

Create a project (Mumbai `ap-south-1` is closest to Indian customers), then run the files in `supabase/migrations` **in order** in the SQL editor (or `supabase db push`), followed by `supabase/seed/kb_documents.sql` and optionally `supabase/seed/products_openfoodfacts.sql`.

In **Authentication → URL Configuration**, set the Site URL to your production domain and add `https://<your-domain>/**` to the redirect URLs, so confirmation and password-reset emails link back to your site. For real traffic, configure a custom SMTP provider under **Authentication → Emails**, because Supabase's built-in sender is rate-limited.

### 2. Vercel

Import the repository in Vercel and set **Root Directory = `apps/web`**. Add these environment variables:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable (anon) key |
| `ANTHROPIC_API_KEY` | From console.anthropic.com |
| `ANTHROPIC_MODEL` *(optional)* | Defaults to `claude-opus-5-5` |
| `ANTHROPIC_EFFORT` *(optional)* | `low`, `medium` (default) or `high` |

Functions run in Mumbai (`bom1`, set in `apps/web/vercel.json`), next to the database.

### 3. Create the first admin

Register on the deployed site, then run this in the Supabase SQL editor:

```sql
update public.profiles set role = 'admin' where email = 'you@yourstore.in';
```

After that, admins can promote staff from **Store Admin → Settings → Team**. You can also list emails in `store_settings.admin_emails` to make them admins automatically when they sign up.

### 4. Make the store yours (Store Admin)

1. **Settings**: store name, support phone/email, hours, delivery fee, free-delivery threshold, refund window.
2. **Policies**: edit the starter policies so they match your real rules. The assistant answers policy questions only from these.
3. **Products**: upload a CSV from your billing/POS system (`barcode,price,mrp,stock`), scan barcodes, or search Open Food Facts. Names, brands, images and ingredients are filled in automatically. Products appear in the shop once they have a price. The database rejects a selling price above MRP, because selling above the printed MRP is illegal in India.

### Bulk catalogue import (5,000+ Indian products)

`supabase/migrations/20261116000005_off_bulk_import.sql` adds a background importer that pulls the most-scanned Indian products from Open Food Facts, 100 per page. It runs inside Postgres via `pg_cron` and the `http` extension. To import pages 1–60 (about 6,000 products), run this in the SQL editor:

```sql
insert into catalog_import.progress (id, next_page, last_page) values (1, 1, 60)
  on conflict (id) do update set next_page = 1, last_page = 60, failures = 0, log = '';
select cron.schedule('off-india-import', '20 seconds', 'select catalog_import.run_next_batch()');
```

The job removes itself when finished. Check progress with `select next_page, log from catalog_import.progress;`. Re-running is safe: products are matched by barcode, and your MRP, price, stock and visibility are never overwritten.

MRP is not imported. Open Food Facts doesn't publish it, and retailer sites (DMart, Blinkit, etc.) may not be scraped. Enter MRP from the pack or your POS export.

## Local development

```bash
cd apps/web
cp .env.example .env.local   # fill in your Supabase and Anthropic values
npm install
npm run dev
```

```bash
npm run typecheck && npm test && npm run build
```

## Data sources and licences

Product names, images and ingredients come from Open Food Facts under the [Open Database License](https://opendatacommons.org/licenses/odbl/1-0/); the shop shows the required attribution. Open Food Facts does not publish prices or stock, so those always come from your store.
