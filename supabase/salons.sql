-- ============================================================
-- MovieGuesser — salons « entre amis » + pseudos stricts
-- (à coller une fois dans le SQL Editor)
-- 1. Pseudo unique SANS distinction de casse (l'UI affiche en
--    majuscules et la recherche est insensible à la casse).
-- 2. rooms : le salon d'un duel en ligne — hôte, un invité (duel
--    strict), config JSONB, dissous à la sortie de l'hôte.
-- 3. game_invites : les invitations (badge profil + toast realtime).
-- Toutes les écritures passent par des RPC (validation d'amitié,
-- de propriété du salon, du statut). Realtime activé sur les deux
-- tables (RLS respectée par postgres_changes).
-- Idempotent : rejouable sans risque.
-- ============================================================

-- ------------------------------------------------------------
-- 1. pseudos : unicité insensible à la casse
--    (si l'index échoue : des doublons existent déjà — les repérer
--     avec `select lower(username), count(*) from profiles
--     group by 1 having count(*) > 1;` et renommer avant de rejouer)
-- ------------------------------------------------------------
create unique index if not exists profiles_username_lower_uniq
  on public.profiles (lower(username));

-- ------------------------------------------------------------
-- 2. les salons
-- ------------------------------------------------------------
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  host uuid not null references public.profiles(id) on delete cascade,
  guest uuid references public.profiles(id) on delete set null,
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'closed')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  -- filet de sécurité : un salon oublié expire tout seul
  expires_at timestamptz not null default now() + interval '4 hours'
);
alter table public.rooms enable row level security;

create table if not exists public.game_invites (
  room_id uuid not null references public.rooms(id) on delete cascade,
  from_user uuid not null,
  to_user uuid not null,
  created_at timestamptz not null default now(),
  primary key (room_id, to_user),
  constraint game_invites_from_user_fkey
    foreign key (from_user) references public.profiles(id) on delete cascade,
  constraint game_invites_to_user_fkey
    foreign key (to_user) references public.profiles(id) on delete cascade
);
alter table public.game_invites enable row level security;

-- lecture : les membres du salon, et quiconque y est invité
drop policy if exists "rooms_select_members" on public.rooms;
create policy "rooms_select_members" on public.rooms
  for select using (
    auth.uid() in (host, guest)
    or exists (select 1 from public.game_invites gi
               where gi.room_id = id and gi.to_user = auth.uid())
  );

drop policy if exists "game_invites_select_own" on public.game_invites;
create policy "game_invites_select_own" on public.game_invites
  for select using (auth.uid() in (from_user, to_user));

-- refuser (destinataire) ou annuler (hôte) une invitation
drop policy if exists "game_invites_delete_own" on public.game_invites;
create policy "game_invites_delete_own" on public.game_invites
  for delete using (auth.uid() in (from_user, to_user));

-- pas d'insert/update direct sur rooms ni game_invites : RPC ci-dessous

-- ------------------------------------------------------------
-- 3. RPC du cycle de vie du salon
-- ------------------------------------------------------------

-- ouvrir un salon (ferme les salons précédents de l'hôte)
create or replace function public.create_room(p_config jsonb default '{}'::jsonb)
returns public.rooms
language plpgsql security definer set search_path = public
as $$
declare
  result public.rooms;
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;
  if jsonb_typeof(coalesce(p_config, '{}'::jsonb)) <> 'object' then
    raise exception 'config invalide';
  end if;
  update public.rooms set status = 'closed'
    where host = auth.uid() and status <> 'closed';
  insert into public.rooms (host, config)
  values (auth.uid(), coalesce(p_config, '{}'::jsonb))
  returning * into result;
  return result;
end
$$;

-- l'hôte ajuste les règles tant qu'on est au lobby
create or replace function public.set_room_config(p_room uuid, p_config jsonb)
returns public.rooms
language plpgsql security definer set search_path = public
as $$
declare
  result public.rooms;
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;
  if jsonb_typeof(p_config) <> 'object' then raise exception 'config invalide'; end if;
  update public.rooms set config = p_config
    where id = p_room and host = auth.uid() and status = 'lobby'
    returning * into result;
  if result.id is null then raise exception 'salon introuvable ou déjà lancé'; end if;
  return result;
end
$$;

-- inviter un AMI (amitié acceptée exigée) dans son salon
create or replace function public.invite_friend(p_room uuid, p_to uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r public.rooms;
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;
  select * into r from public.rooms where id = p_room;
  if r.id is null or r.host <> auth.uid() then raise exception 'salon introuvable'; end if;
  if r.status <> 'lobby' then raise exception 'salon déjà lancé'; end if;
  if r.guest is not null then raise exception 'le salon est complet'; end if;
  if not exists (select 1 from public.friendships
                 where status = 'accepted'
                   and ((requester = auth.uid() and addressee = p_to)
                     or (requester = p_to and addressee = auth.uid()))) then
    raise exception 'vous n''êtes pas amis';
  end if;
  insert into public.game_invites (room_id, from_user, to_user)
  values (p_room, auth.uid(), p_to);
exception when unique_violation then
  raise exception 'déjà invité';
end
$$;

-- rejoindre un salon où l'on est invité (premier arrivé prend la place)
create or replace function public.join_room(p_room uuid)
returns public.rooms
language plpgsql security definer set search_path = public
as $$
declare
  result public.rooms;
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;
  if not exists (select 1 from public.game_invites
                 where room_id = p_room and to_user = auth.uid()) then
    raise exception 'invitation introuvable';
  end if;
  update public.rooms set guest = auth.uid()
    where id = p_room and status = 'lobby' and guest is null
    returning * into result;
  if result.id is null then raise exception 'salon complet ou fermé'; end if;
  -- la place est prise : toutes les invitations du salon tombent
  delete from public.game_invites where room_id = p_room;
  return result;
end
$$;

-- quitter : l'hôte dissout le salon, l'invité libère sa place
create or replace function public.leave_room(p_room uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;
  update public.rooms set status = 'closed'
    where id = p_room and (host = auth.uid()
      or (guest = auth.uid() and status = 'playing'));
  update public.rooms set guest = null
    where id = p_room and guest = auth.uid() and status = 'lobby';
end
$$;

revoke all on function public.create_room(jsonb) from public, anon;
revoke all on function public.set_room_config(uuid, jsonb) from public, anon;
revoke all on function public.invite_friend(uuid, uuid) from public, anon;
revoke all on function public.join_room(uuid) from public, anon;
revoke all on function public.leave_room(uuid) from public, anon;
grant execute on function public.create_room(jsonb) to authenticated;
grant execute on function public.set_room_config(uuid, jsonb) to authenticated;
grant execute on function public.invite_friend(uuid, uuid) to authenticated;
grant execute on function public.join_room(uuid) to authenticated;
grant execute on function public.leave_room(uuid) to authenticated;

-- ------------------------------------------------------------
-- 4. realtime : les changements de rooms/game_invites sont diffusés
--    (postgres_changes respecte la RLS)
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'rooms') then
    alter publication supabase_realtime add table public.rooms;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'game_invites') then
    alter publication supabase_realtime add table public.game_invites;
  end if;
end $$;
