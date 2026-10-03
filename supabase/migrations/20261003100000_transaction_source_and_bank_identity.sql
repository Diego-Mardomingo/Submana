-- Origen de cada transacción e identidad bancaria (deduplicación antes de insertar).
-- Un booked_at no nulo indica que la fila está respaldada por una línea del extracto; la fecha,
-- descripción y categoría del usuario son independientes de ella y editar nunca los borra.
-- Los CREATE TABLE base no están en el repo: todo es idempotente (add column if not exists, etc.).

-- 1. Columnas ---------------------------------------------------------------
alter table public.transactions
  add column if not exists source text not null default 'manual',
  add column if not exists booked_at timestamptz,
  add column if not exists bank_description text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.transactions'::regclass and conname = 'transactions_source_check'
  ) then
    alter table public.transactions
      add constraint transactions_source_check check (source in ('manual', 'import', 'automation', 'shared'));
  end if;
end $$;

-- 2. Backfill ---------------------------------------------------------------
-- Filas importadas: tienen huella de extracto (las editadas conservan al menos statement_balance).
update public.transactions
set source = 'import',
    booked_at = coalesce(booked_at, date),
    bank_description = coalesce(bank_description, description)
where booked_at is null
  and (import_line_id is not null or statement_balance is not null or external_hash is not null);

-- Filas creadas por la automatización (atajos de iOS).
update public.transactions t
set source = 'automation'
where t.source = 'manual'
  and t.booked_at is null
  and exists (
    select 1 from public.automation_notifications n
    where n.transaction_id = t.id and n.success
  );

-- 3. Índices ----------------------------------------------------------------
create index if not exists idx_transactions_account_booked_at
  on public.transactions (account_id, booked_at) where booked_at is not null;
create index if not exists idx_transactions_account_date_unreconciled
  on public.transactions (account_id, date) where booked_at is null;

-- 4. RPCs -------------------------------------------------------------------
-- Sobrecarga antigua fuera: con p_source nuevo, PostgREST vería dos candidatas.
drop function if exists public.create_transaction_with_balance(uuid, uuid, numeric, text, timestamptz, text, uuid, uuid);

create or replace function public.create_transaction_with_balance(
  p_user_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_type text,
  p_date timestamptz,
  p_description text default null,
  p_category_id uuid default null,
  p_subcategory_id uuid default null,
  p_source text default 'manual'
) returns public.transactions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tx public.transactions;
begin
  insert into public.transactions (user_id, account_id, amount, type, date, description, category_id, subcategory_id, source)
  values (p_user_id, p_account_id, p_amount, p_type, p_date, p_description, p_category_id, p_subcategory_id, p_source)
  returning * into v_tx;

  update public.accounts
  set balance = balance + case when p_type = 'income' then p_amount else -p_amount end
  where id = p_account_id and user_id = p_user_id;

  return v_tx;
end;
$$;

-- Adjunta una línea del extracto a una transacción manual sin conciliar. NO toca el saldo (la manual
-- ya lo movió) ni la fecha, descripción o categoría del usuario. Devuelve null si la fila no existe,
-- no es del usuario o ya está conciliada (booked_at no nulo).
create or replace function public.merge_bank_line_into_transaction(
  p_user_id uuid,
  p_tx_id uuid,
  p_import_line_id text,
  p_external_hash text,
  p_statement_balance numeric,
  p_booked_at timestamptz,
  p_bank_description text
) returns public.transactions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tx public.transactions;
begin
  update public.transactions
  set import_line_id = p_import_line_id,
      external_hash = p_external_hash,
      statement_balance = p_statement_balance,
      booked_at = p_booked_at,
      bank_description = p_bank_description
  where id = p_tx_id
    and user_id = p_user_id
    and booked_at is null
  returning * into v_tx;

  return v_tx;
end;
$$;

revoke execute on function public.create_transaction_with_balance(uuid, uuid, numeric, text, timestamptz, text, uuid, uuid, text) from public, anon;
revoke execute on function public.merge_bank_line_into_transaction(uuid, uuid, text, text, numeric, timestamptz, text) from public, anon;
grant execute on function public.create_transaction_with_balance(uuid, uuid, numeric, text, timestamptz, text, uuid, uuid, text) to authenticated, service_role;
grant execute on function public.merge_bank_line_into_transaction(uuid, uuid, text, text, numeric, timestamptz, text) to authenticated, service_role;

-- 5. import_duplicate_decisions ---------------------------------------------
-- Nuevas resoluciones: skip_bank_line (clave = import_line_id) y keep_both. Las claves por día
-- antiguas (keep_existing / keep_import) se siguen leyendo.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.import_duplicate_decisions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%resolution%'
  loop
    execute format('alter table public.import_duplicate_decisions drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.import_duplicate_decisions
  add constraint import_duplicate_decisions_resolution_check
  check (resolution in ('keep_existing', 'keep_import', 'skip_bank_line', 'keep_both'));

-- 6. Verificación manual (ejecutar a mano en el SQL editor; sustituye los ids) -------------------
-- -- Backfill: ninguna fila con huella de extracto debería quedar sin booked_at
-- select count(*) from public.transactions
--  where (import_line_id is not null or statement_balance is not null) and booked_at is null;   -- 0
-- select source, count(*) from public.transactions group by 1;
--
-- -- Fusión: no toca saldo ni campos del usuario, y es idempotente (segunda llamada => null)
-- begin;
-- select balance from public.accounts where id = '<account>';
-- select * from public.merge_bank_line_into_transaction(
--   '<user>', '<manual_tx>', 'test-line', 'test-hash', null, now(), 'BANK TEXT');
-- select balance from public.accounts where id = '<account>';   -- igual que antes
-- select * from public.merge_bank_line_into_transaction(
--   '<user>', '<manual_tx>', 'test-line-2', 'h2', null, now(), 'x');   -- null: ya conciliada
-- rollback;
--
-- -- Otro usuario no puede fusionar sobre filas ajenas (RLS + filtro por user_id)
-- -- set local role authenticated; set local request.jwt.claims = '{"sub":"<other_user>"}';
-- -- select * from public.merge_bank_line_into_transaction('<other_user>', '<manual_tx>', 'x', 'x', null, now(), 'x');  -- null
--
-- -- Decisiones
-- insert into public.import_duplicate_decisions (user_id, account_id, conflict_key, resolution)
--   values ('<user>', '<account>', 'k-test', 'skip_bank_line');   -- ok
-- delete from public.import_duplicate_decisions where conflict_key = 'k-test';
