-- =============================================================================
-- MemeMasters – Contact « Autre », blocages, signalements et messagerie
-- =============================================================================

-- Contact : sujet précisé quand la catégorie est « Autre ».
alter table public.contact_messages
  add column subject text check (subject is null or char_length(subject) between 3 and 80);

-- Blocages : le joueur bloqué ne peut plus envoyer de demande d'ami ni de message.
create table public.player_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index player_blocks_blocked_idx on public.player_blocks (blocked_id);

-- Signalements : traités par l'équipe depuis Supabase.
create type public.report_reason as enum ('spam', 'harassment', 'hate', 'inappropriate_name', 'cheating', 'other');
create type public.report_status as enum ('new', 'handled');
create table public.player_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  reason      public.report_reason not null,
  details     text check (details is null or char_length(details) <= 500),
  message_id  uuid,
  status      public.report_status not null default 'new',
  created_at  timestamptz not null default now()
);
create index player_reports_status_idx on public.player_reports (status, created_at desc);

-- Messagerie privée entre deux joueurs (amis ou non).
create table public.messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 500),
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  check (sender_id <> recipient_id)
);
create index messages_pair_idx on public.messages
  (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at desc);
create index messages_unread_idx on public.messages (recipient_id) where read_at is null;

alter table public.player_blocks enable row level security;
alter table public.player_reports enable row level security;
alter table public.messages enable row level security;

-- Lecture : ses propres blocages et ses propres messages. Aucune écriture côté client.
create policy "blocks_select_own" on public.player_blocks
  for select to authenticated using ((select auth.uid()) = blocker_id);
create policy "messages_select_own" on public.messages
  for select to authenticated using ((select auth.uid()) in (sender_id, recipient_id));
revoke insert, update, delete on public.player_blocks, public.messages from anon, authenticated;
revoke all on public.player_reports from anon, authenticated;
