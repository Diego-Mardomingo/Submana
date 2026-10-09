-- Notificaciones: bandeja + web push (ver plan.md).
--  * notifications: una fila por aviso y destinatario. Solo el service role inserta (lo hace notify() desde
--    las rutas de la API); el usuario lee, borra y marca como leído (único campo que puede actualizar).
--  * notification_settings: preferencias de avisos. Vive APARTE de profiles a propósito: profiles es visible
--    para amigos y miembros de grupo (can_see_profile) y estos ajustes son privados.
--  * notification_mutes: grupos de Subcount y cuentas conjuntas silenciados por el usuario.
--  * push_subscriptions: un endpoint de web push por dispositivo y navegador. Quien envía usa el service role.
--  * subscriptions.reminder_offsets: días antes de la renovación en los que avisar (0, 1, 3, 7; vacío = sin avisos).
--  * accounts.last_imported_at: última importación de extracto, para el recordatorio mensual de importar.

-- 1. notifications -------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  actor_id uuid references auth.users (id) on delete set null,
  entity_type text,
  entity_id uuid,
  -- Copia de nombres, importes y fechas para redactar el texto al mostrarlo (el elemento puede haberse borrado).
  params jsonb not null default '{}'::jsonb,
  url text,
  -- Evita duplicados (p. ej. que el cron corra dos veces). NULL = sin deduplicar.
  dedupe_key text,
  -- Agrupa avisos parecidos (p. ej. movimientos de una misma persona en una cuenta conjunta).
  aggregate_key text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id, dedupe_key)
);

create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications (user_id) where read_at is null;
create index if not exists notifications_aggregate_idx
  on public.notifications (user_id, type, aggregate_key, created_at desc) where aggregate_key is not null;

alter table public.notifications enable row level security;

-- Solo lectura, borrado y read_at: nada de insert (service role) ni de editar el resto de columnas.
revoke all on public.notifications from anon;
revoke insert, update on public.notifications from authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

drop policy if exists notifications_select_own on public.notifications;
drop policy if exists notifications_update_own on public.notifications;
drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_select_own on public.notifications for select to authenticated
  using ((select auth.uid()) = user_id);
create policy notifications_update_own on public.notifications for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy notifications_delete_own on public.notifications for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 2. notification_settings -----------------------------------------------------------------
create table if not exists public.notification_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Idioma para redactar el push fuera de una petición; la app lo sincroniza al cambiarlo.
  lang text not null default 'es' check (lang in ('es', 'en')),
  -- Solo los tipos que el usuario apaga: un tipo nuevo nace con su valor por defecto.
  disabled_types text[] not null default '{}',
  -- Avisos de renovación por defecto de las suscripciones nuevas (días antes).
  default_renewal_offsets smallint[] not null default '{1}' check (default_renewal_offsets <@ '{0,1,3,7}'::smallint[]),
  summary_day smallint not null default 4 check (summary_day between 1 and 28),
  push_hide_amounts boolean not null default false,
  -- Modelo «visto»: la última vez que abrió la bandeja (apaga la campanita).
  last_seen_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;
revoke all on public.notification_settings from anon;

drop policy if exists notification_settings_select_own on public.notification_settings;
drop policy if exists notification_settings_insert_own on public.notification_settings;
drop policy if exists notification_settings_update_own on public.notification_settings;
create policy notification_settings_select_own on public.notification_settings for select to authenticated
  using ((select auth.uid()) = user_id);
create policy notification_settings_insert_own on public.notification_settings for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy notification_settings_update_own on public.notification_settings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 3. notification_mutes --------------------------------------------------------------------
create table if not exists public.notification_mutes (
  user_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('group', 'account')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

alter table public.notification_mutes enable row level security;
revoke all on public.notification_mutes from anon;

drop policy if exists notification_mutes_select_own on public.notification_mutes;
drop policy if exists notification_mutes_insert_own on public.notification_mutes;
drop policy if exists notification_mutes_delete_own on public.notification_mutes;
create policy notification_mutes_select_own on public.notification_mutes for select to authenticated
  using ((select auth.uid()) = user_id);
create policy notification_mutes_insert_own on public.notification_mutes for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy notification_mutes_delete_own on public.notification_mutes for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 4. push_subscriptions --------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon;

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy push_subscriptions_insert_own on public.push_subscriptions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy push_subscriptions_delete_own on public.push_subscriptions for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 5. Columnas nuevas en tablas existentes --------------------------------------------------
alter table public.subscriptions
  add column if not exists reminder_offsets smallint[] not null default '{1}'
  check (reminder_offsets <@ '{0,1,3,7}'::smallint[]);

alter table public.accounts add column if not exists last_imported_at timestamptz;

-- 6. Realtime: el contador y la lista se refrescan en vivo (cada suscriptor solo recibe lo que su RLS le deja leer).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
