-- Borrar un grupo de verdad (además de archivarlo). Cualquier miembro puede, haya o no deudas
-- pendientes (la app avisa antes). Se lleva por cascada miembros, gastos, repartos y actividad.
create or replace function public.delete_group(p_group_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.groups where id = p_group_id) or not public.is_group_member(p_group_id) then
    raise exception 'group_not_found';
  end if;
  delete from public.groups where id = p_group_id;
  return true;
end;
$$;

revoke all on function public.delete_group(uuid) from public, anon;
grant execute on function public.delete_group(uuid) to authenticated;
