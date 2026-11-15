-- Conciliación automática de suscripciones (issue #108, fase 2).
--  * transactions.subscription_review_id + subscription_review_date: esta transacción quizá sea el cobro
--    de esa fecha de la suscripción; el usuario lo confirma (pasa a subscription_id) o lo descarta.
--  * transactions.subscription_dismissed_ids: suscripciones de las que el usuario dijo que esta
--    transacción no es un cobro (al descartar o al desenlazar); la conciliación no vuelve a proponerlas.
--  * subscriptions.auto_reconciled_at: cuándo se buscaron sus cobros entre las transacciones existentes.
--  * resolve_bank_review: al fundir la fila del banco en la manual, el enlace con la suscripción pasa a
--    la manual si esta no tenía uno.
-- Solo añade objetos: no rompe la versión desplegada.

-- 1. transactions ----------------------------------------------------------------------------
alter table public.transactions
  add column if not exists subscription_review_id uuid,
  add column if not exists subscription_review_date date,
  add column if not exists subscription_dismissed_ids uuid[] not null default '{}';

alter table public.transactions drop constraint if exists transactions_subscription_review_id_fkey;
alter table public.transactions
  add constraint transactions_subscription_review_id_fkey foreign key (subscription_review_id)
    references public.subscriptions (id) on delete set null;

alter table public.transactions drop constraint if exists transactions_subscription_review_check;
alter table public.transactions
  add constraint transactions_subscription_review_check check ((subscription_review_id is null) = (subscription_review_date is null));

create index if not exists transactions_subscription_review_idx
  on public.transactions (subscription_review_id) where subscription_review_id is not null;

-- Same rules as the link: no date without a subscription (also on delete), only the owner points at it.
create or replace function public.transactions_guard_subscription_review()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.subscription_review_id is null then
    new.subscription_review_date := null;
    return new;
  end if;
  if (tg_op = 'INSERT'
          or new.subscription_review_id is distinct from old.subscription_review_id
          or new.subscription_review_date is distinct from old.subscription_review_date)
     and (select auth.uid()) is not null
     and not exists (
       select 1 from public.subscriptions s
       where s.id = new.subscription_review_id and s.user_id = (select auth.uid())
     ) then
    raise exception 'subscription_not_found' using errcode = 'P0002';
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_guard_subscription_review on public.transactions;
create trigger transactions_guard_subscription_review
  before insert or update of subscription_review_id, subscription_review_date on public.transactions
  for each row execute function public.transactions_guard_subscription_review();

-- 2. subscriptions ---------------------------------------------------------------------------
alter table public.subscriptions
  add column if not exists auto_reconciled_at timestamptz;

-- 3. resolve_bank_review: the subscription link survives the merge -----------------------------
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

  -- Primero se borra la del banco: (account_id, import_line_id) y (subscription_id, fecha de cobro) son únicos.
  delete from public.transactions where id = v_bank.id;

  update public.transactions
  set import_line_id = v_bank.import_line_id,
      external_hash = v_bank.external_hash,
      statement_balance = v_bank.statement_balance,
      booked_at = v_bank.booked_at,
      bank_description = v_bank.bank_description,
      subscription_id = coalesce(v_manual.subscription_id, v_bank.subscription_id),
      subscription_charge_date = case when v_manual.subscription_id is null then v_bank.subscription_charge_date else v_manual.subscription_charge_date end,
      subscription_review_id = case
        when v_manual.subscription_id is not null or v_bank.subscription_id is not null then null
        else coalesce(v_manual.subscription_review_id, v_bank.subscription_review_id) end,
      subscription_review_date = case
        when v_manual.subscription_id is not null or v_bank.subscription_id is not null then null
        when v_manual.subscription_review_id is not null then v_manual.subscription_review_date
        else v_bank.subscription_review_date end
  where id = v_manual.id
  returning * into v_manual;

  return v_manual;
end;
$$;

revoke execute on function public.resolve_bank_review(uuid, boolean) from public, anon, authenticated;
grant execute on function public.resolve_bank_review(uuid, boolean) to service_role;
