-- =============================================================================
-- MemeMasters – Vues de classement (matérialisées, rafraîchies par le serveur)
--
-- Les poids de la popularité (0,6 likes / 0,4 utilisation) et le lissage du
-- taux de victoire (+10 / +20) sont repris de src/config/game.config.ts
-- (RANKING). Un test vérifie que les deux restent alignés.
-- =============================================================================

create materialized view public.card_rankings as
with
  boosted_players as (
    select greatest(count(distinct player_id), 1)::numeric as n from public.booster_openings
  ),
  likes as (
    select card_id, count(*)::integer as n from public.card_likes group by card_id
  ),
  owners as (
    select card_id, count(*)::integer as n from public.user_cards group by card_id
  ),
  usage_all as (
    select card_id, sum(games)::integer as games, sum(wins)::integer as wins
    from public.card_usage_daily group by card_id
  ),
  usage_30 as (
    select card_id, sum(actions)::integer as actions
    from public.card_usage_daily
    where day >= current_date - 30
    group by card_id
  ),
  base as (
    select
      c.id                        as card_id,
      coalesce(l.n, 0)            as likes,
      coalesce(o.n, 0)            as owners,
      coalesce(u.games, 0)        as games,
      coalesce(u.wins, 0)         as wins,
      coalesce(u30.actions, 0)    as usage_30d
    from public.cards c
    left join likes l     on l.card_id = c.id
    left join owners o    on o.card_id = c.id
    left join usage_all u on u.card_id = c.id
    left join usage_30 u30 on u30.card_id = c.id
    where c.is_active
  )
select
  b.card_id,
  b.likes,
  b.owners,
  round(b.owners / (select n from boosted_players), 4)                         as possession_rate,
  b.games,
  b.wins,
  case when b.games > 0 then round(b.wins::numeric / b.games, 4) end          as win_rate,
  round((b.wins + 10)::numeric / (b.games + 20), 4)                           as win_rate_adjusted,
  b.usage_30d,
  round(100 * (
      0.6 * coalesce(b.likes::numeric / nullif(max(b.likes) over (), 0), 0)
    + 0.4 * coalesce(b.usage_30d::numeric / nullif(max(b.usage_30d) over (), 0), 0)
  ))::integer                                                                  as popularity
from base b;

create unique index card_rankings_card_idx on public.card_rankings (card_id);

create materialized view public.player_rankings as
select
  p.id                          as player_id,
  p.username,
  p.avatar_card_id,
  p.level,
  p.elo,
  coalesce(c.n, 0)              as distinct_cards,
  rank() over (order by p.elo desc)               as elo_rank,
  rank() over (order by coalesce(c.n, 0) desc)    as collection_rank
from public.profiles p
left join (
  select player_id, count(*)::integer as n from public.user_cards group by player_id
) c on c.player_id = p.id;

create unique index player_rankings_player_idx on public.player_rankings (player_id);

-- Les vues matérialisées n'ont pas de RLS : on règle l'accès par les droits.
revoke all on public.card_rankings, public.player_rankings from anon, authenticated;
grant select on public.card_rankings to anon, authenticated;
grant select on public.player_rankings to authenticated;

-- Rafraîchissement appelé par le serveur (job planifié, phase 3).
create or replace function public.refresh_rankings()
returns void
language sql
set search_path = ''
as $$
  refresh materialized view concurrently public.card_rankings;
  refresh materialized view concurrently public.player_rankings;
$$;
