-- =============================================================================
-- MemeMasters – Sécurité : RLS, droits, fonctions sensibles, Realtime, Storage
--
-- Principe : RLS activé partout, tout est refusé par défaut. Les clients
-- (rôles anon et authenticated) ne peuvent QUE lire, et seulement ce qui est
-- listé ici. Toutes les écritures passent par le serveur Next.js, qui se
-- connecte avec un rôle Postgres dédié (DATABASE_URL).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Défense en profondeur : aucun droit d'écriture pour les rôles clients
-- ---------------------------------------------------------------------------

revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon, authenticated;
alter default privileges in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from anon, authenticated;

revoke usage, select, update on all sequences in schema public from anon, authenticated;
alter default privileges in schema public
  revoke usage, select, update on sequences from anon, authenticated;

-- Les fonctions ne sont pas exécutables par défaut ; on ouvre au cas par cas.
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Fonctions d'aide aux politiques
-- ---------------------------------------------------------------------------

-- Le rôle admin vient de app_metadata (modifiable uniquement côté serveur),
-- jamais de user_metadata que le joueur peut éditer lui-même.
create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;
grant execute on function public.is_admin() to authenticated;

-- Vrai si l'utilisateur courant participe au combat.
-- SECURITY DEFINER : lit battles sans dépendre des politiques de l'appelant.
create or replace function public.is_battle_participant(p_battle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.battles b
    where b.id = p_battle_id
      and (select auth.uid()) in (b.player_a, b.player_b)
  );
$$;
grant execute on function public.is_battle_participant(uuid) to authenticated;

-- Variante pour un sujet Realtime « battle:<uuid> » (renvoie faux si mal formé).
create or replace function public.is_battle_topic_participant(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_topic !~ '^battle:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_battle_participant(substring(p_topic from 8)::uuid);
end;
$$;
grant execute on function public.is_battle_topic_participant(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Limitation de débit (fenêtre fixe). Appelée uniquement par le serveur.
-- Renvoie vrai si la requête est autorisée.
-- ---------------------------------------------------------------------------

create or replace function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_count  integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'check_rate_limit: paramètres invalides';
  end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = r.count + 1
  returning r.count into v_count;
  return v_count <= p_limit;
end;
$$;
-- Aucun grant : seul le propriétaire (rôle serveur) peut l'appeler.

-- ---------------------------------------------------------------------------
-- RLS : activation sur toutes les tables
-- ---------------------------------------------------------------------------

alter table public.cards               enable row level security;
alter table public.profiles            enable row level security;
alter table public.player_private      enable row level security;
alter table public.player_wallets      enable row level security;
alter table public.daily_usage         enable row level security;
alter table public.user_cards          enable row level security;
alter table public.card_likes          enable row level security;
alter table public.booster_openings    enable row level security;
alter table public.economy_ledger      enable row level security;
alter table public.challenge_templates enable row level security;
alter table public.player_challenges   enable row level security;
alter table public.decks               enable row level security;
alter table public.battles             enable row level security;
alter table public.battle_secrets      enable row level security;
alter table public.battle_actions      enable row level security;
alter table public.battle_turns        enable row level security;
alter table public.matchmaking_queue   enable row level security;
alter table public.card_usage_daily    enable row level security;
alter table public.purchases           enable row level security;
alter table public.stripe_events       enable row level security;
alter table public.rate_limits         enable row level security;
alter table public.admin_audit_log     enable row level security;

-- ---------------------------------------------------------------------------
-- Politiques de lecture
-- ---------------------------------------------------------------------------

-- Public (même sans compte, pour la page /taux et le partage de cartes)
create policy "cartes actives lisibles par tous" on public.cards
  for select to anon, authenticated using (is_active);

create policy "statistiques de cartes lisibles par tous" on public.card_usage_daily
  for select to anon, authenticated using (true);

-- Joueurs connectés
create policy "profils lisibles par les joueurs" on public.profiles
  for select to authenticated using (true);

create policy "modèles de défis lisibles par les joueurs" on public.challenge_templates
  for select to authenticated using (is_active);

-- Soi uniquement
create policy "ses données privées" on public.player_private
  for select to authenticated using (player_id = (select auth.uid()));
create policy "son portefeuille" on public.player_wallets
  for select to authenticated using (player_id = (select auth.uid()));
create policy "son usage quotidien" on public.daily_usage
  for select to authenticated using (player_id = (select auth.uid()));
create policy "sa collection" on public.user_cards
  for select to authenticated using (player_id = (select auth.uid()));
create policy "ses likes" on public.card_likes
  for select to authenticated using (player_id = (select auth.uid()));
create policy "ses ouvertures de boosters" on public.booster_openings
  for select to authenticated using (player_id = (select auth.uid()));
create policy "son journal économique" on public.economy_ledger
  for select to authenticated using (player_id = (select auth.uid()));
create policy "ses défis" on public.player_challenges
  for select to authenticated using (player_id = (select auth.uid()));
create policy "ses decks" on public.decks
  for select to authenticated using (player_id = (select auth.uid()));
create policy "sa place dans la file" on public.matchmaking_queue
  for select to authenticated using (player_id = (select auth.uid()));
create policy "ses achats" on public.purchases
  for select to authenticated using (player_id = (select auth.uid()));

-- Participants d'un combat
create policy "combats lisibles par leurs participants" on public.battles
  for select to authenticated using ((select auth.uid()) in (player_a, player_b));
create policy "journal lisible par les participants" on public.battle_turns
  for select to authenticated using (public.is_battle_participant(battle_id));

-- Admins
create policy "journal d'audit lisible par les admins" on public.admin_audit_log
  for select to authenticated using (public.is_admin());

-- battle_secrets, battle_actions, stripe_events, rate_limits : aucune politique,
-- donc aucun accès client.

-- ---------------------------------------------------------------------------
-- Realtime : canaux privés
--   battle:<id>  → reçu uniquement par les participants ; présence autorisée
--   user:<id>    → reçu uniquement par son propriétaire
-- Les clients n'envoient jamais de messages Broadcast : seul le serveur diffuse.
-- ---------------------------------------------------------------------------

create policy "recevoir ses canaux privés" on realtime.messages
  for select to authenticated
  using (
    realtime.topic() = 'user:' || (select auth.uid())::text
    or public.is_battle_topic_participant(realtime.topic())
  );

create policy "présence dans ses combats" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'presence'
    and public.is_battle_topic_participant(realtime.topic())
  );

-- ---------------------------------------------------------------------------
-- Storage : illustrations des cartes (lecture publique, écriture serveur)
-- Aucune politique d'écriture : seul le serveur (clé secrète) peut téléverser.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('card-art', 'card-art', true)
on conflict (id) do nothing;
