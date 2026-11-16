-- Role helpers are only meaningful for signed-in users.
revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- Allow role changes from trusted backend contexts (SQL editor, migrations,
-- service role) so the first admin can be promoted; signed-in users still
-- need to be admins. Anonymous API callers never reach this trigger because
-- RLS blocks their profile updates.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and (select auth.uid()) is not null
     and not public.is_admin() then
    raise exception 'Only admins can change roles';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.protect_profile_role() from public, anon, authenticated;
