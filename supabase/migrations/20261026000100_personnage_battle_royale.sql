-- =============================================================================
-- Battle royale : le personnage choisi par chaque joueur (Collection → « Choisir pour le Battle Royale »).
-- Il sert aux parties d'Entraînement et, à partir de la phase 4, de personnage « fantôme » dans les parties
-- classées des autres joueurs (conception §5.2). Lecture et écriture réservées au serveur, qui vérifie
-- lui-même l'identité et que la carte est possédée.
-- =============================================================================

create table public.br_characters (
  player_id  uuid primary key references public.profiles (id) on delete cascade,
  card_id    uuid not null references public.cards (id) on delete cascade,
  updated_at timestamptz not null default now()
);

create index br_characters_card_idx on public.br_characters (card_id);

alter table public.br_characters enable row level security;
revoke all on public.br_characters from anon, authenticated;
