-- =============================================================================
-- Battle Meme – 5 raretés au lieu de 7 (décision du propriétaire, 2026-10-26) :
-- Commune, Rare, Épique, Légendaire, Godlevel. Brainrot et SuperBrainrot deviennent Légendaire :
-- les joueurs gardent leurs exemplaires et leurs niveaux d'évolution.
-- Postgres ne sait pas retirer une valeur d'un type énuméré : on le remplace (comme 20261008000700).
-- =============================================================================

alter type public.rarity rename to rarity_old;

create type public.rarity as enum ('commune', 'rare', 'epique', 'legendaire', 'godlevel');

create or replace function pg_temp.map_rarity(r public.rarity_old)
returns public.rarity
language sql
immutable
as $$
  select case r::text
    when 'brainrot' then 'legendaire'
    when 'superbrainrot' then 'legendaire'
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

-- Les 4 cartes du jeu de départ concernées : statistiques ramenées au budget légendaire (184 ± 3 %),
-- puissance spéciale au maximum des légendaires (75). Une carte déjà modifiée depuis l'administration
-- (statistiques différentes de celles d'origine) n'est pas touchée.
update public.cards set atk = 47, def = 41, special_attack = jsonb_set(special_attack, '{power}', '75')
  where slug = 'spirale-du-scroll-infini' and hp = 116 and atk = 50 and def = 44 and spd = 80;
update public.cards set atk = 57, def = 32
  where slug = 'grille-pain-interdimensionnel' and hp = 100 and atk = 60 and def = 35 and spd = 94;
update public.cards set atk = 38, def = 48
  where slug = 'cactus-hurleur' and hp = 130 and atk = 40 and def = 52 and spd = 70;
update public.cards set hp = 116, atk = 50, def = 36, special_attack = jsonb_set(special_attack, '{power}', '75')
  where slug = 'cerveau-en-puree-cosmique' and hp = 120 and atk = 56 and def = 42 and spd = 84;
