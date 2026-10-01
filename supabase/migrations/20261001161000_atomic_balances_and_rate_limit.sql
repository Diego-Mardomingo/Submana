-- Operaciones de saldo atómicas y rate limiting.
-- Antes cada cambio de saldo era leer-modificar-escribir desde la API: dos peticiones
-- concurrentes (importación + automatización, dos pestañas) perdían una actualización, y
-- un fallo entre el INSERT de la transacción y el UPDATE del saldo los dejaba descuadrados.
-- Todas son SECURITY INVOKER: con la sesión del usuario aplica RLS; con service role
-- (automatización) el filtro explícito por p_user_id limita las filas.

create or replace function public.adjust_account_balance(
  p_account_id uuid,
  p_user_id uuid,
  p_delta numeric
) returns numeric
language sql
security invoker
set search_path = ''
as $$
  update public.accounts
  set balance = balance + p_delta
  where id = p_account_id and user_id = p_user_id
  returning balance;
$$;

create or replace function public.create_transaction_with_balance(
  p_user_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_type text,
  p_date timestamptz,
  p_description text default null,
  p_category_id uuid default null,
  p_subcategory_id uuid default null
) returns public.transactions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tx public.transactions;
begin
  insert into public.transactions (user_id, account_id, amount, type, date, description, category_id, subcategory_id)
  values (p_user_id, p_account_id, p_amount, p_type, p_date, p_description, p_category_id, p_subcategory_id)
  returning * into v_tx;

  update public.accounts
  set balance = balance + case when p_type = 'income' then p_amount else -p_amount end
  where id = p_account_id and user_id = p_user_id;

  return v_tx;
end;
$$;

create or replace function public.update_transaction_with_balance(
  p_id uuid,
  p_user_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_type text,
  p_date timestamptz,
  p_description text,
  p_category_id uuid,
  p_subcategory_id uuid,
  p_clear_external_hash boolean default false,
  p_clear_import_line_id boolean default false
) returns public.transactions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old public.transactions;
  v_new public.transactions;
begin
  select * into v_old
  from public.transactions
  where id = p_id and user_id = p_user_id
  for update;

  if not found then
    return null;
  end if;

  update public.transactions
  set account_id = p_account_id,
      amount = p_amount,
      type = p_type,
      date = p_date,
      description = p_description,
      category_id = p_category_id,
      subcategory_id = p_subcategory_id,
      external_hash = case when p_clear_external_hash then null else external_hash end,
      import_line_id = case when p_clear_import_line_id then null else import_line_id end
  where id = p_id and user_id = p_user_id
  returning * into v_new;

  update public.accounts
  set balance = balance - case when v_old.type = 'income' then v_old.amount else -v_old.amount end
  where id = v_old.account_id and user_id = p_user_id;

  update public.accounts
  set balance = balance + case when p_type = 'income' then p_amount else -p_amount end
  where id = p_account_id and user_id = p_user_id;

  return v_new;
end;
$$;

create or replace function public.delete_transaction_with_balance(
  p_id uuid,
  p_user_id uuid,
  p_adjust_balance boolean default true
) returns public.transactions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old public.transactions;
begin
  delete from public.transactions
  where id = p_id and user_id = p_user_id
  returning * into v_old;

  if not found then
    return null;
  end if;

  if p_adjust_balance then
    update public.accounts
    set balance = balance - case when v_old.type = 'income' then v_old.amount else -v_old.amount end
    where id = v_old.account_id and user_id = p_user_id;
  end if;

  return v_old;
end;
$$;

-- Borrado masivo de una cuenta (todo o rango [p_from, p_to)) revirtiendo su efecto en el saldo.
create or replace function public.delete_account_transactions(
  p_account_id uuid,
  p_user_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null
) returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
  v_net numeric;
begin
  with deleted as (
    delete from public.transactions
    where account_id = p_account_id
      and user_id = p_user_id
      and (p_from is null or date >= p_from)
      and (p_to is null or date < p_to)
    returning amount, type
  )
  select count(*), coalesce(sum(case when type = 'income' then amount else -amount end), 0)
  into v_count, v_net
  from deleted;

  if v_count > 0 then
    update public.accounts
    set balance = balance - v_net
    where id = p_account_id and user_id = p_user_id;
  end if;

  return v_count;
end;
$$;

revoke execute on function public.adjust_account_balance(uuid, uuid, numeric) from public, anon;
revoke execute on function public.create_transaction_with_balance(uuid, uuid, numeric, text, timestamptz, text, uuid, uuid) from public, anon;
revoke execute on function public.update_transaction_with_balance(uuid, uuid, uuid, numeric, text, timestamptz, text, uuid, uuid, boolean, boolean) from public, anon;
revoke execute on function public.delete_transaction_with_balance(uuid, uuid, boolean) from public, anon;
revoke execute on function public.delete_account_transactions(uuid, uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.adjust_account_balance(uuid, uuid, numeric) to authenticated, service_role;
grant execute on function public.create_transaction_with_balance(uuid, uuid, numeric, text, timestamptz, text, uuid, uuid) to authenticated, service_role;
grant execute on function public.update_transaction_with_balance(uuid, uuid, uuid, numeric, text, timestamptz, text, uuid, uuid, boolean, boolean) to authenticated, service_role;
grant execute on function public.delete_transaction_with_balance(uuid, uuid, boolean) to authenticated, service_role;
grant execute on function public.delete_account_transactions(uuid, uuid, timestamptz, timestamptz) to authenticated, service_role;

-- Rate limiting por ventana fija. Solo accesible con service role (RLS sin políticas).
create table if not exists public.api_rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count integer not null
);
alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from anon, authenticated;

create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.api_rate_limits as r (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
  set count = case
        when r.window_start < now() - make_interval(secs => p_window_seconds) then 1
        else r.count + 1
      end,
      window_start = case
        when r.window_start < now() - make_interval(secs => p_window_seconds) then now()
        else r.window_start
      end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke execute on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

-- Último uso del token de automatización (visible en Ajustes).
alter table public.api_tokens add column if not exists last_used_at timestamptz;
