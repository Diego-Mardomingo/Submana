-- Las políticas de insert/update de categories consultaban la propia tabla categories para validar el
-- padre, y Postgres lo rechaza siempre ("infinite recursion detected in policy", 42P17): crear o editar
-- cualquier categoría fallaba. La comprobación del padre pasa a una función security definer (sin RLS).

create or replace function public.is_accessible_category_parent(p_parent uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.categories p
    where p.id = p_parent
      and (p.user_id is null or p.user_id = (select auth.uid()))
  );
$$;

revoke execute on function public.is_accessible_category_parent(uuid) from public, anon;
grant execute on function public.is_accessible_category_parent(uuid) to authenticated, service_role;

drop policy if exists categories_insert_own on public.categories;
create policy categories_insert_own on public.categories for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (parent_id is null or public.is_accessible_category_parent(parent_id))
  );

drop policy if exists categories_update_own on public.categories;
create policy categories_update_own on public.categories for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (parent_id is null or public.is_accessible_category_parent(parent_id))
  );
