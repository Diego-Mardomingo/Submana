-- Fase 2: perfiles públicos (@handle) y amistades.
-- * profiles: identidad visible para otros usuarios (handle único, nombre, avatar).
-- * friendships: solicitud (pending) -> amistad (accepted). Las altas y respuestas pasan por RPC
--   SECURITY DEFINER; no hay INSERT/UPDATE directo.
-- * can_see_profile() es el único punto que decide quién ve un perfil; la fase 3 añadirá
--   "comparte grupo" aquí sin tocar las políticas.

-- profiles -------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  handle text not null check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_handle_lower_key on public.profiles (lower(handle));

-- friendships ----------------------------------------------------------------
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);
create unique index friendships_pair_key
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_requester_idx on public.friendships (requester_id);
create index friendships_addressee_idx on public.friendships (addressee_id);

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;

-- Helpers (SECURITY DEFINER: leen friendships saltando RLS, sin recursión de políticas) ---
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b) or (f.requester_id = b and f.addressee_id = a))
  );
$$;

-- Uno mismo, amigos y cualquiera con solicitud pendiente (en ambos sentidos).
-- Fase 3: añadir aquí "or public.shares_group_with(target)".
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
    );
$$;

revoke all on function public.are_friends(uuid, uuid) from public, anon;
revoke all on function public.can_see_profile(uuid) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.can_see_profile(uuid) to authenticated;

-- RLS ------------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (public.can_see_profile(user_id));
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy profiles_update_own on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy friendships_select on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));
create policy friendships_delete on public.friendships for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

-- RPCs -----------------------------------------------------------------------
-- Búsqueda exacta (sin LIKE ni listados): evita enumerar usuarios.
create or replace function public.find_profile_by_handle(p_handle text)
returns table (user_id uuid, handle text, display_name text, avatar_url text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;
  return query
    select p.user_id, p.handle, p.display_name, p.avatar_url
    from public.profiles p
    where lower(p.handle) = lower(btrim(p_handle));
end;
$$;

create or replace function public.handle_available(p_handle text)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;
  return not exists (
    select 1 from public.profiles p
    where lower(p.handle) = lower(btrim(p_handle))
      and p.user_id <> (select auth.uid())
  );
end;
$$;

create or replace function public.send_friend_request(p_handle text)
returns public.friendships
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  target uuid;
  existing public.friendships;
begin
  if me is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.profiles where user_id = me) then
    raise exception 'profile_required';
  end if;

  select p.user_id into target from public.profiles p where lower(p.handle) = lower(btrim(p_handle));
  if target is null then
    raise exception 'handle_not_found';
  end if;
  if target = me then
    raise exception 'cannot_friend_self';
  end if;

  select * into existing from public.friendships f
  where least(f.requester_id, f.addressee_id) = least(me, target)
    and greatest(f.requester_id, f.addressee_id) = greatest(me, target);

  if found then
    -- La otra persona ya me había invitado: aceptar en vez de duplicar.
    if existing.status = 'pending' and existing.addressee_id = me then
      update public.friendships set status = 'accepted', responded_at = now()
      where id = existing.id returning * into existing;
    end if;
    return existing;
  end if;

  begin
    insert into public.friendships (requester_id, addressee_id) values (me, target) returning * into existing;
  exception when unique_violation then
    select * into existing from public.friendships f
    where least(f.requester_id, f.addressee_id) = least(me, target)
      and greatest(f.requester_id, f.addressee_id) = greatest(me, target);
  end;
  return existing;
end;
$$;

create or replace function public.respond_friend_request(p_id uuid, p_accept boolean)
returns public.friendships
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  fr public.friendships;
begin
  if me is null then
    raise exception 'not_authenticated';
  end if;
  select * into fr from public.friendships where id = p_id;
  if not found or fr.addressee_id <> me then
    raise exception 'request_not_found';
  end if;
  if fr.status <> 'pending' then
    raise exception 'request_not_pending';
  end if;
  if p_accept then
    update public.friendships set status = 'accepted', responded_at = now()
    where id = p_id returning * into fr;
  else
    delete from public.friendships where id = p_id;
  end if;
  return fr;
end;
$$;

revoke all on function public.find_profile_by_handle(text) from public, anon;
revoke all on function public.handle_available(text) from public, anon;
revoke all on function public.send_friend_request(text) from public, anon;
revoke all on function public.respond_friend_request(uuid, boolean) from public, anon;
grant execute on function public.find_profile_by_handle(text) to authenticated;
grant execute on function public.handle_available(text) to authenticated;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

-- Verificación manual de RLS (dos usuarios A y B; sustituir los UUID por usuarios reales) -----
-- begin;
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<A-uuid>","role":"authenticated"}', true);
--   insert into public.profiles (user_id, handle, display_name) values ('<A-uuid>', 'ana_test', 'Ana');
--   -- debe fallar (perfil ajeno): insert into public.profiles values ('<B-uuid>', 'fake_b', 'Fake');
--   select count(*) from public.profiles;                         -- 1: solo A
--   select * from public.find_profile_by_handle('BOB_TEST');      -- exacto, ignora mayúsculas
--   select * from public.find_profile_by_handle('bob');           -- 0 filas (sin prefijos)
--   select * from public.send_friend_request('bob_test');         -- pending; B pasa a ser visible
--   select count(*) from public.profiles;                         -- 2
--   -- debe fallar: insert into public.friendships (requester_id, addressee_id) values ('<A-uuid>','<B-uuid>');
--   -- A no puede aceptar su propia solicitud (request_not_found); B sí:
--   select set_config('request.jwt.claims', '{"sub":"<B-uuid>","role":"authenticated"}', true);
--   select * from public.respond_friend_request('<friendship-id>', true);
--   select public.are_friends('<A-uuid>', '<B-uuid>');            -- true
--   select set_config('request.jwt.claims', '{"sub":"<C-uuid>","role":"authenticated"}', true);
--   select count(*) from public.friendships;                      -- 0: un tercero no ve nada
--   select count(*) from public.profiles where user_id in ('<A-uuid>','<B-uuid>'); -- 0
-- rollback;
