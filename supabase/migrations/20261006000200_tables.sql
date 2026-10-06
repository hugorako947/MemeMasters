-- =============================================================================
-- MemeMasters – Tables
-- Règle : aucune écriture client directe. Toutes les écritures passent par le
-- serveur (connexion Postgres dédiée). Voir 20261006000300_securite.sql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Utilitaires
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Vrai si le tableau ne contient aucun doublon (utilisable dans un CHECK).
create or replace function public.array_has_no_duplicates(arr uuid[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(arr) = (select count(distinct x) from unnest(arr) as x);
$$;

-- ---------------------------------------------------------------------------
-- Cartes
-- ---------------------------------------------------------------------------

create table public.cards (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  name            text not null check (char_length(name) between 1 and 40),
  description     text not null default '' check (char_length(description) <= 280),
  rarity          public.rarity not null,
  vibe            public.vibe not null,
  hp              smallint not null check (hp between 60 and 140),
  atk             smallint not null check (atk between 20 and 65),
  def             smallint not null check (def between 20 and 65),
  spd             smallint not null check (spd between 10 and 100),
  -- Structures validées par Zod côté serveur (src/lib/validation/card.ts).
  normal_attack   jsonb not null check (jsonb_typeof(normal_attack) = 'object'),
  special_attack  jsonb not null check (jsonb_typeof(special_attack) = 'object'),
  defense_ability jsonb not null check (jsonb_typeof(defense_ability) = 'object'),
  image_path      text,
  art_seed        integer not null default floor(random() * 2147483647)::integer,
  is_droppable    boolean not null default true,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index cards_rarity_idx on public.cards (rarity) where is_active;
create trigger cards_updated_at before update on public.cards
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Joueurs
-- ---------------------------------------------------------------------------

create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  username       extensions.citext not null unique
                 check (char_length(username::text) between 3 and 20
                        and username::text ~ '^[A-Za-z0-9_]+$'),
  avatar_card_id uuid references public.cards (id) on delete set null,
  xp             integer not null default 0 check (xp >= 0),
  level          integer not null default 1 check (level >= 1),
  elo            integer not null default 1000 check (elo >= 100),
  ranked_games   integer not null default 0 check (ranked_games >= 0),
  wins           integer not null default 0 check (wins >= 0),
  losses         integer not null default 0 check (losses >= 0),
  draws          integer not null default 0 check (draws >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index profiles_elo_idx on public.profiles (elo desc);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Données privées : RLS filtre des lignes, pas des colonnes, d'où cette table.
create table public.player_private (
  player_id           uuid primary key references public.profiles (id) on delete cascade,
  -- Demandée seulement à la première visite de la boutique (achats réservés aux 18 ans et plus).
  birthdate           date check (birthdate > date '1900-01-01'),
  age_declared_at     timestamptz,
  timezone            text not null check (char_length(timezone) between 1 and 64),
  timezone_changed_at timestamptz,
  monthly_cap_cents   integer check (monthly_cap_cents >= 0),
  monthly_cap_raise_at timestamptz,
  pending_monthly_cap_cents integer check (pending_monthly_cap_cents >= 0),
  last_country        char(2),
  auto_recycle        boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check ((birthdate is null) = (age_declared_at is null))
);
create trigger player_private_updated_at before update on public.player_private
  for each row execute function public.set_updated_at();

create table public.player_wallets (
  player_id      uuid primary key references public.profiles (id) on delete cascade,
  dust           integer not null default 0 check (dust >= 0),
  bonus_boosters integer not null default 0 check (bonus_boosters >= 0),
  paid_boosters  integer not null default 0 check (paid_boosters >= 0),
  pity_counter   integer not null default 0 check (pity_counter >= 0),
  updated_at     timestamptz not null default now()
);
create trigger player_wallets_updated_at before update on public.player_wallets
  for each row execute function public.set_updated_at();

create table public.daily_usage (
  player_id            uuid not null references public.profiles (id) on delete cascade,
  game_date            date not null,
  free_boosters_opened smallint not null default 0 check (free_boosters_opened >= 0),
  primary key (player_id, game_date)
);

create table public.user_cards (
  player_id         uuid not null references public.profiles (id) on delete cascade,
  card_id           uuid not null references public.cards (id) on delete restrict,
  quantity          integer not null check (quantity >= 1),
  first_obtained_at timestamptz not null default now(),
  last_obtained_at  timestamptz not null default now(),
  primary key (player_id, card_id)
);
create index user_cards_card_idx on public.user_cards (card_id);

create table public.card_likes (
  player_id  uuid not null references public.profiles (id) on delete cascade,
  card_id    uuid not null references public.cards (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (player_id, card_id)
);
create index card_likes_card_idx on public.card_likes (card_id);

-- ---------------------------------------------------------------------------
-- Économie
-- ---------------------------------------------------------------------------

create table public.booster_openings (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid not null references public.profiles (id) on delete cascade,
  source         public.booster_source not null,
  card_ids       uuid[] not null check (cardinality(card_ids) between 1 and 10),
  rarities       public.rarity[] not null,
  pity_triggered boolean not null default false,
  created_at     timestamptz not null default now(),
  check (cardinality(card_ids) = cardinality(rarities))
);
create index booster_openings_player_idx on public.booster_openings (player_id, created_at desc);

create table public.economy_ledger (
  id                   bigint generated always as identity primary key,
  player_id            uuid not null references public.profiles (id) on delete cascade,
  kind                 public.ledger_kind not null,
  dust_delta           integer not null default 0,
  bonus_boosters_delta integer not null default 0,
  paid_boosters_delta  integer not null default 0,
  ref_id               uuid,
  note                 text check (char_length(note) <= 200),
  created_at           timestamptz not null default now()
);
create index economy_ledger_player_idx on public.economy_ledger (player_id, created_at desc);

create table public.challenge_templates (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique check (code ~ '^[a-z0-9_]+$'),
  type            public.challenge_type not null,
  target          integer not null check (target > 0),
  params          jsonb not null default '{}'::jsonb check (jsonb_typeof(params) = 'object'),
  reward_boosters integer not null default 1 check (reward_boosters >= 0),
  weight          integer not null default 1 check (weight > 0),
  is_active       boolean not null default true
);

create table public.player_challenges (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references public.profiles (id) on delete cascade,
  game_date    date not null,
  template_id  uuid not null references public.challenge_templates (id) on delete cascade,
  params       jsonb not null default '{}'::jsonb,
  progress     integer not null default 0 check (progress >= 0),
  target       integer not null check (target > 0),
  completed_at timestamptz,
  claimed_at   timestamptz,
  unique (player_id, game_date, template_id),
  check (claimed_at is null or completed_at is not null)
);
create index player_challenges_day_idx on public.player_challenges (player_id, game_date);

-- ---------------------------------------------------------------------------
-- Combat
-- ---------------------------------------------------------------------------

create table public.decks (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.profiles (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 30),
  -- La taille exacte (TEAM_SIZE) est imposée par le serveur ; ici une borne large.
  card_ids   uuid[] not null check (cardinality(card_ids) between 1 and 6
                                    and public.array_has_no_duplicates(card_ids)),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index decks_player_idx on public.decks (player_id);
create unique index decks_one_default_idx on public.decks (player_id) where is_default;
create trigger decks_updated_at before update on public.decks
  for each row execute function public.set_updated_at();

create table public.battles (
  id               uuid primary key default gen_random_uuid(),
  mode             public.battle_mode not null,
  status           public.battle_status not null default 'active',
  -- « set null » : supprimer un compte ne fait pas disparaître l'historique de l'adversaire.
  player_a         uuid references public.profiles (id) on delete set null,
  player_b         uuid references public.profiles (id) on delete set null,
  turn             integer not null default 1 check (turn >= 1),
  turn_deadline_at timestamptz,
  -- Vue publique uniquement (PV, énergie, cartes actives, statuts). Jamais la graine.
  public_state     jsonb not null default '{}'::jsonb,
  winner_side      public.battle_side,
  end_reason       public.end_reason,
  elo_delta_a      integer,
  elo_delta_b      integer,
  last_seen_a      timestamptz,
  last_seen_b      timestamptz,
  created_at       timestamptz not null default now(),
  finished_at      timestamptz,
  check (player_a is distinct from player_b or player_a is null),
  check (mode = 'ranked' or player_b is null),
  check ((status = 'active') = (finished_at is null))
);
create index battles_player_a_idx on public.battles (player_a, created_at desc);
create index battles_player_b_idx on public.battles (player_b, created_at desc);
create index battles_deadline_idx on public.battles (turn_deadline_at) where status = 'active';

-- État complet, graine PRNG et version : jamais lisible par un client.
create table public.battle_secrets (
  battle_id uuid primary key references public.battles (id) on delete cascade,
  state     jsonb not null,
  version   integer not null default 0 check (version >= 0)
);

create table public.battle_actions (
  battle_id    uuid not null references public.battles (id) on delete cascade,
  turn         integer not null check (turn >= 1),
  side         public.battle_side not null,
  action       jsonb not null check (jsonb_typeof(action) = 'object'),
  is_auto      boolean not null default false,
  submitted_at timestamptz not null default now(),
  primary key (battle_id, turn, side)
);

create table public.battle_turns (
  battle_id  uuid not null references public.battles (id) on delete cascade,
  turn       integer not null check (turn >= 1),
  events     jsonb not null check (jsonb_typeof(events) = 'array'),
  created_at timestamptz not null default now(),
  primary key (battle_id, turn)
);

create table public.matchmaking_queue (
  player_id         uuid primary key references public.profiles (id) on delete cascade,
  deck_id           uuid not null references public.decks (id) on delete cascade,
  elo               integer not null,
  joined_at         timestamptz not null default now(),
  matched_battle_id uuid references public.battles (id) on delete set null
);
create index matchmaking_queue_waiting_idx on public.matchmaking_queue (elo) where matched_battle_id is null;

-- Statistiques d'usage par carte et par jour : alimente le taux de victoire
-- (tout temps) et l'utilisation sur 30 jours (popularité).
create table public.card_usage_daily (
  card_id uuid not null references public.cards (id) on delete cascade,
  day     date not null,
  games   integer not null default 0 check (games >= 0),
  wins    integer not null default 0 check (wins >= 0),
  actions integer not null default 0 check (actions >= 0),
  primary key (card_id, day),
  check (wins <= games)
);

-- ---------------------------------------------------------------------------
-- Paiements
-- ---------------------------------------------------------------------------

create table public.purchases (
  id                uuid primary key default gen_random_uuid(),
  -- « set null » : la trace comptable survit à la suppression du compte.
  player_id         uuid references public.profiles (id) on delete set null,
  product_code      text not null check (product_code ~ '^[a-z0-9_]+$'),
  boosters          integer not null check (boosters > 0),
  amount_cents      integer not null check (amount_cents > 0),
  currency          char(3) not null,
  stripe_session_id text not null unique,
  payment_intent_id text,
  status            public.purchase_status not null default 'pending',
  created_at        timestamptz not null default now(),
  paid_at           timestamptz,
  refunded_at       timestamptz
);
create index purchases_player_idx on public.purchases (player_id, created_at desc);

create table public.stripe_events (
  event_id     text primary key,
  type         text not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Technique
-- ---------------------------------------------------------------------------

create table public.rate_limits (
  key          text not null check (char_length(key) <= 200),
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (key, window_start)
);

create table public.admin_audit_log (
  id         bigint generated always as identity primary key,
  admin_id   uuid references public.profiles (id) on delete set null,
  action     text not null check (char_length(action) <= 60),
  target     text check (char_length(target) <= 200),
  diff       jsonb,
  created_at timestamptz not null default now()
);
