-- =============================================================================
-- MemeMasters – Messages de contact
-- Le formulaire /contact enregistre les demandes ici, en attendant l'adresse
-- e-mail dédiée du jeu (elles pourront ensuite lui être transférées).
-- Aucun accès client : seul le serveur écrit, l'équipe lit depuis Supabase.
-- =============================================================================

create type public.contact_category as enum ('question', 'bug', 'purchase', 'report', 'account', 'other');
create type public.contact_status as enum ('new', 'handled');

create table public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid references public.profiles (id) on delete set null,
  email      text not null check (char_length(email) between 3 and 254),
  category   public.contact_category not null,
  message    text not null check (char_length(message) between 10 and 2000),
  locale     text check (char_length(locale) <= 5),
  status     public.contact_status not null default 'new',
  created_at timestamptz not null default now()
);
create index contact_messages_status_idx on public.contact_messages (status, created_at desc);

alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from anon, authenticated;
