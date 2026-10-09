-- =============================================================================
-- MemeMasters – Doublons : améliorations Dorée / Divine et revente
-- =============================================================================

create type public.card_variant as enum ('normal', 'gold', 'divine');

alter table public.user_cards
  add column variant public.card_variant not null default 'normal';

-- Centièmes de MemeMoney gagnés par la revente et pas encore crédités (0 à 99).
alter table public.player_wallets
  add column meme_money_cents smallint not null default 0 check (meme_money_cents between 0 and 99);

-- Revente du jour, en centièmes de MemeMoney (plafond quotidien).
alter table public.daily_usage
  add column resale_cents integer not null default 0 check (resale_cents >= 0);

alter type public.ledger_kind add value if not exists 'card_sell';
alter type public.ledger_kind add value if not exists 'card_upgrade';

alter table public.economy_ledger
  add column cards_delta integer not null default 0;
