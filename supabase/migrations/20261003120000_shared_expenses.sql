-- Fase 3: gastos compartidos, grupos, liquidaciones y simplificación de deudas.
-- Representación (ver plan):
--  * Pago yo: mi fila bancaria conserva amount (el saldo cuadra), recibe shared_expense_id y
--    metric_amount = mi parte. Métricas/presupuestos usan coalesce(metric_amount, amount).
--  * Paga otro: recibo una fila virtual (source='shared', account_id NULL, amount = mi parte) con MI categoría.
--  * Invariante: cada miembro con parte > 0 tiene exactamente una fila vinculada propia
--    (pagador: su fila bancaria si la vinculó, si no una virtual).
--  * Liquidación: shared_expense kind='settlement' (paid_by = deudor, shares {acreedor: importe});
--    la fila bancaria vinculada recibe metric_amount = 0. Sin filas virtuales.
--  * Privacidad: shared_expenses no guarda categoría, cuenta ni id de transacción.
--  * Todas las escrituras de tablas compartidas y de filas ajenas pasan por RPC SECURITY DEFINER.

-- 1. Tablas compartidas --------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) <= 60),
  kind text not null default 'group' check (kind in ('group', 'direct')),
  direct_key text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  check ((kind = 'direct') = (direct_key is not null)),
  check (kind = 'direct' or char_length(btrim(name)) >= 1)
);
create unique index groups_direct_key_key on public.groups (direct_key) where direct_key is not null;

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

create table public.shared_expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  kind text not null default 'expense' check (kind in ('expense', 'settlement')),
  title text not null check (char_length(title) <= 120),
  total_amount numeric(12, 2) not null check (total_amount > 0),
  date timestamptz not null,
  paid_by uuid not null references auth.users (id),
  split_mode text not null default 'equal' check (split_mode in ('equal', 'exact', 'percent', 'shares')),
  created_by uuid not null references auth.users (id),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index shared_expenses_group_date_idx on public.shared_expenses (group_id, date desc) where deleted_at is null;

create table public.shared_expense_shares (
  expense_id uuid not null references public.shared_expenses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(12, 2) not null check (amount >= 0),
  weight numeric,
  primary key (expense_id, user_id)
);
create index shared_expense_shares_user_idx on public.shared_expense_shares (user_id);

create table public.shared_expense_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  expense_id uuid references public.shared_expenses (id) on delete set null,
  actor_id uuid not null references auth.users (id),
  action text not null check (action in ('created', 'updated', 'deleted', 'settled', 'member_added', 'member_removed')),
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index shared_expense_events_group_idx on public.shared_expense_events (group_id, created_at desc);

-- 2. transactions: filas virtuales y vínculo con el gasto compartido --------------------------------
alter table public.transactions alter column account_id drop not null;
alter table public.transactions
  add column if not exists shared_expense_id uuid references public.shared_expenses (id) on delete set null,
  add column if not exists metric_amount numeric(12, 2);

alter table public.transactions
  add constraint transactions_metric_amount_check check (metric_amount is null or metric_amount >= 0),
  add constraint transactions_virtual_account_check check ((account_id is null) = (source = 'shared'));

create unique index if not exists transactions_shared_expense_user_key
  on public.transactions (shared_expense_id, user_id) where shared_expense_id is not null;

-- 3. Helpers (DEFINER: leen group_members saltando RLS, sin recursión de políticas) -----------------
create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = (select auth.uid())
  );
$$;

create or replace function public.shares_group_with(target uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = target
  );
$$;

create or replace function public.is_expense_member(p_expense_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.shared_expenses e
    join public.group_members gm on gm.group_id = e.group_id
    where e.id = p_expense_id and gm.user_id = (select auth.uid())
  );
$$;

-- Fase 2 + "comparte grupo".
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
    );
$$;

revoke all on function public.is_group_member(uuid) from public, anon;
revoke all on function public.shares_group_with(uuid) from public, anon;
revoke all on function public.is_expense_member(uuid) from public, anon;
revoke all on function public.can_see_profile(uuid) from public, anon;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.shares_group_with(uuid) to authenticated;
grant execute on function public.is_expense_member(uuid) to authenticated;
grant execute on function public.can_see_profile(uuid) to authenticated;

-- 4. RLS -----------------------------------------------------------------------------------
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.shared_expenses enable row level security;
alter table public.shared_expense_shares enable row level security;
alter table public.shared_expense_events enable row level security;

revoke insert, update, delete on public.groups, public.group_members, public.shared_expenses,
  public.shared_expense_shares, public.shared_expense_events from anon, authenticated;

create policy groups_select on public.groups for select to authenticated
  using (public.is_group_member(id));
create policy group_members_select on public.group_members for select to authenticated
  using (public.is_group_member(group_id));
create policy shared_expenses_select on public.shared_expenses for select to authenticated
  using (public.is_group_member(group_id));
create policy shared_expense_shares_select on public.shared_expense_shares for select to authenticated
  using (public.is_expense_member(expense_id));
create policy shared_expense_events_select on public.shared_expense_events for select to authenticated
  using (public.is_group_member(group_id));

-- transactions_own: las filas virtuales no tienen cuenta (y siempre cuelgan de un gasto compartido).
drop policy if exists transactions_own on public.transactions;
create policy transactions_own on public.transactions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      (account_id is null and source = 'shared' and shared_expense_id is not null)
      or exists (
        select 1 from public.accounts a
        where a.id = transactions.account_id and a.user_id = (select auth.uid())
      )
    )
    and (category_id is null or exists (
      select 1 from public.categories c
      where c.id = transactions.category_id
        and (c.user_id is null or c.user_id = (select auth.uid()))
    ))
    and (subcategory_id is null or exists (
      select 1 from public.categories c
      where c.id = transactions.subcategory_id
        and (c.user_id is null or c.user_id = (select auth.uid()))
    ))
  );

-- 5. RPCs ----------------------------------------------------------------------------------
-- Las RPC de saldo (adjust_account_balance, *_with_balance) filtran por account_id = ...: con
-- account_id NULL no encuentran cuenta y no hacen nada, así que las filas virtuales no mueven saldos.

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

  insert into public.groups (name, kind, created_by) values (btrim(p_name), 'group', me) returning * into g;
  insert into public.group_members (group_id, user_id) values (g.id, me);
  foreach m in array members loop
    insert into public.group_members (group_id, user_id) values (g.id, m);
  end loop;
  return g;
end;
$$;

create or replace function public.get_or_create_direct_group(p_friend_id uuid)
returns public.groups
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  g public.groups;
  v_key text;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if p_friend_id is null or p_friend_id = me then raise exception 'not_friends'; end if;
  if not public.are_friends(me, p_friend_id) then raise exception 'not_friends'; end if;

  v_key := least(me, p_friend_id)::text || ':' || greatest(me, p_friend_id)::text;
  select * into g from public.groups where direct_key = v_key;
  if not found then
    begin
      insert into public.groups (name, kind, direct_key, created_by) values ('', 'direct', v_key, me) returning * into g;
      insert into public.group_members (group_id, user_id) values (g.id, me), (g.id, p_friend_id);
    exception when unique_violation then
      select * into g from public.groups where direct_key = v_key;
    end;
  end if;
  return g;
end;
$$;

-- Saldo neto por miembro de un grupo (pagado - debido); las liquidaciones cuentan igual que gastos.
create or replace function public.group_balances(p_group_id uuid)
returns table (user_id uuid, net numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated'; end if;
  if not public.is_group_member(p_group_id) then raise exception 'not_a_member'; end if;
  return query
    with moves as (
      select e.paid_by as uid, e.total_amount as delta
      from public.shared_expenses e where e.group_id = p_group_id and e.deleted_at is null
      union all
      select s.user_id, -s.amount
      from public.shared_expense_shares s
      join public.shared_expenses e on e.id = s.expense_id
      where e.group_id = p_group_id and e.deleted_at is null
    ),
    people as (
      select gm.user_id as uid from public.group_members gm where gm.group_id = p_group_id
      union select m.uid from moves m
    )
    select p.uid, coalesce(sum(m.delta), 0)::numeric
    from people p left join moves m on m.uid = p.uid
    group by p.uid;
end;
$$;

-- Saldos de todos mis grupos (una sola llamada para el listado y los totales por amigo).
create or replace function public.my_group_balances()
returns table (group_id uuid, user_id uuid, net numeric)
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not_authenticated'; end if;
  return query
    with mine as (select gm.group_id as gid from public.group_members gm where gm.user_id = me),
    moves as (
      select e.group_id as gid, e.paid_by as uid, e.total_amount as delta
      from public.shared_expenses e where e.group_id in (select gid from mine) and e.deleted_at is null
      union all
      select e.group_id, s.user_id, -s.amount
      from public.shared_expense_shares s
      join public.shared_expenses e on e.id = s.expense_id
      where e.group_id in (select gid from mine) and e.deleted_at is null
    ),
    people as (
      select gm.group_id as gid, gm.user_id as uid from public.group_members gm where gm.group_id in (select gid from mine)
      union select m.gid, m.uid from moves m
    )
    select p.gid, p.uid, coalesce(sum(m.delta), 0)::numeric
    from people p left join moves m on m.gid = p.gid and m.uid = p.uid
    group by p.gid, p.uid;
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
  if g.kind = 'direct' then raise exception 'direct_group'; end if;
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
  g public.groups;
  v_net numeric;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select * into g from public.groups where id = p_group_id;
  if not found or not public.is_group_member(p_group_id) then raise exception 'group_not_found'; end if;
  if g.kind = 'direct' then raise exception 'direct_group'; end if;
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

-- Interna: deja las filas vinculadas de TODOS los miembros coherentes con el gasto.
--  1. Valida y vincula la fila bancaria del pagador (solo el propio pagador puede aportarla).
--  2. Desvincula filas bancarias que ya no corresponden (cambio de pagador, otra fila elegida).
--  3. Alta / cambio de importe / parte 0 de filas virtuales; metric_amount de la fila bancaria del pagador.
-- Nunca modifica el amount de una fila bancaria. Solo el actor recibe categoría.
create or replace function public._sync_expense_rows(
  p_expense_id uuid,
  p_actor uuid,
  p_payer_tx_id uuid,
  p_old_title text,
  p_category_id uuid,
  p_subcategory_id uuid
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  e public.shared_expenses;
  v_tx public.transactions;
  r public.transactions;
  u uuid;
  v_share numeric;
begin
  select * into e from public.shared_expenses where id = p_expense_id;

  if p_payer_tx_id is not null then
    select * into v_tx from public.transactions where id = p_payer_tx_id;
    if not found or v_tx.user_id <> p_actor or p_actor <> e.paid_by
       or v_tx.source = 'shared' or v_tx.account_id is null or v_tx.type <> 'expense' then
      raise exception 'invalid_payer_transaction';
    end if;
    if v_tx.shared_expense_id is not null and v_tx.shared_expense_id <> e.id then
      raise exception 'transaction_already_linked';
    end if;
  end if;

  -- Desvincular lo que ya no corresponde.
  for r in select * from public.transactions where shared_expense_id = e.id loop
    if r.source <> 'shared' and (
         r.user_id <> e.paid_by
         or (p_payer_tx_id is not null and r.id <> p_payer_tx_id)
       ) then
      update public.transactions set shared_expense_id = null, metric_amount = null where id = r.id;
    elsif r.source = 'shared' and r.user_id = e.paid_by and p_payer_tx_id is not null then
      delete from public.transactions where id = r.id;
    end if;
  end loop;

  if p_payer_tx_id is not null then
    update public.transactions set shared_expense_id = e.id where id = p_payer_tx_id;
  end if;

  for u in
    select s.user_id from public.shared_expense_shares s where s.expense_id = e.id and s.amount > 0
    union
    select t.user_id from public.transactions t where t.shared_expense_id = e.id
  loop
    select coalesce(
      (select s.amount from public.shared_expense_shares s where s.expense_id = e.id and s.user_id = u), 0
    ) into v_share;
    select * into r from public.transactions where shared_expense_id = e.id and user_id = u;

    if found and r.source <> 'shared' then
      update public.transactions set metric_amount = v_share where id = r.id;
    elsif found then
      if v_share > 0 then
        update public.transactions
        set amount = v_share,
            date = e.date,
            description = case when description is not distinct from p_old_title then e.title else description end,
            category_id = case when u = p_actor and p_category_id is not null then p_category_id else category_id end,
            subcategory_id = case when u = p_actor and p_category_id is not null then p_subcategory_id else subcategory_id end
        where id = r.id;
      else
        delete from public.transactions where id = r.id;
      end if;
    elsif v_share > 0 then
      insert into public.transactions (
        user_id, account_id, amount, type, date, description, category_id, subcategory_id, source, shared_expense_id
      ) values (
        u, null, v_share, 'expense', e.date, e.title,
        case when u = p_actor then p_category_id end,
        case when u = p_actor then p_subcategory_id end,
        'shared', e.id
      );
    end if;
  end loop;
end;
$$;

-- p_shares: [{"user_id": uuid, "amount": numeric, "weight": numeric|null}] ya calculado por la API
-- (la API recalcula con computeShares; aquí solo se valida que cuadre al céntimo).
create or replace function public.upsert_shared_expense(
  p_expense_id uuid,
  p_group_id uuid,
  p_title text,
  p_total numeric,
  p_date timestamptz,
  p_paid_by uuid,
  p_split_mode text,
  p_shares jsonb,
  p_payer_tx_id uuid default null,
  p_my_category_id uuid default null,
  p_my_subcategory_id uuid default null
) returns public.shared_expenses
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  e public.shared_expenses;
  v_group uuid;
  v_old_title text;
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
    v_old_title := e.title;
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

  if p_my_category_id is not null and not exists (
    select 1 from public.categories c where c.id = p_my_category_id and (c.user_id is null or c.user_id = me)
  ) then raise exception 'invalid_category'; end if;
  if p_my_subcategory_id is not null and not exists (
    select 1 from public.categories c where c.id = p_my_subcategory_id and (c.user_id is null or c.user_id = me)
  ) then raise exception 'invalid_category'; end if;

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

  perform public._sync_expense_rows(e.id, me, p_payer_tx_id, v_old_title, p_my_category_id, p_my_subcategory_id);

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
  delete from public.transactions where shared_expense_id = e.id and source = 'shared';
  update public.transactions set shared_expense_id = null, metric_amount = null where shared_expense_id = e.id;

  insert into public.shared_expense_events (group_id, expense_id, actor_id, action, summary)
  values (e.group_id, e.id, me, 'deleted', jsonb_build_object('title', e.title, 'total', e.total_amount, 'kind', e.kind));
  return true;
end;
$$;

-- El pagador vincula (o cambia) su fila bancaria: la virtual desaparece.
create or replace function public.link_payer_transaction(p_expense_id uuid, p_tx_id uuid)
returns public.shared_expenses
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
  if e.kind <> 'expense' then raise exception 'not_an_expense'; end if;
  if e.paid_by <> me then raise exception 'not_payer'; end if;
  perform public._sync_expense_rows(e.id, me, p_tx_id, e.title, null, null);
  return e;
end;
$$;

-- Desvincula una de MIS filas bancarias. Gasto: el pagador pasa a tener fila virtual (invariante).
-- Liquidación: la fila vuelve a ser una transacción normal. Las virtuales no se desvinculan.
create or replace function public.unlink_transaction(p_tx_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  t public.transactions;
  e public.shared_expenses;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select * into t from public.transactions where id = p_tx_id and user_id = me for update;
  if not found then raise exception 'transaction_not_found'; end if;
  if t.shared_expense_id is null then return false; end if;
  if t.source = 'shared' then raise exception 'shared_tx_managed'; end if;

  select * into e from public.shared_expenses where id = t.shared_expense_id;
  update public.transactions set shared_expense_id = null, metric_amount = null where id = t.id;
  if e.id is not null and e.deleted_at is null and e.kind = 'expense' then
    perform public._sync_expense_rows(e.id, me, null, e.title, null, null);
  end if;
  return true;
end;
$$;

-- Vincula MI lado de una liquidación (deudor: gasto; acreedor: ingreso) y la saca de mis métricas.
create or replace function public.link_settlement_transaction(p_expense_id uuid, p_tx_id uuid)
returns public.transactions
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  e public.shared_expenses;
  t public.transactions;
  v_creditor uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select * into e from public.shared_expenses where id = p_expense_id;
  if not found or e.deleted_at is not null or e.kind <> 'settlement' or not public.is_group_member(e.group_id) then
    raise exception 'expense_not_found';
  end if;
  select s.user_id into v_creditor from public.shared_expense_shares s where s.expense_id = e.id limit 1;
  if me <> e.paid_by and me <> v_creditor then raise exception 'invalid_settlement'; end if;

  select * into t from public.transactions where id = p_tx_id and user_id = me for update;
  if not found or t.source = 'shared' or t.account_id is null then raise exception 'invalid_transaction'; end if;
  if t.type <> case when me = e.paid_by then 'expense' else 'income' end then raise exception 'invalid_transaction'; end if;
  if t.shared_expense_id is not null and t.shared_expense_id <> e.id then raise exception 'transaction_already_linked'; end if;
  if exists (
    select 1 from public.transactions o where o.shared_expense_id = e.id and o.user_id = me and o.id <> t.id
  ) then raise exception 'settlement_already_linked'; end if;

  update public.transactions set shared_expense_id = e.id, metric_amount = 0 where id = t.id returning * into t;
  return t;
end;
$$;

-- Liquidación: p_from (deudor) paga p_to (acreedor). El que llama es uno de los dos. p_tx_id opcional
-- (mi gasto si pago, mi ingreso si cobro): sale de las métricas.
create or replace function public.record_settlement(
  p_group_id uuid,
  p_from uuid,
  p_to uuid,
  p_amount numeric,
  p_date timestamptz,
  p_tx_id uuid default null
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

  if p_tx_id is not null then
    perform public.link_settlement_transaction(e.id, p_tx_id);
  end if;

  insert into public.shared_expense_events (group_id, expense_id, actor_id, action, summary)
  values (p_group_id, e.id, me, 'settled', jsonb_build_object('from', p_from, 'to', p_to, 'total', p_amount));
  return e;
end;
$$;

-- Renombrar / archivar un grupo (cualquier miembro; los grupos 1 a 1 no se tocan).
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
  if g.kind = 'direct' then raise exception 'direct_group'; end if;
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

do $$
declare
  f text;
begin
  foreach f in array array[
    'update_group(uuid, text, boolean)',
    'create_group(text, uuid[])',
    'get_or_create_direct_group(uuid)',
    'group_balances(uuid)',
    'my_group_balances()',
    'add_group_member(uuid, uuid)',
    'remove_group_member(uuid, uuid)',
    'upsert_shared_expense(uuid, uuid, text, numeric, timestamptz, uuid, text, jsonb, uuid, uuid, uuid)',
    'delete_shared_expense(uuid)',
    'link_payer_transaction(uuid, uuid)',
    'unlink_transaction(uuid)',
    'record_settlement(uuid, uuid, uuid, numeric, timestamptz, uuid)',
    'link_settlement_transaction(uuid, uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
-- Interna: nadie la llama directamente.
revoke all on function public._sync_expense_rows(uuid, uuid, uuid, text, uuid, uuid) from public, anon, authenticated;

-- 6. Verificación manual de RLS (dos usuarios A y B amigos; C ajeno; sustituir los UUID) ----------------
-- begin;
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<A-uuid>","role":"authenticated"}', true);
--   select * from public.get_or_create_direct_group('<B-uuid>');              -- guarda <group-id>
--   -- A paga 40, a partes iguales, con su fila bancaria <A-tx> (gasto de 40):
--   select * from public.upsert_shared_expense(null, '<group-id>', 'Cena', 40, now(), '<A-uuid>', 'equal',
--     '[{"user_id":"<A-uuid>","amount":20},{"user_id":"<B-uuid>","amount":20}]', '<A-tx>', null, null);
--   select amount, metric_amount, shared_expense_id from public.transactions where id = '<A-tx>';  -- 40 / 20 / E
--   select * from public.group_balances('<group-id>');                         -- A +20, B -20
--   select set_config('request.jwt.claims', '{"sub":"<B-uuid>","role":"authenticated"}', true);
--   select source, account_id, amount from public.transactions where shared_expense_id is not null;  -- 1 virtual de 20, solo la suya
--   select public.can_see_profile('<A-uuid>');                                  -- true (amigos/grupo)
--   -- B edita a 3 partes (upsert con p_expense_id = E): el amount bancario de A no cambia, solo su metric_amount.
--   -- B liquida:
--   select * from public.record_settlement('<group-id>', '<B-uuid>', '<A-uuid>', 20, now(), null);
--   select * from public.group_balances('<group-id>');                         -- todo 0
--   -- directo a tablas: debe fallar (permission denied)
--   -- insert into public.groups (name, created_by) values ('x', '<B-uuid>');
--   -- insert into public.transactions (user_id, amount, type, date, source) values ('<B-uuid>', 1, 'expense', now(), 'shared'); -- falla (RLS/check)
--   select set_config('request.jwt.claims', '{"sub":"<C-uuid>","role":"authenticated"}', true);
--   select count(*) from public.groups;                                         -- 0
--   select count(*) from public.shared_expenses;                                -- 0
--   select count(*) from public.profiles where user_id in ('<A-uuid>','<B-uuid>'); -- 0
--   -- debe fallar (group_not_found): select public.upsert_shared_expense(null, '<group-id>', 'x', 1, now(), '<C-uuid>', 'equal', '[{"user_id":"<C-uuid>","amount":1}]', null, null, null);
-- rollback;
