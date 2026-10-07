-- =============================================================================
-- MemeMasters – Nouveau système de raretés (7 au lieu de 8)
-- Commune, Rare, Épique, Légendaire, Brainrot, SuperBrainrot, Godlevel.
-- Mystique disparaît (→ épique) et Omniversal devient Brainrot.
-- Postgres ne sait pas retirer une valeur d'un type énuméré : on le remplace.
-- =============================================================================

alter type public.rarity rename to rarity_old;

create type public.rarity as enum (
  'commune', 'rare', 'epique', 'legendaire', 'brainrot', 'superbrainrot', 'godlevel'
);

create or replace function pg_temp.map_rarity(r public.rarity_old)
returns public.rarity
language sql
immutable
as $$
  select case r::text
    when 'mystique' then 'epique'
    when 'omniversal' then 'brainrot'
    else r::text
  end::public.rarity;
$$;

create or replace function pg_temp.map_rarities(arr public.rarity_old[])
returns public.rarity[]
language sql
immutable
as $$
  select coalesce(array_agg(pg_temp.map_rarity(x) order by i), '{}')
  from unnest(arr) with ordinality as t(x, i);
$$;

drop index if exists public.cards_rarity_idx;
alter table public.cards
  alter column rarity type public.rarity using pg_temp.map_rarity(rarity);
create index cards_rarity_idx on public.cards (rarity) where is_active;

alter table public.booster_openings
  alter column rarities type public.rarity[]
  using pg_temp.map_rarities(rarities);

drop function pg_temp.map_rarities(public.rarity_old[]);
drop function pg_temp.map_rarity(public.rarity_old);
drop type public.rarity_old;

-- Type de booster ouvert (journalier classique, spécial, très spécial).
create type public.booster_kind as enum ('daily', 'special', 'very_special');
alter table public.booster_openings
  add column kind public.booster_kind not null default 'daily';

-- Réserves de boosters du joueur par type (achetés avec de la MemeMoney ou offerts).
alter table public.player_wallets
  add column special_boosters      integer not null default 0 check (special_boosters >= 0),
  add column very_special_boosters integer not null default 0 check (very_special_boosters >= 0);

-- Fond « inversé » possible pour le thème personnalisé.
alter table public.player_private drop constraint if exists player_private_theme_base_check;
alter table public.player_private
  add constraint player_private_theme_base_check check (theme_base in ('light', 'dark', 'inverted'));
