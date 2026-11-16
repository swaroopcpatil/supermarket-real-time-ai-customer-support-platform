-- Aisle list for the storefront filter without downloading the catalogue.
create or replace function public.product_categories(p_include_unpriced boolean default false)
returns table (category text, products bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.category, count(*)
  from public.products p
  where p.is_active and (p_include_unpriced or p.price is not null)
  group by p.category
  order by p.category;
$$;
grant execute on function public.product_categories(boolean) to anon, authenticated;

create index if not exists products_live_idx on public.products (name) where is_active and price is not null;
create index if not exists products_brand_trgm_idx on public.products using gin (brand extensions.gin_trgm_ops);
create index if not exists products_barcode_trgm_idx on public.products using gin (barcode extensions.gin_trgm_ops);

-- Selling above the printed MRP is illegal in India (Legal Metrology Act).
alter table public.products
  add constraint products_price_not_above_mrp
  check (price is null or mrp is null or price <= mrp);
