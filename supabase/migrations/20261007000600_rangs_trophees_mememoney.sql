-- =============================================================================
-- MemeMasters – Rangs, trophées, MemeMoney et préférences
--
-- Remplace l'ELO et les niveaux (XP) par :
--   - des trophées (+25 victoire, −25 défaite, 0 nul, jamais sous 0) ;
--   - 10 rangs, un tous les 1 000 trophées (bronze → immortel) ;
--   - la MemeMoney, monnaie du jeu (victoires, récompenses de rang, achats).
-- Ajoute les préférences de langue et de thème, et l'historique des trophées
-- (graphique de progression du profil).
-- =============================================================================

-- La vue de classement des joueurs dépend des colonnes supprimées : on la recrée.
drop materialized view if exists public.player_rankings;

alter table public.profiles
  add column trophies     integer  not null default 0 check (trophies >= 0),
  -- Rang le plus haut jamais atteint (0 = bronze … 9 = immortel) : chaque
  -- récompense de rang n'est donnée qu'une fois, même après une redescente.
  add column highest_rank smallint not null default 0 check (highest_rank between 0 and 9),
  drop column elo,
  drop column xp,
  drop column level;
create index profiles_trophies_idx on public.profiles (trophies desc);

alter table public.player_wallets
  add column meme_money integer not null default 0 check (meme_money >= 0);

alter table public.matchmaking_queue rename column elo to trophies;
alter table public.battles rename column elo_delta_a to trophy_delta_a;
alter table public.battles rename column elo_delta_b to trophy_delta_b;

-- Les achats en argent réel portent désormais sur de la MemeMoney.
alter table public.purchases rename column boosters to meme_money;

alter table public.economy_ledger
  add column meme_money_delta integer not null default 0;
alter type public.ledger_kind add value if not exists 'battle_reward';
alter type public.ledger_kind add value if not exists 'rank_reward';
alter type public.ledger_kind add value if not exists 'meme_money_spend';

alter table public.player_private
  add column locale       text check (locale in ('en', 'zh', 'es', 'ar', 'fr', 'pt', 'de')),
  add column theme        text not null default 'light' check (theme in ('light', 'dark', 'inverted', 'custom')),
  add column theme_accent text check (theme_accent ~ '^#[0-9a-f]{6}$'),
  add column theme_base   text check (theme_base in ('light', 'dark'));

-- Historique des trophées : un point par changement (graphique du profil).
create table public.trophy_history (
  id         bigint generated always as identity primary key,
  player_id  uuid not null references public.profiles (id) on delete cascade,
  trophies   integer not null check (trophies >= 0),
  rank       smallint not null check (rank between 0 and 9),
  reason     text not null check (reason in ('start', 'win', 'loss', 'draw', 'admin')),
  created_at timestamptz not null default now()
);
create index trophy_history_player_idx on public.trophy_history (player_id, created_at);
alter table public.trophy_history enable row level security;
create policy "historique des trophées lisible par les joueurs" on public.trophy_history
  for select to authenticated using (true);
revoke insert, update, delete, truncate on public.trophy_history from anon, authenticated;

-- Point de départ pour les joueurs déjà inscrits.
insert into public.trophy_history (player_id, trophies, rank, reason, created_at)
select id, 0, 0, 'start', created_at from public.profiles;

create materialized view public.player_rankings as
select
  p.id                          as player_id,
  p.username,
  p.avatar_card_id,
  p.trophies,
  least(p.trophies / 1000, 9)   as rank,
  coalesce(c.n, 0)              as distinct_cards,
  rank() over (order by p.trophies desc)          as trophy_rank,
  rank() over (order by coalesce(c.n, 0) desc)    as collection_rank
from public.profiles p
left join (
  select player_id, count(*)::integer as n from public.user_cards group by player_id
) c on c.player_id = p.id;

create unique index player_rankings_player_idx on public.player_rankings (player_id);
revoke all on public.player_rankings from anon, authenticated;
grant select on public.player_rankings to authenticated;
