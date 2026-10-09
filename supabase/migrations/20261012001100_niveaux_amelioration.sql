-- =============================================================================
-- MemeMasters – Améliorations en 3 niveaux : Dorée ★, Dorée ★★, Divine ★★★
-- Remplace la colonne `variant` (normal / gold / divine) par un niveau 0 à 3.
-- Correspondance : gold → 1 ; divine → 2 (même nombre d'exemplaires déjà
-- utilisés pour une commune : 5 + 10).
-- =============================================================================

alter table public.user_cards
  add column upgrade_level smallint not null default 0 check (upgrade_level between 0 and 3);

update public.user_cards set upgrade_level = case variant when 'gold' then 1 when 'divine' then 2 else 0 end;

alter table public.user_cards drop column variant;
drop type public.card_variant;
