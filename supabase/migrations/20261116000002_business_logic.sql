-- Business operations run as SECURITY DEFINER functions so that prices,
-- stock and eligibility rules are enforced in the database, not trusted from
-- the browser or from the AI model.

-- Place an order from a list of {product_id, quantity}. Prices come from the
-- products table; stock is decremented atomically.
create or replace function public.place_order(
  p_items jsonb,
  p_delivery_address text,
  p_payment_method text default 'COD',
  p_notes text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_settings public.store_settings;
  v_order public.orders;
  v_item jsonb;
  v_product public.products;
  v_qty integer;
  v_subtotal numeric(10,2) := 0;
  v_fee numeric(10,2);
begin
  if v_uid is null then
    raise exception 'You must be signed in to place an order';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty';
  end if;
  if coalesce(trim(p_delivery_address), '') = '' then
    raise exception 'A delivery address is required';
  end if;

  select * into v_settings from public.store_settings where id = 1;

  -- Validate and price every line, locking product rows.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'quantity')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 50 then
      raise exception 'Invalid quantity';
    end if;
    select * into v_product from public.products
      where id = (v_item ->> 'product_id')::uuid
      for update;
    if not found or not v_product.is_active or v_product.price is null then
      raise exception 'A product in your cart is no longer available';
    end if;
    if v_product.stock_quantity < v_qty then
      raise exception 'Only % left in stock for %', v_product.stock_quantity, v_product.name;
    end if;
    v_subtotal := v_subtotal + v_product.price * v_qty;
  end loop;

  v_fee := case when v_subtotal >= v_settings.free_delivery_threshold then 0 else v_settings.delivery_fee end;

  insert into public.orders (customer_id, subtotal, delivery_fee, total_amount, delivery_address, payment_method, notes)
  values (v_uid, v_subtotal, v_fee, v_subtotal + v_fee, trim(p_delivery_address), coalesce(p_payment_method, 'COD'), p_notes)
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'quantity')::integer;
    update public.products
      set stock_quantity = stock_quantity - v_qty
      where id = (v_item ->> 'product_id')::uuid
      returning * into v_product;
    insert into public.order_items (order_id, product_id, name, unit_price, quantity)
    values (v_order.id, v_product.id, v_product.name, v_product.price, v_qty);
  end loop;

  return v_order;
end;
$$;

-- Cancel one of the caller's orders while it is still cancellable.
create or replace function public.cancel_order(p_order_number text, p_reason text default null)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_order public.orders;
  v_settings public.store_settings;
begin
  select * into v_settings from public.store_settings where id = 1;
  select * into v_order from public.orders
    where order_number = upper(trim(p_order_number))
      and (customer_id = v_uid or public.is_staff())
    for update;
  if not found then
    raise exception 'Order % was not found on your account', p_order_number;
  end if;
  if not (v_order.status = any (v_settings.cancellable_statuses)) then
    raise exception 'Order % is % and can no longer be cancelled', v_order.order_number, v_order.status;
  end if;

  update public.orders
    set status = 'CANCELLED',
        notes = concat_ws(E'\n', notes, 'Cancelled: ' || coalesce(p_reason, 'customer request'))
    where id = v_order.id
    returning * into v_order;

  -- Return stock to inventory.
  update public.products p
    set stock_quantity = p.stock_quantity + oi.quantity
    from public.order_items oi
    where oi.order_id = v_order.id and oi.product_id = p.id;

  return v_order;
end;
$$;

-- Request a refund for a delivered order. Requests are always PENDING until a
-- staff member reviews them.
create or replace function public.request_refund(p_order_number text, p_reason text, p_amount numeric default null)
returns public.refunds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_order public.orders;
  v_settings public.store_settings;
  v_already numeric(10,2);
  v_amount numeric(10,2);
  v_refund public.refunds;
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Please describe the problem with the order';
  end if;

  select * into v_settings from public.store_settings where id = 1;
  select * into v_order from public.orders
    where order_number = upper(trim(p_order_number)) and customer_id = v_uid;
  if not found then
    raise exception 'Order % was not found on your account', p_order_number;
  end if;
  if v_order.status <> 'DELIVERED' then
    raise exception 'Refunds can only be requested for delivered orders (order % is %)', v_order.order_number, v_order.status;
  end if;
  if coalesce(v_order.delivered_at, v_order.updated_at) < now() - make_interval(hours => v_settings.refund_window_hours) then
    raise exception 'The % hour refund window for order % has passed', v_settings.refund_window_hours, v_order.order_number;
  end if;

  select coalesce(sum(amount), 0) into v_already from public.refunds
    where order_id = v_order.id and status in ('PENDING', 'APPROVED');
  v_amount := coalesce(p_amount, v_order.total_amount - v_already);
  if v_amount <= 0 or v_amount > v_order.total_amount - v_already then
    raise exception 'Refund amount must be between 1 and %', v_order.total_amount - v_already;
  end if;

  insert into public.refunds (order_id, customer_id, reason, amount)
  values (v_order.id, v_uid, trim(p_reason), v_amount)
  returning * into v_refund;
  return v_refund;
end;
$$;

-- Staff: move an order through fulfilment.
create or replace function public.set_order_status(p_order_id uuid, p_status text)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if not public.is_staff() then
    raise exception 'Staff only';
  end if;
  if p_status = 'CANCELLED' then
    select * into v_order from public.orders where id = p_order_id;
    return public.cancel_order(v_order.order_number, 'cancelled by store');
  end if;
  update public.orders
    set status = p_status,
        delivered_at = case when p_status = 'DELIVERED' then now() else delivered_at end,
        payment_status = case when p_status = 'DELIVERED' and payment_status = 'PENDING' then 'PAID' else payment_status end
    where id = p_order_id
    returning * into v_order;
  if not found then
    raise exception 'Order not found';
  end if;
  return v_order;
end;
$$;

-- Staff: approve or reject a refund.
create or replace function public.review_refund(p_refund_id uuid, p_approve boolean, p_note text default null)
returns public.refunds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refund public.refunds;
  v_total numeric(10,2);
  v_refunded numeric(10,2);
begin
  if not public.is_staff() then
    raise exception 'Staff only';
  end if;
  update public.refunds
    set status = case when p_approve then 'APPROVED' else 'REJECTED' end,
        staff_note = p_note,
        reviewed_by = (select auth.uid()),
        reviewed_at = now()
    where id = p_refund_id and status = 'PENDING'
    returning * into v_refund;
  if not found then
    raise exception 'Refund not found or already reviewed';
  end if;
  if p_approve then
    select total_amount into v_total from public.orders where id = v_refund.order_id;
    select coalesce(sum(amount), 0) into v_refunded from public.refunds
      where order_id = v_refund.order_id and status = 'APPROVED';
    update public.orders
      set payment_status = case when v_refunded >= v_total then 'REFUNDED' else 'PARTIALLY_REFUNDED' end
      where id = v_refund.order_id;
  end if;
  return v_refund;
end;
$$;

-- ---------------------------------------------------------------------------
-- Notification triggers
-- ---------------------------------------------------------------------------
create or replace function public.notify_order_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, type, title, message, link)
    values (new.customer_id, 'ORDER_PLACED', 'Order ' || new.order_number || ' placed',
            'We received your order of Rs ' || new.total_amount || '.', '/orders/' || new.order_number);
  elsif new.status is distinct from old.status then
    insert into public.notifications (user_id, type, title, message, link)
    values (new.customer_id, 'ORDER_STATUS', 'Order ' || new.order_number || ' is now ' || replace(new.status, '_', ' '),
            'Your order status changed from ' || replace(old.status, '_', ' ') || ' to ' || replace(new.status, '_', ' ') || '.',
            '/orders/' || new.order_number);
  end if;
  return new;
end;
$$;
create trigger notify_order_change after insert or update on public.orders
  for each row execute function public.notify_order_change();

create or replace function public.notify_refund_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, type, title, message, link)
    values (new.customer_id, 'REFUND_REQUESTED', 'Refund ' || new.refund_number || ' submitted',
            'Your refund request for Rs ' || new.amount || ' is pending review.', '/orders');
  elsif new.status is distinct from old.status then
    insert into public.notifications (user_id, type, title, message, link)
    values (new.customer_id, 'REFUND_' || new.status, 'Refund ' || new.refund_number || ' ' || lower(new.status),
            coalesce(new.staff_note, 'Your refund request was ' || lower(new.status) || '.'), '/orders');
  end if;
  return new;
end;
$$;
create trigger notify_refund_change after insert or update on public.refunds
  for each row execute function public.notify_refund_change();

create or replace function public.notify_ticket_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, type, title, message, link)
    values (new.customer_id, 'TICKET_CREATED', 'Ticket ' || new.ticket_number || ' opened',
            'A support agent will get back to you: ' || new.subject, '/tickets');
  elsif new.status is distinct from old.status then
    insert into public.notifications (user_id, type, title, message, link)
    values (new.customer_id, 'TICKET_STATUS', 'Ticket ' || new.ticket_number || ' ' || lower(replace(new.status, '_', ' ')),
            coalesce(new.resolution, 'Your ticket status was updated.'), '/tickets');
  end if;
  return new;
end;
$$;
create trigger notify_ticket_change after insert or update on public.tickets
  for each row execute function public.notify_ticket_change();

-- Analytics for the admin dashboard.
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Staff only';
  end if;
  return jsonb_build_object(
    'orders_today', (select count(*) from public.orders where created_at >= date_trunc('day', now())),
    'revenue_today', (select coalesce(sum(total_amount), 0) from public.orders where created_at >= date_trunc('day', now()) and status <> 'CANCELLED'),
    'open_orders', (select count(*) from public.orders where status not in ('DELIVERED', 'CANCELLED')),
    'pending_refunds', (select count(*) from public.refunds where status = 'PENDING'),
    'open_tickets', (select count(*) from public.tickets where status in ('OPEN', 'IN_PROGRESS')),
    'customers', (select count(*) from public.profiles where role = 'customer'),
    'products_live', (select count(*) from public.products where is_active and price is not null and stock_quantity > 0),
    'products_unpriced', (select count(*) from public.products where is_active and price is null),
    'low_stock', (select count(*) from public.products where is_active and price is not null and stock_quantity between 1 and 5),
    'conversations_today', (select count(*) from public.conversations where created_at >= date_trunc('day', now()))
  );
end;
$$;
