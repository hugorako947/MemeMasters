-- =============================================================================
-- MemeMasters – Vibes supprimées, validations du Super Admin, Communauté
-- =============================================================================

-- Vibes : supprimées du jeu. Les illustrations générées tirent leur décor de la graine.
alter table public.cards drop column vibe;
drop type public.vibe;

-- Demandes des admins, validées (ou refusées) par le Super Admin avant d'être appliquées :
-- cartes (création, modification, suppression), ressources d'un joueur, suppression de compte,
-- news, défis, sortie d'une carte de la Communauté.
create table public.admin_requests (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  requested_by uuid references public.profiles (id) on delete set null,
  action       text not null check (char_length(action) <= 60),
  target       text check (target is null or char_length(target) <= 200),
  summary      text not null check (char_length(summary) <= 300),
  payload      jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'failed')),
  reviewed_by  uuid references public.profiles (id) on delete set null,
  reviewed_at  timestamptz,
  review_note  text check (review_note is null or char_length(review_note) <= 300)
);
create index admin_requests_pending_idx on public.admin_requests (created_at desc) where status = 'pending';
create index admin_requests_requester_idx on public.admin_requests (requested_by, created_at desc);
alter table public.admin_requests enable row level security;
revoke all on public.admin_requests from anon, authenticated;

-- Communauté : les joueurs proposent des cartes de meme ; une fois validées par l'équipe,
-- elles sont soumises au vote. La plus votée peut sortir pour de bon dans le jeu.
create table public.community_cards (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  author_id     uuid not null references public.profiles (id) on delete cascade,
  name          text not null check (char_length(name) between 2 and 40),
  description   text not null default '' check (char_length(description) <= 140),
  image_path    text,
  art_seed      integer not null default floor(random() * 2147483647)::integer,
  status        text not null default 'pending' check (status in ('pending', 'voting', 'rejected', 'released')),
  reviewed_by   uuid references public.profiles (id) on delete set null,
  reviewed_at   timestamptz,
  reject_reason text check (reject_reason is null or char_length(reject_reason) <= 200),
  card_id       uuid references public.cards (id) on delete set null,
  released_at   timestamptz
);
create index community_cards_status_idx on public.community_cards (status, created_at desc);
create index community_cards_author_idx on public.community_cards (author_id, created_at desc);

-- Un seul vote par joueur (il peut le déplacer) ; jamais pour sa propre carte (vérifié côté serveur).
create table public.community_votes (
  player_id         uuid primary key references public.profiles (id) on delete cascade,
  community_card_id uuid not null references public.community_cards (id) on delete cascade,
  created_at        timestamptz not null default now()
);
create index community_votes_card_idx on public.community_votes (community_card_id);

alter table public.community_cards enable row level security;
alter table public.community_votes enable row level security;
revoke all on public.community_cards from anon, authenticated;
revoke all on public.community_votes from anon, authenticated;
