-- Fase 4: cuentas conjuntas.
-- Una cuenta conjunta es una cuenta bancaria real visible para 2+ miembros (solo amigos, con invitación aceptada).
--  * accounts.user_id sigue siendo el propietario; transactions.user_id es el AUTOR de la fila y el acceso
--    viene de ser miembro de la cuenta (is_account_member).
--  * import_line_id es único por cuenta: el mismo extracto se deduplica una sola vez lo importe quien lo importe.
--  * Los movimientos de la conjunta no cuentan en métricas ni presupuestos (lo filtra la app con is_joint).
--  * Solo categorías del sistema en cuentas conjuntas: se exige en la API (no en RLS, para no bloquear la
--    edición de filas antiguas al convertir una cuenta existente en conjunta).
--  * Los miembros pueden editar nombre, color, icono, banco y saldo (vía RPC de saldo); NO user_id, is_joint,
--    is_default ni display_order (trigger accounts_guard_update). is_joint solo cambia vía las RPC de abajo.
--  * Las filas de transacciones enlazadas a un gasto compartido (Fase 3) no pueden vivir en una conjunta.
--  * Las altas/bajas de miembros pasan por RPC SECURITY DEFINER; no hay INSERT/UPDATE/DELETE directo.

-- 1. Esquema -------------------------------------------------------------------------------
alter table public.accounts add column if not exists is_joint boolean not null default false;

create table public.account_members (
  account_id uuid not null references public.accounts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  -- Orden propio de cada miembro (reservado; la API aún no lo escribe).
  display_order integer not null default 0,
  added_by uuid not null references auth.users (id),
  added_at timestamptz not null default now(),
  primary key (account_id, user_id)
);
create index account_members_user_idx on public.account_members (user_id);
alter table public.account_members enable row level security;
revoke insert, update, delete on public.account_members from anon, authenticated;

-- 2. Helpers (DEFINER: leen account_members/accounts saltando RLS, sin recursión de políticas) ----
create or replace function public.is_account_member(p_account uuid, p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.accounts a where a.id = p_account and a.user_id = p_user)
      or exists (
        select 1 from public.account_members m
        where m.account_id = p_account and m.user_id = p_user and m.status = 'accepted'
      );
$$;

-- Dos usuarios que comparten alguna cuenta conjunta (ambos aceptados).
create or replace function public.shares_account_with(target uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.account_members mine
    join public.account_members theirs on theirs.account_id = mine.account_id
    where mine.user_id = (select auth.uid()) and mine.status = 'accepted'
      and theirs.user_id = target and theirs.status = 'accepted'
  );
$$;

-- Fase 2 + grupos + "comparte cuenta conjunta".
create or replace function public.can_see_profile(target uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (
      target = (select auth.uid())
      or exists (
        select 1 from public.friendships f
        where (f.requester_id = (select auth.uid()) and f.addressee_id = target)
           or (f.addressee_id = (select auth.uid()) and f.requester_id = target)
      )
      or public.shares_group_with(target)
      or public.shares_account_with(target)
    );
$$;

revoke all on function public.is_account_member(uuid, uuid) from public, anon;
revoke all on function public.shares_account_with(uuid) from public, anon;
revoke all on function public.can_see_profile(uuid) from public, anon;
grant execute on function public.is_account_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.shares_account_with(uuid) to authenticated;
grant execute on function public.can_see_profile(uuid) to authenticated;

-- 3. Triggers ------------------------------------------------------------------------------
create or replace function public.accounts_guard_update()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    return new; -- service role / migraciones
  end if;
  if new.user_id is distinct from old.user_id then
    raise exception 'account_owner_immutable';
  end if;
  if new.is_joint is distinct from old.is_joint and coalesce(current_setting('app.joint_rpc', true), '') <> 'on' then
    raise exception 'joint_flag_managed';
  end if;
  if me <> old.user_id and (new.is_default is distinct from old.is_default or new.display_order is distinct from old.display_order) then
    raise exception 'owner_only_field';
  end if;
  return new;
end;
$$;
create trigger accounts_guard_update before update on public.accounts
  for each row execute function public.accounts_guard_update();

create or replace function public.transactions_block_joint_shared()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.shared_expense_id is not null and new.account_id is not null
     and exists (select 1 from public.accounts a where a.id = new.account_id and a.is_joint) then
    raise exception 'joint_account_transaction';
  end if;
  return new;
end;
$$;
create trigger transactions_block_joint_shared before insert or update on public.transactions
  for each row execute function public.transactions_block_joint_shared();

-- 4. RLS -----------------------------------------------------------------------------------
-- accounts: leen/editan propietario y miembros; crean y borran solo el propietario (nunca ya conjunta).
drop policy if exists accounts_own on public.accounts;
create policy accounts_select on public.accounts for select to authenticated
  using ((select auth.uid()) = user_id or public.is_account_member(id, (select auth.uid())));
create policy accounts_insert on public.accounts for insert to authenticated
  with check ((select auth.uid()) = user_id and not is_joint);
create policy accounts_update on public.accounts for update to authenticated
  using ((select auth.uid()) = user_id or public.is_account_member(id, (select auth.uid())))
  with check ((select auth.uid()) = user_id or public.is_account_member(id, (select auth.uid())));
create policy accounts_delete on public.accounts for delete to authenticated
  using ((select auth.uid()) = user_id);

-- account_members: miembros de la cuenta y el propio invitado.
create policy account_members_select on public.account_members for select to authenticated
  using ((select auth.uid()) = user_id or public.is_account_member(account_id, (select auth.uid())));

-- transactions
--  * Una fila es visible si es mía o soy miembro de su cuenta.
--  * Se escribe en filas de cuentas de las que soy miembro (incluidas las de otros miembros de una conjunta).
--  * Las filas virtuales (Fase 3, sin cuenta) solo las toca su dueño.
drop policy if exists transactions_own on public.transactions;
create policy transactions_select on public.transactions for select to authenticated
  using (
    (select auth.uid()) = user_id
    or (account_id is not null and public.is_account_member(account_id, (select auth.uid())))
  );
create policy transactions_insert on public.transactions for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      (account_id is null and source = 'shared' and shared_expense_id is not null)
      or (account_id is not null and public.is_account_member(account_id, (select auth.uid())))
    )
    and (category_id is null or exists (
      select 1 from public.categories c
      where c.id = transactions.category_id and (c.user_id is null or c.user_id = (select auth.uid()))
    ))
    and (subcategory_id is null or exists (
      select 1 from public.categories c
      where c.id = transactions.subcategory_id and (c.user_id is null or c.user_id = (select auth.uid()))
    ))
  );
create policy transactions_update on public.transactions for update to authenticated
  using (
    (account_id is null and (select auth.uid()) = user_id)
    or (account_id is not null and public.is_account_member(account_id, (select auth.uid())))
  )
  with check (
    (
      (account_id is null and (select auth.uid()) = user_id and source = 'shared' and shared_expense_id is not null)
      or (
        account_id is not null
        and public.is_account_member(account_id, (select auth.uid()))
        and ((select auth.uid()) = user_id or public.is_account_member(account_id, user_id))
      )
    )
    and (category_id is null or exists (
      select 1 from public.categories c
      where c.id = transactions.category_id and (c.user_id is null or c.user_id = (select auth.uid()))
    ))
    and (subcategory_id is null or exists (
      select 1 from public.categories c
      where c.id = transactions.subcategory_id and (c.user_id is null or c.user_id = (select auth.uid()))
    ))
  );
create policy transactions_delete on public.transactions for delete to authenticated
  using (
    (account_id is null and (select auth.uid()) = user_id)
    or (account_id is not null and public.is_account_member(account_id, (select auth.uid())))
  );

-- import_duplicate_decisions: las decisiones de una cuenta las comparten todos sus miembros.
drop policy if exists import_duplicate_decisions_own on public.import_duplicate_decisions;
create policy import_duplicate_decisions_own on public.import_duplicate_decisions for all to authenticated
  using (public.is_account_member(account_id, (select auth.uid())))
  with check ((select auth.uid()) = user_id and public.is_account_member(account_id, (select auth.uid())));

-- subscriptions: se mantiene solo para cuentas propias (sin cambios).

-- 5. RPCs de miembros ------------------------------------------------------------------------
-- Interna: si no quedan miembros (aceptados o pendientes) la cuenta vuelve a ser personal.
create or replace function public._cleanup_joint_account(p_account uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.account_members where account_id = p_account and role = 'member') then
    perform set_config('app.joint_rpc', 'on', true);
    update public.accounts set is_joint = false where id = p_account;
    delete from public.account_members where account_id = p_account;
    perform set_config('app.joint_rpc', 'off', true);
  end if;
end;
$$;

create or replace function public.invite_account_member(p_account uuid, p_friend uuid)
returns public.account_members
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  a public.accounts;
  m public.account_members;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select * into a from public.accounts where id = p_account;
  if not found or a.user_id <> me then raise exception 'account_not_found'; end if;
  if p_friend is null or p_friend = me or not public.are_friends(me, p_friend) then raise exception 'not_friends'; end if;
  if (select count(*) from public.account_members where account_id = p_account) >= 10 then raise exception 'too_many_members'; end if;
  if not a.is_joint and exists (
    select 1 from public.transactions t where t.account_id = p_account and t.shared_expense_id is not null
  ) then
    raise exception 'account_has_shared_links';
  end if;

  select * into m from public.account_members where account_id = p_account and user_id = p_friend;
  if found then
    if m.status = 'accepted' then raise exception 'already_member'; end if;
    return m; -- invitación pendiente ya enviada
  end if;

  insert into public.account_members (account_id, user_id, role, status, added_by)
  values (p_account, me, 'owner', 'accepted', me)
  on conflict do nothing;
  insert into public.account_members (account_id, user_id, role, status, added_by)
  values (p_account, p_friend, 'member', 'pending', me)
  returning * into m;

  perform set_config('app.joint_rpc', 'on', true);
  update public.accounts set is_joint = true where id = p_account;
  perform set_config('app.joint_rpc', 'off', true);
  return m;
end;
$$;

create or replace function public.respond_account_invite(p_account uuid, p_accept boolean)
returns public.account_members
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  m public.account_members;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select * into m from public.account_members
  where account_id = p_account and user_id = me and status = 'pending';
  if not found then raise exception 'invite_not_found'; end if;
  if p_accept then
    update public.account_members set status = 'accepted' where account_id = p_account and user_id = me
    returning * into m;
  else
    delete from public.account_members where account_id = p_account and user_id = me;
    perform public._cleanup_joint_account(p_account);
  end if;
  return m;
end;
$$;

create or replace function public.leave_account(p_account uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  m public.account_members;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select * into m from public.account_members where account_id = p_account and user_id = me;
  if not found then raise exception 'not_a_member'; end if;
  if m.role = 'owner' then raise exception 'owner_cannot_leave'; end if;
  delete from public.account_members where account_id = p_account and user_id = me;
  perform public._cleanup_joint_account(p_account);
  return true;
end;
$$;

create or replace function public.remove_account_member(p_account uuid, p_user uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.accounts where id = p_account and user_id = me) then raise exception 'account_not_found'; end if;
  if p_user = me then raise exception 'owner_cannot_leave'; end if;
  delete from public.account_members where account_id = p_account and user_id = p_user and role = 'member';
  if not found then raise exception 'member_not_found'; end if;
  perform public._cleanup_joint_account(p_account);
  return true;
end;
$$;

-- Invitaciones pendientes del usuario con los datos mínimos de la cuenta (aún no puede leerla por RLS).
create or replace function public.my_account_invites()
returns table (account_id uuid, account_name text, icon text, color text, owner_id uuid, invited_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not_authenticated'; end if;
  return query
    select m.account_id, a.name, a.icon, a.color, a.user_id, m.added_at
    from public.account_members m
    join public.accounts a on a.id = m.account_id
    where m.user_id = me and m.status = 'pending'
    order by m.added_at desc;
end;
$$;

revoke all on function public._cleanup_joint_account(uuid) from public, anon, authenticated;
revoke all on function public.invite_account_member(uuid, uuid) from public, anon;
revoke all on function public.respond_account_invite(uuid, boolean) from public, anon;
revoke all on function public.leave_account(uuid) from public, anon;
revoke all on function public.remove_account_member(uuid, uuid) from public, anon;
revoke all on function public.my_account_invites() from public, anon;
grant execute on function public.invite_account_member(uuid, uuid) to authenticated;
grant execute on function public.respond_account_invite(uuid, boolean) to authenticated;
grant execute on function public.leave_account(uuid) to authenticated;
grant execute on function public.remove_account_member(uuid, uuid) to authenticated;
grant execute on function public.my_account_invites() to authenticated;

-- 6. RPCs de saldo (mismas firmas): el acceso a la cuenta es is_account_member ------------------
-- Las filas de cuentas personales siguen siendo del usuario (el propietario es miembro); en una conjunta
-- cualquier miembro puede operar sobre las filas de la cuenta. Las filas virtuales (account_id null)
-- solo las toca su dueño. SECURITY INVOKER: con sesión de usuario aplica además RLS.
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
  where id = p_account_id and public.is_account_member(p_account_id, p_user_id)
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
  -- También cubre la automatización (service role, sin RLS).
  if not public.is_account_member(p_account_id, p_user_id) then
    raise exception 'account_not_found';
  end if;

  insert into public.transactions (user_id, account_id, amount, type, date, description, category_id, subcategory_id, source)
  values (p_user_id, p_account_id, p_amount, p_type, p_date, p_description, p_category_id, p_subcategory_id, p_source)
  returning * into v_tx;

  update public.accounts
  set balance = balance + case when p_type = 'income' then p_amount else -p_amount end
  where id = p_account_id;

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
  where id = p_id
    and ((account_id is null and user_id = p_user_id) or public.is_account_member(account_id, p_user_id))
  for update;

  if not found then
    return null;
  end if;

  if p_account_id is not null and not public.is_account_member(p_account_id, p_user_id) then
    raise exception 'account_not_found';
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
  where id = p_id
  returning * into v_new;

  update public.accounts
  set balance = balance - case when v_old.type = 'income' then v_old.amount else -v_old.amount end
  where id = v_old.account_id and public.is_account_member(v_old.account_id, p_user_id);

  update public.accounts
  set balance = balance + case when p_type = 'income' then p_amount else -p_amount end
  where id = p_account_id and public.is_account_member(p_account_id, p_user_id);

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
  where id = p_id
    and ((account_id is null and user_id = p_user_id) or public.is_account_member(account_id, p_user_id))
  returning * into v_old;

  if not found then
    return null;
  end if;

  if p_adjust_balance then
    update public.accounts
    set balance = balance - case when v_old.type = 'income' then v_old.amount else -v_old.amount end
    where id = v_old.account_id and public.is_account_member(v_old.account_id, p_user_id);
  end if;

  return v_old;
end;
$$;

-- Borrado masivo: borra TODAS las filas de la cuenta (de cualquier autor). La API lo limita al
-- propietario en cuentas conjuntas.
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
  if not public.is_account_member(p_account_id, p_user_id) then
    return 0;
  end if;

  with deleted as (
    delete from public.transactions
    where account_id = p_account_id
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
    where id = p_account_id;
  end if;

  return v_count;
end;
$$;

-- Fusión de una línea del extracto con una manual sin conciliar: cualquier miembro de la cuenta
-- puede conciliar filas de otros miembros (la deduplicación es por cuenta).
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
    and account_id is not null
    and public.is_account_member(account_id, p_user_id)
    and booked_at is null
  returning * into v_tx;

  return v_tx;
end;
$$;

revoke execute on function public.adjust_account_balance(uuid, uuid, numeric) from public, anon;
revoke execute on function public.create_transaction_with_balance(uuid, uuid, numeric, text, timestamptz, text, uuid, uuid, text) from public, anon;
revoke execute on function public.update_transaction_with_balance(uuid, uuid, uuid, numeric, text, timestamptz, text, uuid, uuid, boolean, boolean) from public, anon;
revoke execute on function public.delete_transaction_with_balance(uuid, uuid, boolean) from public, anon;
revoke execute on function public.delete_account_transactions(uuid, uuid, timestamptz, timestamptz) from public, anon;
revoke execute on function public.merge_bank_line_into_transaction(uuid, uuid, text, text, numeric, timestamptz, text) from public, anon;
grant execute on function public.adjust_account_balance(uuid, uuid, numeric) to authenticated, service_role;
grant execute on function public.create_transaction_with_balance(uuid, uuid, numeric, text, timestamptz, text, uuid, uuid, text) to authenticated, service_role;
grant execute on function public.update_transaction_with_balance(uuid, uuid, uuid, numeric, text, timestamptz, text, uuid, uuid, boolean, boolean) to authenticated, service_role;
grant execute on function public.delete_transaction_with_balance(uuid, uuid, boolean) to authenticated, service_role;
grant execute on function public.delete_account_transactions(uuid, uuid, timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public.merge_bank_line_into_transaction(uuid, uuid, text, text, numeric, timestamptz, text) to authenticated, service_role;

-- Fase 3 (link_payer_transaction, link_settlement_transaction, unlink_transaction, _sync_expense_rows)
-- siguen exigiendo transactions.user_id = auth.uid() y ahora, además, el trigger
-- transactions_block_joint_shared impide enlazar filas de una cuenta conjunta.

-- 7. Verificación manual (SQL editor; usuarios A y B amigos, C ajeno; sustituir los UUID) ----------
-- begin;
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<A-uuid>","role":"authenticated"}', true);
--   insert into public.accounts (id, user_id, name, balance) values ('<acc-uuid>', '<A-uuid>', 'Conjunta', 0);
--   -- debe fallar (joint_flag_managed): update public.accounts set is_joint = true where id = '<acc-uuid>';
--   select * from public.invite_account_member('<acc-uuid>', '<C-uuid>');   -- not_friends
--   select * from public.invite_account_member('<acc-uuid>', '<B-uuid>');   -- pending; accounts.is_joint = true
--   select set_config('request.jwt.claims', '{"sub":"<B-uuid>","role":"authenticated"}', true);
--   select count(*) from public.accounts where id = '<acc-uuid>';           -- 0: aún pendiente
--   select * from public.my_account_invites();                              -- 1 fila
--   select * from public.respond_account_invite('<acc-uuid>', true);        -- accepted
--   select count(*) from public.accounts where id = '<acc-uuid>';           -- 1
--   select * from public.create_transaction_with_balance('<B-uuid>', '<acc-uuid>', 10, 'expense', now(), 'x');
--   select balance from public.accounts where id = '<acc-uuid>';            -- -10
--   -- debe fallar (owner_only_field): update public.accounts set is_default = true where id = '<acc-uuid>';
--   -- debe fallar (RLS): delete from public.accounts where id = '<acc-uuid>';
--   select set_config('request.jwt.claims', '{"sub":"<A-uuid>","role":"authenticated"}', true);
--   select count(*) from public.transactions where account_id = '<acc-uuid>';   -- 1: fila de B visible para A
--   select * from public.delete_transaction_with_balance('<tx-de-B>', '<A-uuid>');   -- cualquier miembro; saldo vuelve a 0
--   select set_config('request.jwt.claims', '{"sub":"<C-uuid>","role":"authenticated"}', true);
--   select count(*) from public.transactions where account_id = '<acc-uuid>';   -- 0
--   select public.is_account_member('<acc-uuid>', '<C-uuid>');                   -- false
--   select set_config('request.jwt.claims', '{"sub":"<B-uuid>","role":"authenticated"}', true);
--   select public.leave_account('<acc-uuid>');       -- true; sin miembros la cuenta vuelve a is_joint = false
-- rollback;
