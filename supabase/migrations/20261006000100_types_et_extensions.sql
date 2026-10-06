-- =============================================================================
-- MemeMasters – Types énumérés et extensions
-- Les valeurs sont en ASCII (sans accents) : ce sont des clés techniques.
-- Les libellés affichés vivent dans messages/fr.json.
-- =============================================================================

create schema if not exists extensions;
create extension if not exists citext with schema extensions;

-- L'ordre des valeurs compte : il sert au tri par rareté.
create type public.rarity as enum (
  'commune', 'rare', 'epique', 'mystique', 'legendaire',
  'omniversal', 'superbrainrot', 'godlevel'
);

create type public.vibe as enum (
  'chaos', 'wholesome', 'rage', 'ironique', 'cringe', 'absurde'
);

create type public.booster_source as enum ('free', 'bonus', 'paid');
create type public.battle_mode as enum ('ranked', 'bot');
create type public.battle_status as enum ('active', 'finished', 'abandoned');
create type public.battle_side as enum ('a', 'b');
create type public.end_reason as enum ('ko', 'forfeit', 'disconnect', 'afk', 'turn_limit');
create type public.purchase_status as enum ('pending', 'paid', 'expired', 'refunded');

create type public.challenge_type as enum (
  'win_battles', 'play_battles', 'open_boosters', 'act_with_vibe',
  'use_special', 'ko_cards', 'like_cards', 'dust_action'
);

create type public.ledger_kind as enum (
  'booster_open', 'recycle', 'craft', 'challenge_reward',
  'purchase', 'refund', 'admin_adjust'
);
