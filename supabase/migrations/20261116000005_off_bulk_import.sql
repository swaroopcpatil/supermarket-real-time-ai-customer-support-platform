-- Bulk catalogue import from Open Food Facts (India), run inside Postgres.
-- Lives in a private schema that is not exposed through the Data API; call it
-- from the SQL editor:  select catalog_import.import_india_page(1);
-- Imports catalogue fields only. MRP, price and stock stay with the store.

create extension if not exists http with schema extensions;
create schema if not exists catalog_import;
revoke all on schema catalog_import from public, anon, authenticated;

-- Same aisle rules as apps/web/src/lib/openfoodfacts.ts (most specific tag first).
create or replace function catalog_import.aisle_for(tags text[])
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  t text;
  i int;
begin
  if tags is null then return 'Groceries'; end if;
  for i in reverse coalesce(array_length(tags, 1), 0) .. 1 loop
    t := lower(tags[i]);
    continue when t ~ '(plant-based-foods|foods-and-beverages|^en:foods?$|^en:groceries$)';
    if t ~ '(noodles|pastas|instant)' then return 'Instant Food'; end if;
    if t ~ '(sauces|condiments|ketchups|pickles|spreads|jams)' then return 'Sauces & Spreads'; end if;
    if t ~ '(dairies|milks|cheeses|butters|yogurts|creams|paneer|ghee)' then return 'Dairy'; end if;
    if t ~ '(beverages|drinks|juices|sodas|waters|teas|coffees)' then return 'Beverages'; end if;
    if t ~ '(snacks|chips|crisps|biscuits|cookies|namkeen|chocolates|candies|confectioner|sweets)' then return 'Snacks'; end if;
    if t ~ '(breakfast|cereals|oats|muesli)' then return 'Breakfast'; end if;
    if t ~ '(flours|atta|rices|cereal-grains|pulses|lentils|dals|legumes)' then return 'Staples'; end if;
    if t ~ '(oils|fats)' then return 'Oils & Ghee'; end if;
    if t ~ '(spices|salts|sugars|masalas|seasonings)' then return 'Spices & Condiments'; end if;
    if t ~ 'frozen' then return 'Frozen'; end if;
    if t ~ '(breads|bakery)' then return 'Bakery'; end if;
    if t ~ '(fruits|vegetables)' then return 'Fruits & Vegetables'; end if;
  end loop;
  return 'Groceries';
end;
$$;

create or replace function catalog_import.clean(v text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(trim(regexp_replace(
    replace(replace(replace(replace(coalesce(v, ''), '&quot;', '"'), '&amp;', '&'), '&#39;', ''''), '&apos;', ''''),
    '\s+', ' ', 'g')), '');
$$;

-- Import one page (100 products) of Indian products, most scanned first.
-- Existing rows keep their store-owned fields (price, MRP, stock, visibility).
create or replace function catalog_import.import_india_page(p_page int, p_page_size int default 100)
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_resp extensions.http_response;
  v_body jsonb;
  v_count int;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '30');
  select * into v_resp from extensions.http((
    'GET',
    'https://world.openfoodfacts.org/cgi/search.pl?action=process&json=1&sort_by=unique_scans_n'
      || '&tagtype_0=countries&tag_contains_0=contains&tag_0=india'
      || '&page_size=' || p_page_size || '&page=' || p_page
      || '&fields=code,product_name,product_name_en,generic_name,brands,quantity,categories_tags,image_front_url,image_url,ingredients_text_en,ingredients_text,nutriscore_grade',
    array[extensions.http_header('User-Agent', 'SupermarketSupportPlatform/1.0 (catalogue import)')],
    null, null
  )::extensions.http_request);

  if v_resp.status <> 200 or v_resp.content_type not like '%json%' then
    raise exception 'Open Food Facts returned HTTP % (%)', v_resp.status, v_resp.content_type;
  end if;
  v_body := v_resp.content::jsonb;

  with raw as (
    select
      regexp_replace(coalesce(p ->> 'code', ''), '\D', '', 'g') as barcode,
      coalesce(catalog_import.clean(p ->> 'product_name_en'), catalog_import.clean(p ->> 'product_name'), catalog_import.clean(p ->> 'generic_name')) as name,
      catalog_import.clean(split_part(coalesce(p ->> 'brands', ''), ',', 1)) as brand,
      catalog_import.aisle_for(array(select jsonb_array_elements_text(coalesce(p -> 'categories_tags', '[]'::jsonb)))) as category,
      catalog_import.clean(p ->> 'quantity') as quantity_label,
      catalog_import.clean(p ->> 'generic_name') as description,
      coalesce(catalog_import.clean(p ->> 'ingredients_text_en'), catalog_import.clean(p ->> 'ingredients_text')) as ingredients,
      case when p ->> 'nutriscore_grade' ~ '^[a-e]$' then p ->> 'nutriscore_grade' end as nutriscore_grade,
      coalesce(catalog_import.clean(p ->> 'image_front_url'), catalog_import.clean(p ->> 'image_url')) as image_url
    from jsonb_array_elements(coalesce(v_body -> 'products', '[]'::jsonb)) p
  ), valid as (
    select distinct on (barcode) *
    from raw
    where length(barcode) between 8 and 14 and name is not null and length(name) >= 2
  ), upserted as (
    insert into public.products (barcode, name, brand, category, quantity_label, description, ingredients, nutriscore_grade, image_url, source, source_synced_at)
    select barcode,
           case when name = lower(name) then initcap(left(name, 160)) else left(name, 160) end,
           left(brand, 80), category, left(quantity_label, 60), left(description, 500), left(ingredients, 4000), nutriscore_grade, image_url,
           'openfoodfacts', now()
    from valid
    on conflict (barcode) do update set
      brand = coalesce(public.products.brand, excluded.brand),
      quantity_label = coalesce(public.products.quantity_label, excluded.quantity_label),
      ingredients = coalesce(public.products.ingredients, excluded.ingredients),
      nutriscore_grade = coalesce(public.products.nutriscore_grade, excluded.nutriscore_grade),
      image_url = coalesce(public.products.image_url, excluded.image_url),
      source_synced_at = now()
    returning 1
  )
  select count(*) into v_count from upserted;
  return v_count;
end;
$$;

revoke all on all functions in schema catalog_import from public, anon, authenticated;

-- Retry/throttle wrapper: imports pages p_from..p_to, waiting between pages.
create or replace function catalog_import.import_india_pages(p_from int, p_to int, p_page_size int default 100)
returns text
language plpgsql
set search_path = ''
as $$
declare
  p int;
  attempt int;
  n int;
  report text := '';
begin
  for p in p_from .. p_to loop
    n := null;
    for attempt in 1 .. 3 loop
      begin
        n := catalog_import.import_india_page(p, p_page_size);
        exit;
      exception when others then
        perform pg_sleep(10 * attempt);
      end;
    end loop;
    report := report || p || ':' || coalesce(n::text, 'failed') || ' ';
    perform pg_sleep(7);  -- stay under Open Food Facts' search rate limit
  end loop;
  return report;
end;
$$;
revoke all on function catalog_import.import_india_pages(int, int, int) from public, anon, authenticated;

-- Background runner: a pg_cron job imports one page every 2 minutes and
-- unschedules itself when catalog_import.progress.last_page is reached.
-- Start an import of pages 1-60 (about 6,000 products):
--   insert into catalog_import.progress (id, next_page, last_page) values (1, 1, 60)
--     on conflict (id) do update set next_page = 1, last_page = 60, log = '';
--   select cron.schedule('off-india-import', '*/2 * * * *', 'select catalog_import.run_next_batch()');
create extension if not exists pg_cron;

create table if not exists catalog_import.progress (
  id int primary key default 1 check (id = 1),
  next_page int not null,
  last_page int not null,
  failures int not null default 0,
  log text not null default '',
  updated_at timestamptz not null default now()
);
revoke all on catalog_import.progress from public, anon, authenticated;

-- One page per run keeps each run short and well under Open Food Facts' rate limit.
create or replace function catalog_import.run_next_batch()
returns void
language plpgsql
set search_path = ''
as $$
declare
  st catalog_import.progress;
  n int;
begin
  set local statement_timeout = '50s';
  select * into st from catalog_import.progress where id = 1 for update skip locked;
  if not found then return; end if;
  if st.next_page > st.last_page then
    perform cron.unschedule('off-india-import');
    return;
  end if;
  begin
    n := catalog_import.import_india_page(st.next_page, 100);
    update catalog_import.progress
       set next_page = next_page + 1, failures = 0, log = log || st.next_page || ':' || n || ' ', updated_at = now()
     where id = 1;
  exception when others then
    -- Open Food Facts outages and rate limits are temporary: keep the same
    -- page and try again on the next run. Only after 30 consecutive failures
    -- (an hour at the 2-minute schedule) skip the page and reset the counter.
    update catalog_import.progress
       set failures = case when failures + 1 >= 30 then 0 else failures + 1 end,
           next_page = case when failures + 1 >= 30 then next_page + 1 else next_page end,
           log = log || case when failures + 1 >= 30 then st.next_page || ':skipped ' else '' end,
           updated_at = now()
     where id = 1;
  end;
end;
$$;
revoke all on function catalog_import.run_next_batch() from public, anon, authenticated;
