-- Row level security, grants and realtime publication.

alter table public.store_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.refunds enable row level security;
alter table public.conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.tickets enable row level security;
alter table public.notifications enable row level security;
alter table public.kb_documents enable row level security;

-- Store settings: readable by everyone, editable by admins.
create policy "settings readable" on public.store_settings for select using (true);
create policy "settings admin update" on public.store_settings for update
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Profiles
create policy "profiles self or staff read" on public.profiles for select
  using (id = (select auth.uid()) or (select public.is_staff()));
create policy "profiles self update" on public.profiles for update
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

-- Products: public catalog; staff manage.
create policy "products public read" on public.products for select
  using (is_active or (select public.is_staff()));
create policy "products staff insert" on public.products for insert
  with check ((select public.is_staff()));
create policy "products staff update" on public.products for update
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "products staff delete" on public.products for delete
  using ((select public.is_staff()));

-- Orders: created only through place_order(); customers read their own.
create policy "orders own or staff read" on public.orders for select
  using (customer_id = (select auth.uid()) or (select public.is_staff()));
create policy "order items own or staff read" on public.order_items for select
  using (exists (
    select 1 from public.orders o
    where o.id = order_id and (o.customer_id = (select auth.uid()) or (select public.is_staff()))
  ));

-- Refunds: created only through request_refund(), reviewed through review_refund().
create policy "refunds own or staff read" on public.refunds for select
  using (customer_id = (select auth.uid()) or (select public.is_staff()));

-- Conversations and messages
create policy "conversations own or staff read" on public.conversations for select
  using (customer_id = (select auth.uid()) or (select public.is_staff()));
create policy "conversations own insert" on public.conversations for insert
  with check (customer_id = (select auth.uid()));
create policy "conversations own update" on public.conversations for update
  using (customer_id = (select auth.uid())) with check (customer_id = (select auth.uid()));
create policy "conversations own delete" on public.conversations for delete
  using (customer_id = (select auth.uid()));

create policy "messages own or staff read" on public.chat_messages for select
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and (c.customer_id = (select auth.uid()) or (select public.is_staff()))
  ));
create policy "messages own insert" on public.chat_messages for insert
  with check (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.customer_id = (select auth.uid())
  ));

-- Tickets
create policy "tickets own or staff read" on public.tickets for select
  using (customer_id = (select auth.uid()) or (select public.is_staff()));
create policy "tickets own insert" on public.tickets for insert
  with check (customer_id = (select auth.uid()) and status = 'OPEN' and assigned_to is null and resolution is null);
create policy "tickets staff update" on public.tickets for update
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- Notifications
create policy "notifications own read" on public.notifications for select
  using (user_id = (select auth.uid()));
create policy "notifications own update" on public.notifications for update
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Knowledge base: public read; staff manage.
create policy "kb public read" on public.kb_documents for select using (true);
create policy "kb staff insert" on public.kb_documents for insert with check ((select public.is_staff()));
create policy "kb staff update" on public.kb_documents for update
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "kb staff delete" on public.kb_documents for delete using ((select public.is_staff()));

-- Function execution: business functions only for signed-in users; internal
-- trigger helpers for nobody.
revoke execute on function public.place_order(jsonb, text, text, text) from public, anon;
revoke execute on function public.cancel_order(text, text) from public, anon;
revoke execute on function public.request_refund(text, text, numeric) from public, anon;
revoke execute on function public.set_order_status(uuid, text) from public, anon;
revoke execute on function public.review_refund(uuid, boolean, text) from public, anon;
revoke execute on function public.admin_stats() from public, anon;
grant execute on function public.place_order(jsonb, text, text, text) to authenticated;
grant execute on function public.cancel_order(text, text) to authenticated;
grant execute on function public.request_refund(text, text, numeric) to authenticated;
grant execute on function public.set_order_status(uuid, text) to authenticated;
grant execute on function public.review_refund(uuid, boolean, text) to authenticated;
grant execute on function public.admin_stats() to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.protect_profile_role() from public, anon, authenticated;
revoke execute on function public.notify_order_change() from public, anon, authenticated;
revoke execute on function public.notify_refund_change() from public, anon, authenticated;
revoke execute on function public.notify_ticket_change() from public, anon, authenticated;

-- Realtime: the UI subscribes to these tables (RLS still applies).
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.refunds;
alter publication supabase_realtime add table public.tickets;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.products;
