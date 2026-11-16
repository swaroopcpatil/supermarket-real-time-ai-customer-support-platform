-- Core schema for the supermarket support platform.
-- All tables live in `public` and are protected by row level security.
-- Customers only ever see their own rows; staff/admin see everything.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Store settings (single row, id = 1). Business rules the app and the AI
-- assistant read at runtime instead of hardcoding them.
-- ---------------------------------------------------------------------------
create table public.store_settings (
  id smallint primary key default 1 check (id = 1),
  store_name text not null default 'My Supermarket',
  support_email text,
  support_phone text,
  store_hours text not null default 'Daily 7:00 AM - 10:00 PM',
  support_hours text not null default 'Daily 8:00 AM - 9:00 PM',
  currency text not null default 'INR',
  free_delivery_threshold numeric(10,2) not null default 499,
  delivery_fee numeric(10,2) not null default 39,
  refund_window_hours integer not null default 48,
  cancellable_statuses text[] not null default array['PLACED','CONFIRMED','PACKING'],
  admin_emails text[] not null default '{}',
  updated_at timestamptz not null default now()
);
insert into public.store_settings (id) values (1);

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  phone text,
  default_address text,
  role text not null default 'customer' check (role in ('customer', 'staff', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('staff', 'admin')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- Create a profile for every new auth user. Emails listed in
-- store_settings.admin_emails become admins automatically.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := 'customer';
begin
  if exists (
    select 1 from public.store_settings s
    where lower(new.email) = any (select lower(e) from unnest(s.admin_emails) e)
  ) then
    v_role := 'admin';
  end if;

  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'phone',
    v_role
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Customers may edit their own profile but never their role.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only admins can change roles';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------------------------------------------------------------------------
-- Products. Catalog details (name, brand, image, nutrition) are imported from
-- Open Food Facts by barcode; price and stock are owned by the store.
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  barcode text unique,
  name text not null,
  brand text,
  category text not null default 'Groceries',
  quantity_label text,
  description text,
  ingredients text,
  nutriscore_grade text,
  image_url text,
  price numeric(10,2) check (price is null or price >= 0),
  mrp numeric(10,2) check (mrp is null or mrp >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  is_active boolean not null default true,
  source text not null default 'manual' check (source in ('openfoodfacts', 'csv', 'manual')),
  source_synced_at timestamptz,
  search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(brand, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(category, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_search_idx on public.products using gin (search);
create index products_name_trgm_idx on public.products using gin (name extensions.gin_trgm_ops);
create index products_category_idx on public.products (category);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create sequence public.order_number_seq start 100001;
create sequence public.refund_number_seq start 100001;
create sequence public.ticket_number_seq start 100001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('ORD-' || nextval('public.order_number_seq')),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'PLACED' check (status in (
    'PLACED', 'CONFIRMED', 'PACKING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'
  )),
  subtotal numeric(10,2) not null,
  delivery_fee numeric(10,2) not null default 0,
  total_amount numeric(10,2) not null,
  delivery_address text not null,
  payment_method text not null default 'COD' check (payment_method in ('COD', 'UPI_ON_DELIVERY', 'CARD_ON_DELIVERY')),
  payment_status text not null default 'PENDING' check (payment_status in ('PENDING', 'PAID', 'REFUNDED', 'PARTIALLY_REFUNDED')),
  notes text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_customer_idx on public.orders (customer_id, created_at desc);
create index orders_status_idx on public.orders (status);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name text not null,
  unit_price numeric(10,2) not null,
  quantity integer not null check (quantity > 0)
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

-- ---------------------------------------------------------------------------
-- Refunds
-- ---------------------------------------------------------------------------
create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  refund_number text not null unique default ('RFD-' || nextval('public.refund_number_seq')),
  order_id uuid not null references public.orders (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  amount numeric(10,2) not null check (amount > 0),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  staff_note text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index refunds_customer_idx on public.refunds (customer_id, created_at desc);
create index refunds_order_idx on public.refunds (order_id);
create index refunds_reviewed_by_idx on public.refunds (reviewed_by);

-- ---------------------------------------------------------------------------
-- Conversations (AI chat history)
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_customer_idx on public.conversations (customer_id, updated_at desc);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index chat_messages_conversation_idx on public.chat_messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Support tickets (human escalation)
-- ---------------------------------------------------------------------------
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique default ('TKT-' || nextval('public.ticket_number_seq')),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  order_id uuid references public.orders (id) on delete set null,
  category text not null default 'GENERAL' check (category in ('GENERAL', 'ORDER', 'REFUND', 'PRODUCT', 'DELIVERY', 'PAYMENT', 'COMPLAINT')),
  priority text not null default 'MEDIUM' check (priority in ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  subject text not null,
  description text not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  assigned_to uuid references public.profiles (id),
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tickets_customer_idx on public.tickets (customer_id, created_at desc);
create index tickets_status_idx on public.tickets (status);
create index tickets_conversation_idx on public.tickets (conversation_id);
create index tickets_order_idx on public.tickets (order_id);
create index tickets_assigned_idx on public.tickets (assigned_to);

-- ---------------------------------------------------------------------------
-- Notifications (written by triggers, read in realtime by the UI)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Knowledge base (store policies) with Postgres full-text search
-- ---------------------------------------------------------------------------
create table public.kb_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null default 'Policy',
  content text not null,
  search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B')
  ) stored,
  updated_at timestamptz not null default now()
);
create index kb_documents_search_idx on public.kb_documents using gin (search);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger touch_products before update on public.products for each row execute function public.touch_updated_at();
create trigger touch_orders before update on public.orders for each row execute function public.touch_updated_at();
create trigger touch_refunds before update on public.refunds for each row execute function public.touch_updated_at();
create trigger touch_tickets before update on public.tickets for each row execute function public.touch_updated_at();
create trigger touch_conversations before update on public.conversations for each row execute function public.touch_updated_at();
create trigger touch_kb before update on public.kb_documents for each row execute function public.touch_updated_at();
create trigger touch_settings before update on public.store_settings for each row execute function public.touch_updated_at();
