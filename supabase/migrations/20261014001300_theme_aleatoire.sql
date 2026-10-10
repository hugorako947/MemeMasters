-- =============================================================================
-- MemeMasters – Thème « Aléatoire »
-- La graine de la palette (6 chiffres hexadécimaux) est rangée dans theme_accent,
-- dont le format (#xxxxxx) est déjà vérifié.
-- =============================================================================

alter table public.player_private drop constraint if exists player_private_theme_check;
alter table public.player_private
  add constraint player_private_theme_check check (theme in ('light', 'dark', 'inverted', 'custom', 'random'));
