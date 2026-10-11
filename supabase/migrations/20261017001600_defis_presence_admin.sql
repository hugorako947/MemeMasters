-- =============================================================================
-- MemeMasters – Défi du jour, joueurs en ligne, bannissement, news en base
-- (1/2 : nouvelles valeurs de types, utilisées dans la migration suivante)
-- =============================================================================

-- Nouveaux types de défis, réalisables sans les batailles.
alter type public.challenge_type add value if not exists 'new_cards';
alter type public.challenge_type add value if not exists 'sell_copies';
alter type public.challenge_type add value if not exists 'evolve_card';
alter type public.challenge_type add value if not exists 'send_messages';
alter type public.challenge_type add value if not exists 'add_friend';

-- Joueurs en ligne : dernière activité (mise à jour toutes les minutes quand le jeu est ouvert).
alter table public.profiles add column last_seen_at timestamptz;
create index profiles_last_seen_idx on public.profiles (last_seen_at desc);

-- Rôle : joueur ou admin (nommé par le Super Admin depuis le tableau de bord).
-- Le Super Admin, lui, n'est pas en base : il est désigné par SUPER_ADMIN_IDS côté serveur.
alter table public.player_private
  add column role text not null default 'player' check (role in ('player', 'admin'));

-- Bannissement par un administrateur.
alter table public.player_private
  add column banned_at timestamptz,
  add column ban_reason text check (ban_reason is null or char_length(ban_reason) <= 300);

-- News publiées depuis le tableau de bord (textes par langue ; le français est obligatoire).
create table public.news (
  id           uuid primary key default gen_random_uuid(),
  published_at timestamptz not null default now(),
  kind         text not null check (kind in ('news', 'update', 'upcoming', 'change')),
  title        jsonb not null check (jsonb_typeof(title) = 'object' and title ? 'fr'),
  body         jsonb not null check (jsonb_typeof(body) = 'object' and body ? 'fr'),
  created_by   uuid references public.profiles (id) on delete set null
);
create index news_published_idx on public.news (published_at desc);
alter table public.news enable row level security;
create policy "news_select_all" on public.news for select to anon, authenticated using (true);
revoke insert, update, delete on public.news from anon, authenticated;
