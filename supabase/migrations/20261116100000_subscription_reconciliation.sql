-- Conciliación de suscripciones con transacciones (issue #108, fase 1).
--  * transactions.subscription_id + subscription_charge_date: esta transacción es el cobro de la
--    suscripción previsto para ese día (un cargo que llega tarde sigue cubriendo su fecha prevista).
--    Un cobro previsto lo cubre como mucho una transacción.
--  * subscriptions.match_pattern: texto del banco aprendido al enlazar, para reconocer los siguientes.
--  * subscriptions.skipped_charges: cobros previstos que el usuario marcó como "No se cobró".
--  * subscriptions.dismissed_price_charge: cobro cuyo cambio de importe el usuario ignoró.
--  * subscription_price_history: tramos de precio. Lo mantiene un trigger al crear la suscripción y al
--    cambiar su coste; aceptar un precio detectado abre el tramo en la fecha del cobro.
-- Solo añade objetos: no rompe la versión desplegada.

-- 1. transactions ----------------------------------------------------------------------------
alter table public.transactions
  add column if not exists subscription_id uuid,
  add column if not exists subscription_charge_date date;

alter table public.transactions drop constraint if exists transactions_subscription_id_fkey;
alter table public.transactions
  add constraint transactions_subscription_id_fkey foreign key (subscription_id)
    references public.subscriptions (id) on delete set null;

alter table public.transactions drop constraint if exists transactions_subscription_charge_check;
alter table public.transactions
  add constraint transactions_subscription_charge_check check ((subscription_id is null) = (subscription_charge_date is null));

create unique index if not exists transactions_subscription_charge_key
  on public.transactions (subscription_id, subscription_charge_date) where subscription_id is not null;

-- Sin suscripción no hay fecha de cobro (también cuando se borra la suscripción: el ON DELETE SET NULL
-- pasa por aquí). Solo el dueño de la suscripción enlaza a ella (en una cuenta conjunta, otro miembro puede
-- seguir editando la fila enlazada: solo se comprueba cuando cambia el enlace). Sin sesión (service role) no aplica.
create or replace function public.transactions_guard_subscription()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.subscription_id is null then
    new.subscription_charge_date := null;
    return new;
  end if;
  if (tg_op = 'INSERT'
          or new.subscription_id is distinct from old.subscription_id
          or new.subscription_charge_date is distinct from old.subscription_charge_date)
     and (select auth.uid()) is not null
     and not exists (
       select 1 from public.subscriptions s
       where s.id = new.subscription_id and s.user_id = (select auth.uid())
     ) then
    raise exception 'subscription_not_found' using errcode = 'P0002';
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_guard_subscription on public.transactions;
create trigger transactions_guard_subscription
  before insert or update of subscription_id, subscription_charge_date on public.transactions
  for each row execute function public.transactions_guard_subscription();

-- 2. subscriptions ---------------------------------------------------------------------------
alter table public.subscriptions
  add column if not exists match_pattern text,
  add column if not exists skipped_charges date[] not null default '{}',
  add column if not exists dismissed_price_charge date;

alter table public.subscriptions drop constraint if exists subscriptions_match_pattern_check;
alter table public.subscriptions
  add constraint subscriptions_match_pattern_check check (match_pattern is null or char_length(match_pattern) <= 200);

-- 3. subscription_price_history --------------------------------------------------------------
create table if not exists public.subscription_price_history (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  cost numeric not null check (cost >= 0),
  valid_from date not null,
  source text not null default 'manual' check (source in ('manual', 'detected')),
  created_at timestamptz not null default now(),
  unique (subscription_id, valid_from)
);

create index if not exists subscription_price_history_user_idx on public.subscription_price_history (user_id);

alter table public.subscription_price_history enable row level security;

drop policy if exists subscription_price_history_own on public.subscription_price_history;
create policy subscription_price_history_own on public.subscription_price_history for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.subscriptions s
      where s.id = subscription_price_history.subscription_id and s.user_id = (select auth.uid())
    )
  );

-- Alta: primer tramo con el coste y la fecha de inicio. Cambio de coste: tramo nuevo desde hoy (en
-- Madrid, o desde el inicio si aún no ha empezado), salvo que el tramo vigente ya tenga ese coste (aceptar
-- un precio detectado inserta antes su propio tramo).
create or replace function public.subscriptions_track_price()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from date;
  v_current numeric;
begin
  if tg_op = 'INSERT' then
    insert into public.subscription_price_history (subscription_id, user_id, cost, valid_from)
    values (new.id, new.user_id, new.cost, new.start_date)
    on conflict (subscription_id, valid_from) do nothing;
    return new;
  end if;

  if new.cost is distinct from old.cost then
    v_from := greatest((now() at time zone 'Europe/Madrid')::date, new.start_date);
    select h.cost into v_current
    from public.subscription_price_history h
    where h.subscription_id = new.id and h.valid_from <= v_from
    order by h.valid_from desc
    limit 1;
    if v_current is distinct from new.cost then
      insert into public.subscription_price_history (subscription_id, user_id, cost, valid_from)
      values (new.id, new.user_id, new.cost, v_from)
      on conflict (subscription_id, valid_from) do update set cost = excluded.cost, source = 'manual';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.subscriptions_track_price() from public, anon, authenticated;

drop trigger if exists subscriptions_track_price on public.subscriptions;
create trigger subscriptions_track_price
  after insert or update of cost on public.subscriptions
  for each row execute function public.subscriptions_track_price();

-- Tramo inicial de las suscripciones que ya existen.
insert into public.subscription_price_history (subscription_id, user_id, cost, valid_from)
select s.id, s.user_id, s.cost, s.start_date
from public.subscriptions s
on conflict (subscription_id, valid_from) do nothing;
