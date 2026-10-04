-- Realtime para cuentas conjuntas: altas, ediciones y saldos de cuentas, invitaciones/miembros y
-- movimientos llegan en vivo al resto de miembros. Cada suscriptor solo recibe lo que su RLS le deja leer.
do $$
declare
  t text;
begin
  foreach t in array array['accounts', 'account_members', 'transactions'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
