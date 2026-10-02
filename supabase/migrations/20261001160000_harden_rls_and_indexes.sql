-- Endurece RLS y añade índices.
-- * Todas las políticas usan (select auth.uid()) (se evalúa una vez por consulta) y TO authenticated.
-- * WITH CHECK en todas las escrituras: antes api_tokens permitía UPDATE de user_id, con lo que un
--   usuario podía reasignar su token a otro y crear gastos en cuentas ajenas vía automatización.
-- * Las filas solo pueden referenciar cuentas propias y categorías propias o del sistema
--   (la API se puede llamar directamente vía PostgREST con la sesión del usuario).

-- accounts -------------------------------------------------------------------
drop policy if exists "Users can manage own accounts" on public.accounts;
create policy accounts_own on public.accounts for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- api_tokens -----------------------------------------------------------------
drop policy if exists api_tokens_select_own on public.api_tokens;
drop policy if exists api_tokens_insert_own on public.api_tokens;
drop policy if exists api_tokens_update_own on public.api_tokens;
drop policy if exists api_tokens_delete_own on public.api_tokens;
create policy api_tokens_select_own on public.api_tokens for select to authenticated
  using ((select auth.uid()) = user_id);
create policy api_tokens_insert_own on public.api_tokens for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy api_tokens_update_own on public.api_tokens for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy api_tokens_delete_own on public.api_tokens for delete to authenticated
  using ((select auth.uid()) = user_id);

-- automation_notifications (solo el servidor inserta, con service role) -------
drop policy if exists automation_notifications_select_own on public.automation_notifications;
drop policy if exists automation_notifications_insert_own on public.automation_notifications;
create policy automation_notifications_select_own on public.automation_notifications for select to authenticated
  using ((select auth.uid()) = user_id);

-- budgets --------------------------------------------------------------------
drop policy if exists "Users can manage own budgets" on public.budgets;
create policy budgets_own on public.budgets for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- budget_categories ----------------------------------------------------------
drop policy if exists "Users can manage budget_categories for own budgets" on public.budget_categories;
create policy budget_categories_own on public.budget_categories for all to authenticated
  using (exists (
    select 1 from public.budgets b
    where b.id = budget_categories.budget_id and b.user_id = (select auth.uid())
  ))
  with check (
    exists (
      select 1 from public.budgets b
      where b.id = budget_categories.budget_id and b.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.categories c
      where c.id = budget_categories.category_id
        and (c.user_id is null or c.user_id = (select auth.uid()))
    )
  );

-- categories -----------------------------------------------------------------
drop policy if exists "Users can read own and system categories" on public.categories;
drop policy if exists "Users can insert update delete own categories" on public.categories;
drop policy if exists "Users can update own categories" on public.categories;
drop policy if exists "Users can delete own categories" on public.categories;
create policy categories_select on public.categories for select to authenticated
  using (user_id is null or (select auth.uid()) = user_id);
create policy categories_insert_own on public.categories for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (parent_id is null or exists (
      select 1 from public.categories p
      where p.id = categories.parent_id
        and (p.user_id is null or p.user_id = (select auth.uid()))
    ))
  );
create policy categories_update_own on public.categories for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (parent_id is null or exists (
      select 1 from public.categories p
      where p.id = categories.parent_id
        and (p.user_id is null or p.user_id = (select auth.uid()))
    ))
  );
create policy categories_delete_own on public.categories for delete to authenticated
  using ((select auth.uid()) = user_id);

-- feedback -------------------------------------------------------------------
drop policy if exists "Users can insert own feedback" on public.feedback;
drop policy if exists "Users can read own feedback" on public.feedback;
create policy feedback_insert_own on public.feedback for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy feedback_select_own on public.feedback for select to authenticated
  using ((select auth.uid()) = user_id);

-- import_duplicate_decisions -------------------------------------------------
drop policy if exists import_duplicate_decisions_select_own on public.import_duplicate_decisions;
drop policy if exists import_duplicate_decisions_insert_own on public.import_duplicate_decisions;
drop policy if exists import_duplicate_decisions_update_own on public.import_duplicate_decisions;
drop policy if exists import_duplicate_decisions_delete_own on public.import_duplicate_decisions;
create policy import_duplicate_decisions_own on public.import_duplicate_decisions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.accounts a
      where a.id = import_duplicate_decisions.account_id and a.user_id = (select auth.uid())
    )
  );

-- subscriptions --------------------------------------------------------------
drop policy if exists "Users can manage own subscriptions" on public.subscriptions;
create policy subscriptions_own on public.subscriptions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (account_id is null or exists (
      select 1 from public.accounts a
      where a.id = subscriptions.account_id and a.user_id = (select auth.uid())
    ))
  );

-- transactions ---------------------------------------------------------------
drop policy if exists "Users can manage own transactions" on public.transactions;
create policy transactions_own on public.transactions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.accounts a
      where a.id = transactions.account_id and a.user_id = (select auth.uid())
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

-- user_archived_categories (solo se archivan categorías del sistema) ----------
drop policy if exists "Users can manage own archived categories" on public.user_archived_categories;
create policy user_archived_categories_own on public.user_archived_categories for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.categories c
      where c.id = user_archived_categories.category_id and c.user_id is null
    )
  );

-- Restricciones de datos (ya validadas en la API; aquí también para accesos directos) ----
alter table public.transactions
  add constraint transactions_amount_positive check (amount > 0);
alter table public.subscriptions
  add constraint subscriptions_frequency_check check (frequency in ('weekly', 'monthly', 'yearly')),
  add constraint subscriptions_frequency_value_check check (frequency_value is null or frequency_value >= 1),
  add constraint subscriptions_cost_check check (cost >= 0);

-- rls_auto_enable es un event trigger: no debe ser invocable vía /rest/v1/rpc ------------
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Índices --------------------------------------------------------------------
-- Consultas principales: transacciones de un usuario por rango de fechas.
create index if not exists idx_transactions_user_date on public.transactions (user_id, date desc);
drop index if exists public.idx_transactions_user_id; -- cubierto por idx_transactions_user_date
-- Claves foráneas sin índice (borrados en cascada / SET NULL y joins).
create index if not exists idx_transactions_category_id on public.transactions (category_id) where category_id is not null;
create index if not exists idx_transactions_subcategory_id on public.transactions (subcategory_id) where subcategory_id is not null;
create index if not exists idx_subscriptions_account_id on public.subscriptions (account_id) where account_id is not null;
create index if not exists idx_categories_parent_id on public.categories (parent_id) where parent_id is not null;
create index if not exists idx_user_archived_categories_category_id on public.user_archived_categories (category_id);
create index if not exists idx_automation_notifications_account_id on public.automation_notifications (account_id) where account_id is not null;
create index if not exists idx_automation_notifications_transaction_id on public.automation_notifications (transaction_id) where transaction_id is not null;
create index if not exists idx_feedback_user_id on public.feedback (user_id);
-- Redundantes con índices compuestos/únicos existentes.
drop index if exists public.idx_accounts_user_id;              -- idx_accounts_user_display_order
drop index if exists public.idx_budgets_user_id;               -- idx_budgets_user_display_order
drop index if exists public.idx_budget_categories_budget_id;   -- budget_categories_budget_id_category_id_key
drop index if exists public.transactions_import_line_id_lookup; -- transactions_account_import_line_id_unique
