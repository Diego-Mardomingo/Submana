-- Realtime para Amigos y Subcount: el cliente escucha estas tablas y refresca sus consultas en vivo.
-- Cada suscriptor solo recibe las filas que su RLS le deja leer (los DELETE llegan solo con la clave).
do $$
declare
  t text;
begin
  foreach t in array array['friendships', 'profiles', 'groups', 'group_members', 'shared_expenses'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
