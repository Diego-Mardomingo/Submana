-- Sincronización bancaria con Enable Banking (PSD2, solo lectura).
--  * bank_connections: un permiso (sesión) de un usuario en un banco. session_id y pending_state son
--    secretos de servidor: nadie con la clave anon o la sesión del usuario puede leer estas tablas; las
--    rutas de la API las usan con el service role, filtrando siempre por user_id.
--  * bank_account_links: cada cuenta del banco que trajo el permiso y la cuenta de Submana a la que se
--    importa (account_id null = sin vincular). Solo se guardan los 4 últimos dígitos del IBAN; la cuenta se
--    reconoce entre sesiones por identification_hash (estable, lo calcula Enable Banking).
--  * transactions.source 'bank': filas creadas por la sincronización.
--  * transactions.review_match_id: fila del banco insertada como nueva que quizá sea la misma que esa
--    transacción manual; el usuario decide (fusionar o descartar el aviso).
-- Solo añade objetos: no rompe la versión desplegada.

-- 1. bank_connections ----------------------------------------------------------------------
create table if not exists public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  aspsp_name text not null,
  aspsp_country text not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'expired', 'revoked')),
  -- Sesión de Enable Banking (null hasta volver del banco).
  session_id text unique,
  -- `state` del viaje al banco (CSRF); se borra al volver.
  pending_state text unique,
  -- Cuenta de Submana desde la que se inició la conexión (a donde se vuelve).
  origin_account_id uuid references public.accounts (id) on delete set null,
  -- Conexión a la que sustituye al reconectar (se borra cuando la nueva queda activa).
  replaces_id uuid references public.bank_connections (id) on delete set null,
  valid_until timestamptz,
  last_synced_at timestamptz,
  last_error text,
  -- Cerrojo para que el cron y "Sincronizar ahora" no corran a la vez.
  sync_started_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists bank_connections_user_idx on public.bank_connections (user_id);
create index if not exists bank_connections_active_idx on public.bank_connections (status) where status = 'active';

alter table public.bank_connections enable row level security;
revoke all on public.bank_connections from anon, authenticated;

-- 2. bank_account_links --------------------------------------------------------------------
create table if not exists public.bank_account_links (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.bank_connections (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  -- uid de la cuenta en la sesión actual (cambia al reconectar).
  bank_account_uid text not null,
  identification_hash text not null,
  iban_last4 text,
  currency text,
  -- full: transacciones + saldo; balance: solo saldo (bancos que no dan conceptos, p. ej. Trade Republic).
  sync_mode text not null default 'full' check (sync_mode in ('full', 'balance')),
  -- Solo se importan movimientos desde este día (lo anterior ya vino de extractos).
  sync_from date,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (connection_id, identification_hash)
);

-- Una cuenta de Submana se alimenta de una sola cuenta bancaria.
create unique index if not exists bank_account_links_account_unique on public.bank_account_links (account_id) where account_id is not null;
create index if not exists bank_account_links_user_idx on public.bank_account_links (user_id);

alter table public.bank_account_links enable row level security;
revoke all on public.bank_account_links from anon, authenticated;

-- 3. transactions ----------------------------------------------------------------------------
alter table public.transactions drop constraint if exists transactions_source_check;
alter table public.transactions
  add constraint transactions_source_check check (source in ('manual', 'import', 'shared', 'bank'));

alter table public.transactions
  add column if not exists review_match_id uuid references public.transactions (id) on delete set null;

create index if not exists idx_transactions_review on public.transactions (account_id) where review_match_id is not null;

-- 4. RPC: resolver un posible duplicado ------------------------------------------------------
-- p_merge = true: la fila del banco se funde en la transacción manual (que conserva fecha, descripción y
-- categoría del usuario y gana la identidad bancaria) y la del banco desaparece. No toca el saldo: en las
-- cuentas sincronizadas el saldo es el del banco. p_merge = false: solo quita el aviso.
-- La ruta comprueba antes el acceso del usuario a la cuenta; aquí solo se exige que ambas filas sean de ella.
create or replace function public.resolve_bank_review(p_tx_id uuid, p_merge boolean)
returns public.transactions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_bank public.transactions;
  v_manual public.transactions;
begin
  select * into v_bank from public.transactions
  where id = p_tx_id and review_match_id is not null
  for update;
  if not found then
    return null;
  end if;

  if not p_merge then
    update public.transactions set review_match_id = null where id = v_bank.id returning * into v_bank;
    return v_bank;
  end if;

  select * into v_manual from public.transactions
  where id = v_bank.review_match_id and account_id = v_bank.account_id and booked_at is null
  for update;
  if not found then
    -- La manual ya no existe o ya tiene línea bancaria: no hay nada que fundir.
    update public.transactions set review_match_id = null where id = v_bank.id;
    return null;
  end if;

  -- Primero se borra la del banco: (account_id, import_line_id) es único.
  delete from public.transactions where id = v_bank.id;

  update public.transactions
  set import_line_id = v_bank.import_line_id,
      external_hash = v_bank.external_hash,
      statement_balance = v_bank.statement_balance,
      booked_at = v_bank.booked_at,
      bank_description = v_bank.bank_description
  where id = v_manual.id
  returning * into v_manual;

  return v_manual;
end;
$$;

revoke execute on function public.resolve_bank_review(uuid, boolean) from public, anon, authenticated;
grant execute on function public.resolve_bank_review(uuid, boolean) to service_role;
