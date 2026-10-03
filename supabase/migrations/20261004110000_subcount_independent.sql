-- Subcount pasa a ser independiente de las finanzas personales y desaparecen los grupos 1 a 1.
--  * Los gastos compartidos y las liquidaciones ya no crean ni vinculan transacciones: fuera filas
--    virtuales (source='shared'), transactions.shared_expense_id / metric_amount y las RPC de vínculo.
--  * Solo hay grupos: fuera groups.kind / direct_key y get_or_create_direct_group.

-- 1. Datos: filas virtuales fuera; las bancarias vinculadas vuelven a contar entero -----------------
delete from public.transactions where source = 'shared';
update public.transactions set shared_expense_id = null, metric_amount = null
where shared_expense_id is not null or metric_amount is not null;

-- 2. RPC de vínculo con transacciones -------------------------------------------------------------
drop function if exists public.link_payer_transaction(uuid, uuid);
drop function if exists public.link_settlement_transaction(uuid, uuid);
drop function if exists public.unlink_transaction(uuid);
drop function if exists public.upsert_shared_expense(uuid, uuid, text, numeric, timestamptz, uuid, text, jsonb, uuid, uuid, uuid);
drop function if exists public.record_settlement(uuid, uuid, uuid, numeric, timestamptz, uuid);
drop function if exists public._sync_expense_rows(uuid, uuid, uuid, text, uuid, uuid);
drop function if exists public.get_or_create_direct_group(uuid);

drop trigger if exists transactions_block_joint_shared on public.transactions;
drop function if exists public.transactions_block_joint_shared();

-- 3. transactions: vuelve a exigir cuenta y pierde las columnas compartidas -----------------------------
drop policy if exists transactions_insert on public.transactions;
drop policy if exists transactions_update on public.transactions;
drop policy if exists transactions_delete on public.transactions;

alter table public.transactions drop constraint if exists transactions_virtual_account_check;
drop index if exists public.transactions_shared_expense_user_key;
alter table public.transactions
  drop column if exists shared_expense_id,
  drop column if exists metric_amount;
alter table public.transactions alter column account_id set not null;

alter table public.transactions drop constraint if exists transactions_source_check;
alter table public.transactions
  add constraint transactions_source_check check (source in ('manual', 'import'));

create policy transactions_insert on public.transactions for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.is_account_member(account_id, (select auth.uid()))
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
  using (public.is_account_member(account_id, (select auth.uid())))
  with check (
    public.is_account_member(account_id, (select auth.uid()))
    and ((select auth.uid()) = user_id or public.is_account_member(account_id, user_id))
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
  using (public.is_account_member(account_id, (select auth.uid())));

-- Cuentas conjuntas: ya no hay vínculos con gastos compartidos que bloqueen la invitación.
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

-- 4. groups: solo grupos con nombre -------------------------------------------------------------------
delete from public.groups where kind = 'direct';
alter table public.groups drop constraint if exists groups_check;
alter table public.groups drop constraint if exists groups_check1;
alter table public.groups drop constraint if exists groups_kind_check;
drop index if exists public.groups_direct_key_key;
alter table public.groups
  drop column if exists kind,
  drop column if exists direct_key;
alter table public.groups add constraint groups_name_not_blank check (char_length(btrim(name)) >= 1);

create or replace function public.create_group(p_name text, p_member_ids uuid[])
returns public.groups
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  g public.groups;
  m uuid;
  members uuid[];
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.profiles where user_id = me) then raise exception 'profile_required'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 60 then raise exception 'invalid_name'; end if;

  select coalesce(array_agg(distinct x), '{}') into members
  from unnest(coalesce(p_member_ids, '{}')) x where x <> me;
  if coalesce(array_length(members, 1), 0) > 30 then raise exception 'too_many_members'; end if;
  foreach m in array members loop
    if not public.are_friends(me, m) then raise exception 'not_friends'; end if;
  end loop;

  insert into public.groups (name, created_by) values (btrim(p_name), me) returning * into g;
  insert into public.group_members (group_id, user_id) values (g.id, me);
  foreach m in array members loop
    insert into public.group_members (group_id, user_id) values (g.id, m);
  end loop;
  return g;
end;
$$;

create or replace function public.add_group_member(p_group_id uuid, p_user_id uuid)
returns public.group_members
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  g public.groups;
  gm public.group_members;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select * into g from public.groups where id = p_group_id;
  if not found or not public.is_group_member(p_group_id) then raise exception 'group_not_found'; end if;
  if g.archived_at is not null then raise exception 'group_archived'; end if;
  if not public.are_friends(me, p_user_id) then raise exception 'not_friends'; end if;
  if (select count(*) from public.group_members where group_id = p_group_id) >= 30 then raise exception 'too_many_members'; end if;

  insert into public.group_members (group_id, user_id) values (p_group_id, p_user_id)
  on conflict do nothing;
  select * into gm from public.group_members where group_id = p_group_id and user_id = p_user_id;
  insert into public.shared_expense_events (group_id, actor_id, action, summary)
  values (p_group_id, me, 'member_added', jsonb_build_object('user_id', p_user_id));
  return gm;
end;
$$;

-- Salir o expulsar: solo con saldo 0 (si no, la deuda quedaría huérfana).
create or replace function public.remove_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  v_net numeric;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.groups where id = p_group_id) or not public.is_group_member(p_group_id) then
    raise exception 'group_not_found';
  end if;
  if not exists (select 1 from public.group_members where group_id = p_group_id and user_id = p_user_id) then
    raise exception 'member_not_found';
  end if;

  select b.net into v_net from public.group_balances(p_group_id) b where b.user_id = p_user_id;
  if round(coalesce(v_net, 0) * 100) <> 0 then raise exception 'member_has_balance'; end if;

  delete from public.group_members where group_id = p_group_id and user_id = p_user_id;
  insert into public.shared_expense_events (group_id, actor_id, action, summary)
  values (p_group_id, me, 'member_removed', jsonb_build_object('user_id', p_user_id));
  return true;
end;
$$;

-- Renombrar / archivar un grupo (cualquier miembro).
create or replace function public.update_group(p_group_id uuid, p_name text, p_archived boolean)
returns public.groups
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  g public.groups;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select * into g from public.groups where id = p_group_id for update;
  if not found or not public.is_group_member(p_group_id) then raise exception 'group_not_found'; end if;
  if p_name is not null and char_length(btrim(p_name)) not between 1 and 60 then raise exception 'invalid_name'; end if;

  update public.groups
  set name = coalesce(btrim(p_name), name),
      archived_at = case
        when p_archived is null then archived_at
        when p_archived then coalesce(archived_at, now())
        else null
      end
  where id = g.id returning * into g;
  return g;
end;
$$;

-- 5. Gastos y liquidaciones sin transacciones -------------------------------------------------------
-- p_shares: [{"user_id": uuid, "amount": numeric, "weight": numeric|null}] ya calculado por la API
-- (la API recalcula con computeShares; aquí solo se valida que cuadre al céntimo).
create function public.upsert_shared_expense(
  p_expense_id uuid,
  p_group_id uuid,
  p_title text,
  p_total numeric,
  p_date timestamptz,
  p_paid_by uuid,
  p_split_mode text,
  p_shares jsonb
) returns public.shared_expenses
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  e public.shared_expenses;
  v_group uuid;
  v_sum bigint;
  v_distinct int;
  v_count int;
  v_action text;
begin
  if me is null then raise exception 'not_authenticated'; end if;

  if p_expense_id is null then
    v_group := p_group_id;
    if not exists (select 1 from public.groups g where g.id = v_group and g.archived_at is null) then
      raise exception 'group_not_found';
    end if;
  else
    select * into e from public.shared_expenses where id = p_expense_id for update;
    if not found or e.deleted_at is not null then raise exception 'expense_not_found'; end if;
    if e.kind <> 'expense' then raise exception 'not_an_expense'; end if;
    v_group := e.group_id;
  end if;
  if not public.is_group_member(v_group) then raise exception 'group_not_found'; end if;

  if p_title is null or char_length(btrim(p_title)) not between 1 and 120 then raise exception 'invalid_title'; end if;
  if p_total is null or p_total <= 0 or p_total <> round(p_total, 2) then raise exception 'invalid_total'; end if;
  if p_split_mode not in ('equal', 'exact', 'percent', 'shares') then raise exception 'invalid_split_mode'; end if;
  if p_shares is null or jsonb_typeof(p_shares) <> 'array' or jsonb_array_length(p_shares) = 0 then
    raise exception 'invalid_shares';
  end if;
  if not exists (select 1 from public.group_members where group_id = v_group and user_id = p_paid_by) then
    raise exception 'payer_not_member';
  end if;

  select count(*), count(distinct x.user_id), coalesce(sum(round(x.amount * 100)), 0)
  into v_count, v_distinct, v_sum
  from jsonb_to_recordset(p_shares) as x(user_id uuid, amount numeric, weight numeric);
  if v_count <> v_distinct then raise exception 'invalid_shares'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_shares) as x(user_id uuid, amount numeric, weight numeric)
    where x.user_id is null or x.amount is null or x.amount < 0 or x.amount <> round(x.amount, 2)
  ) then
    raise exception 'invalid_shares';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_shares) as x(user_id uuid, amount numeric, weight numeric)
    where not exists (select 1 from public.group_members gm where gm.group_id = v_group and gm.user_id = x.user_id)
  ) then raise exception 'share_user_not_member'; end if;
  if v_sum <> round(p_total * 100) then raise exception 'sum_mismatch'; end if;

  if p_expense_id is null then
    insert into public.shared_expenses (group_id, kind, title, total_amount, date, paid_by, split_mode, created_by, updated_by)
    values (v_group, 'expense', btrim(p_title), p_total, p_date, p_paid_by, p_split_mode, me, me)
    returning * into e;
    v_action := 'created';
  else
    update public.shared_expenses
    set title = btrim(p_title), total_amount = p_total, date = p_date, paid_by = p_paid_by,
        split_mode = p_split_mode, updated_by = me, updated_at = now()
    where id = e.id returning * into e;
    v_action := 'updated';
  end if;

  delete from public.shared_expense_shares where expense_id = e.id;
  insert into public.shared_expense_shares (expense_id, user_id, amount, weight)
  select e.id, x.user_id, x.amount, x.weight
  from jsonb_to_recordset(p_shares) as x(user_id uuid, amount numeric, weight numeric);

  insert into public.shared_expense_events (group_id, expense_id, actor_id, action, summary)
  values (v_group, e.id, me, v_action, jsonb_build_object('title', e.title, 'total', e.total_amount, 'paid_by', e.paid_by));
  return e;
end;
$$;

create or replace function public.delete_shared_expense(p_expense_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  e public.shared_expenses;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select * into e from public.shared_expenses where id = p_expense_id for update;
  if not found or e.deleted_at is not null or not public.is_group_member(e.group_id) then
    raise exception 'expense_not_found';
  end if;

  update public.shared_expenses set deleted_at = now(), updated_by = me, updated_at = now() where id = e.id;
  insert into public.shared_expense_events (group_id, expense_id, actor_id, action, summary)
  values (e.group_id, e.id, me, 'deleted', jsonb_build_object('title', e.title, 'total', e.total_amount, 'kind', e.kind));
  return true;
end;
$$;

-- Liquidación: p_from (deudor) paga p_to (acreedor). El que llama es uno de los dos.
create function public.record_settlement(
  p_group_id uuid,
  p_from uuid,
  p_to uuid,
  p_amount numeric,
  p_date timestamptz
) returns public.shared_expenses
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  e public.shared_expenses;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if not public.is_group_member(p_group_id) then raise exception 'group_not_found'; end if;
  if me not in (p_from, p_to) or p_from = p_to then raise exception 'invalid_settlement'; end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then raise exception 'invalid_total'; end if;
  if (select count(*) from public.group_members where group_id = p_group_id and user_id in (p_from, p_to)) <> 2 then
    raise exception 'share_user_not_member';
  end if;

  insert into public.shared_expenses (group_id, kind, title, total_amount, date, paid_by, split_mode, created_by, updated_by)
  values (p_group_id, 'settlement', 'settlement', p_amount, p_date, p_from, 'exact', me, me)
  returning * into e;
  insert into public.shared_expense_shares (expense_id, user_id, amount) values (e.id, p_to, p_amount);

  insert into public.shared_expense_events (group_id, expense_id, actor_id, action, summary)
  values (p_group_id, e.id, me, 'settled', jsonb_build_object('from', p_from, 'to', p_to, 'total', p_amount));
  return e;
end;
$$;

revoke all on function public.upsert_shared_expense(uuid, uuid, text, numeric, timestamptz, uuid, text, jsonb) from public, anon;
revoke all on function public.record_settlement(uuid, uuid, uuid, numeric, timestamptz) from public, anon;
grant execute on function public.upsert_shared_expense(uuid, uuid, text, numeric, timestamptz, uuid, text, jsonb) to authenticated;
grant execute on function public.record_settlement(uuid, uuid, uuid, numeric, timestamptz) to authenticated;
