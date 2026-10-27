-- =============================================================================
-- Battle Meme – Évolutions en 4 niveaux (décision du propriétaire, 2026-10-26) :
-- ★, ★★, ★★★, puis Divine (MAX). Les cartes gardent la couleur de leur rareté ; seule la Divine devient argentée.
-- Correspondance : Dorée ★ → ★ (1), Dorée ★★ → ★★ (2), Divine ★★★ → Divine (4) : personne ne perd rien,
-- et une carte Divine garde son bonus de +10 %.
-- =============================================================================

alter table public.user_cards drop constraint user_cards_upgrade_level_check;

update public.user_cards set upgrade_level = 4 where upgrade_level = 3;

alter table public.user_cards
  add constraint user_cards_upgrade_level_check check (upgrade_level between 0 and 4);
