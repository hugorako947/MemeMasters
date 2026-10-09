-- =============================================================================
-- MemeMasters – Amis et notifications
-- =============================================================================

create type public.friendship_status as enum ('pending', 'accepted');

-- Une seule relation par paire de joueurs : demande en attente ou amitié.
create table public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status       public.friendship_status not null default 'pending',
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);
create unique index friendships_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on public.friendships (addressee_id, status);
create index friendships_requester_idx on public.friendships (requester_id, status);

alter table public.friendships enable row level security;
-- Lecture : uniquement ses propres relations. Écriture : par le serveur seulement.
create policy "friendships_select_own" on public.friendships
  for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));
revoke insert, update, delete on public.friendships from anon, authenticated;

-- Notifications déjà vues (ex. : dernière news lue, jour des boosters, offres de la boutique).
alter table public.player_private
  add column seen jsonb not null default '{}'::jsonb;
