-- =============================================================================
-- MemeMasters – Supprimer une conversation (pour soi)
-- La conversation disparaît de sa propre liste ; si l'autre joueur réécrit,
-- elle réapparaît avec uniquement les nouveaux messages.
-- =============================================================================

create table public.conversation_hides (
  player_id     uuid not null references public.profiles (id) on delete cascade,
  other_id      uuid not null references public.profiles (id) on delete cascade,
  hidden_before timestamptz not null default now(),
  primary key (player_id, other_id)
);

alter table public.conversation_hides enable row level security;
create policy "conversation_hides_select_own" on public.conversation_hides
  for select to authenticated using ((select auth.uid()) = player_id);
revoke insert, update, delete on public.conversation_hides from anon, authenticated;
