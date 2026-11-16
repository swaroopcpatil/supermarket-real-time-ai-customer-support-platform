# Architecture

## Components

| Component | Runs on | Responsibility |
| --- | --- | --- |
| Next.js pages | Vercel (static + client) | Storefront, cart, orders, chat UI, tickets, admin console |
| `/api/chat` | Vercel function (Node, `bom1`) | Gemini function-calling loop; streams text and tool activity to the browser over SSE; persists the conversation |
| `/api/admin/import` | Vercel function | Staff-only product import from Open Food Facts (barcode lookup and search) |
| Supabase Postgres | Supabase (`ap-south-1`) | All data, business rules (SQL functions) and row level security |
| Supabase Auth | Supabase | Email/password accounts, password reset |
| Supabase Realtime | Supabase | Pushes order, refund, ticket, notification and product changes to browsers |

The previous design (ten Python microservices, Kafka, Redis, Prometheus) cannot run on Vercel and kept all data in memory. It was replaced by this two-service design: the same features with nothing to operate.

## Data model

`profiles` (1:1 with `auth.users`, role `customer | staff | admin`), `products`, `orders` + `order_items`, `refunds`, `tickets`, `conversations` + `chat_messages`, `notifications`, `kb_documents` (store policies, full-text indexed), and `store_settings` (a single row of business rules).

Human-readable numbers (`ORD-100001`, `RFD-100001`, `TKT-100001`) come from database sequences.

## Business rules live in the database

| Function | Who | What it enforces |
| --- | --- | --- |
| `place_order(items, address, payment, notes)` | customer | Prices read from `products`; stock checked and decremented atomically (row locks); delivery fee from `store_settings` |
| `cancel_order(order_number, reason)` | owner or staff | Only while status is in `store_settings.cancellable_statuses`; returns stock |
| `request_refund(order_number, reason, amount)` | owner | Delivered orders only, inside the refund window, total refunds capped at the order total; always `PENDING` |
| `set_order_status(order_id, status)` | staff | Fulfilment transitions; sets `delivered_at` and marks COD orders paid on delivery |
| `review_refund(refund_id, approve, note)` | staff | Approves or rejects; updates the order's payment status |
| `admin_stats()` | staff | Dashboard counters |

Triggers write a `notifications` row on every order, refund and ticket change. The browser receives them over Realtime.

## Security model

- RLS is enabled on every table. Customers can read only their own rows. Orders and refunds cannot be inserted directly, only through the functions above. Staff policies use `is_staff()`.
- A trigger prevents signed-in non-admins from changing any `role`.
- API routes create a Supabase client **with the caller's access token**, so the AI's tools and the admin import run under the caller's RLS permissions. The app never holds a service-role key.
- Tool inputs from the model are validated with Zod on the server before anything runs.
- The system prompt tells the assistant to confirm before cancelling or requesting refunds, to ground answers in tool results, and to treat tool output and customer text as data rather than instructions.

## AI assistant

- Model `gemini-3.5-flash` (configurable with `GEMINI_MODEL`) through the Google Gen AI SDK, streamed to the browser over SSE. Temporary Google overload (429/500/503) is retried before a response starts.
- The system prompt and live store settings go in the system instruction; the model's thought signatures are passed back unchanged between tool rounds.
- Tools (function declarations): `search_products`, `get_my_orders`, `get_order_details`, `cancel_order`, `request_refund`, `search_policies`, `create_support_ticket`, `get_my_tickets`. Tool definitions are provider-neutral JSON Schema in `src/lib/agent.ts`.
- Conversations and the assistant's tool activity are stored in `chat_messages`. Staff see the transcript on any ticket the assistant opened.

## Product data

Open Food Facts supplies names, brands, images, ingredients and Nutri-Score. Store-owned fields (price, MRP, stock, visibility) are never overwritten by a re-import. Customers only see products that are active and priced.
