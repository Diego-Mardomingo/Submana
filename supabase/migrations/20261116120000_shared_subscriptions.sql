-- Suscripciones compartidas con un grupo de Subcount (issue #108, fase 4).
--  * subscriptions.shared_group_id + shared_split: la suscripción se reparte en ese grupo. shared_split es
--    {"mode": equal|exact|percent|shares, "participants": [{"user_id", "value"?}]} (como un gasto de
--    Subcount; exact en euros). shared_from: desde qué día se comparte (solo los cobros desde entonces
--    crean gasto; así enlazar cobros antiguos no llena el grupo).
--  * shared_expenses.subscription_id + subscription_charge_date: el gasto del grupo que creó ese cobro.
--    Únicos juntos entre los no borrados, para no crearlo dos veces. Sin suscripción (borrada) la fecha
--    se queda: el gasto sigue marcado como de una suscripción. subscription_icon: el logo, para que los
--    demás miembros (que no ven la suscripción) lo vean en el grupo.
--  * add_subscription_charge_expense: crea el gasto de un cobro (pagado por el dueño). Lo llaman la API
--    con la sesión del dueño y los procesos del servidor (sync del banco, cron) con service role.
-- Solo añade objetos: no rompe la versión desplegada.

-- 1. subscriptions ---------------------------------------------------------------------------
alter table public.subscriptions
  add column if not exists shared_group_id uuid,
  add column if not exists shared_split jsonb,
  add column if not exists shared_from date;

alter table public.subscriptions drop constraint if exists subscriptions_shared_group_id_fkey;
alter table public.subscriptions
  add constraint subscriptions_shared_group_id_fkey foreign key (shared_group_id)
    references public.groups (id) on delete set null;

alter table public.subscriptions drop constraint if exists subscriptions_shared_split_check;
alter table public.subscriptions
  add constraint subscriptions_shared_split_check check (
    shared_split is null
    or (jsonb_typeof(shared_split) = 'object'
        and shared_split->>'mode' in ('equal', 'exact', 'percent', 'shares')
        and jsonb_typeof(shared_split->'participants') = 'array'
        and jsonb_array_length(shared_split->'participants') between 1 and 31)
  );

create index if not exists subscriptions_shared_group_idx on public.subscriptions (shared_group_id) where shared_group_id is not null;

-- Solo se comparte en un grupo (activo) del que el dueño es miembro. Al empezar a compartir (o cambiar de
-- grupo) shared_from pasa a hoy en Madrid; al dejar de compartir se limpia.
create or replace function public.subscriptions_guard_shared_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.shared_group_id is null then
    new.shared_from := null;
    return new;
  end if;
  if tg_op = 'INSERT' or new.shared_group_id is distinct from old.shared_group_id then
    if not exists (
      select 1 from public.group_members gm
      join public.groups g on g.id = gm.group_id
      where gm.group_id = new.shared_group_id and gm.user_id = new.user_id and g.archived_at is null
    ) then
      raise exception 'group_not_found' using errcode = 'P0002';
    end if;
    new.shared_from := (now() at time zone 'Europe/Madrid')::date;
  elsif new.shared_from is distinct from old.shared_from then
    new.shared_from := old.shared_from;
  end if;
  if new.shared_split is null then
    raise exception 'invalid_shares' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.subscriptions_guard_shared_group() from public, anon, authenticated;

drop trigger if exists subscriptions_guard_shared_group on public.subscriptions;
create trigger subscriptions_guard_shared_group
  before insert or update of shared_group_id, shared_split, shared_from on public.subscriptions
  for each row execute function public.subscriptions_guard_shared_group();

-- 2. shared_expenses -------------------------------------------------------------------------
alter table public.shared_expenses
  add column if not exists subscription_id uuid,
  add column if not exists subscription_charge_date date,
  add column if not exists subscription_icon text;

alter table public.shared_expenses drop constraint if exists shared_expenses_subscription_id_fkey;
alter table public.shared_expenses
  add constraint shared_expenses_subscription_id_fkey foreign key (subscription_id)
    references public.subscriptions (id) on delete set null;

create unique index if not exists shared_expenses_subscription_charge_key
  on public.shared_expenses (subscription_id, subscription_charge_date)
  where subscription_id is not null and deleted_at is null;

-- 3. El gasto de un cobro --------------------------------------------------------------------
-- p_shares: [{"user_id", "amount", "weight"}] ya calculado por la API con computeShares (aquí se valida
-- que cuadre al céntimo y que todos sean miembros). Devuelve el gasto creado, o null si ese cobro ya
-- tenía uno (o la suscripción no se comparte / el cobro es anterior a shared_from).
create or replace function public.add_subscription_charge_expense(
  p_subscription_id uuid,
  p_charge_date date,
  p_total numeric,
  p_date timestamptz,
  p_shares jsonb
) returns public.shared_expenses
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  s public.subscriptions;
  e public.shared_expenses;
  v_sum bigint;
  v_count int;
  v_distinct int;
begin
  select * into s from public.subscriptions where id = p_subscription_id for update;
  if not found or (me is not null and s.user_id <> me) then raise exception 'subscription_not_found'; end if;
  if s.shared_group_id is null or s.shared_from is null or p_charge_date < s.shared_from then return null; end if;
  if not exists (
    select 1 from public.group_members gm join public.groups g on g.id = gm.group_id
    where gm.group_id = s.shared_group_id and gm.user_id = s.user_id and g.archived_at is null
  ) then
    return null;
  end if;
  if exists (
    select 1 from public.shared_expenses x
    where x.subscription_id = s.id and x.subscription_charge_date = p_charge_date and x.deleted_at is null
  ) then
    return null;
  end if;

  if p_total is null or p_total <= 0 or p_total <> round(p_total, 2) then raise exception 'invalid_total'; end if;
  if p_shares is null or jsonb_typeof(p_shares) <> 'array' or jsonb_array_length(p_shares) = 0 then
    raise exception 'invalid_shares';
  end if;
  select count(*), count(distinct x.user_id), coalesce(sum(round(x.amount * 100)), 0)
  into v_count, v_distinct, v_sum
  from jsonb_to_recordset(p_shares) as x(user_id uuid, amount numeric, weight numeric);
  if v_count <> v_distinct or v_sum <> round(p_total * 100) then raise exception 'invalid_shares'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_shares) as x(user_id uuid, amount numeric, weight numeric)
    where x.user_id is null or x.amount is null or x.amount < 0 or x.amount <> round(x.amount, 2)
       or not exists (select 1 from public.group_members gm where gm.group_id = s.shared_group_id and gm.user_id = x.user_id)
  ) then
    raise exception 'invalid_shares';
  end if;

  insert into public.shared_expenses (
    group_id, kind, title, total_amount, date, paid_by, split_mode, created_by, updated_by, subscription_id, subscription_charge_date, subscription_icon
  ) values (
    s.shared_group_id, 'expense', left(btrim(s.service_name), 120), p_total, p_date, s.user_id,
    coalesce(s.shared_split->>'mode', 'equal'), s.user_id, s.user_id, s.id, p_charge_date,
    case when char_length(s.icon) <= 2048 then s.icon end
  )
  on conflict (subscription_id, subscription_charge_date) where subscription_id is not null and deleted_at is null do nothing
  returning * into e;
  if e.id is null then return null; end if;

  insert into public.shared_expense_shares (expense_id, user_id, amount, weight)
  select e.id, x.user_id, x.amount, x.weight
  from jsonb_to_recordset(p_shares) as x(user_id uuid, amount numeric, weight numeric);

  insert into public.shared_expense_events (group_id, expense_id, actor_id, action, summary)
  values (e.group_id, e.id, s.user_id, 'created', jsonb_build_object('title', e.title, 'total', e.total_amount, 'paid_by', e.paid_by, 'subscription', true));
  return e;
end;
$$;

revoke execute on function public.add_subscription_charge_expense(uuid, date, numeric, timestamptz, jsonb) from public, anon;
grant execute on function public.add_subscription_charge_expense(uuid, date, numeric, timestamptz, jsonb) to authenticated, service_role;
