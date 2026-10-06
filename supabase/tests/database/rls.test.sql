-- =============================================================================
-- Tests pgTAP des règles d'accès (RLS et droits).
-- Lancement : npx supabase test db   (ou scripts/check-sql.sh sans Docker)
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(27);

-- ---------------------------------------------------------------- données
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'chloe@test.local');
insert into public.profiles (id, username) values
  ('11111111-1111-1111-1111-111111111111', 'alice'),
  ('22222222-2222-2222-2222-222222222222', 'bob'),
  ('33333333-3333-3333-3333-333333333333', 'chloe');
insert into public.player_private (player_id, timezone) values
  ('11111111-1111-1111-1111-111111111111', 'Europe/Paris'),
  ('22222222-2222-2222-2222-222222222222', 'America/Montreal');
insert into public.player_wallets (player_id, dust) values
  ('11111111-1111-1111-1111-111111111111', 10),
  ('22222222-2222-2222-2222-222222222222', 20);
insert into public.cards (slug, name, rarity, vibe, hp, atk, def, spd,
                          normal_attack, special_attack, defense_ability, is_active) values
  ('carte-active', 'Carte active', 'commune', 'chaos', 90, 40, 35, 80, '{}', '{}', '{}', true),
  ('carte-retiree', 'Carte retirée', 'rare', 'rage', 90, 40, 35, 80, '{}', '{}', '{}', false);
insert into public.battles (id, mode, player_a, player_b) values
  ('44444444-4444-4444-4444-444444444444', 'ranked',
   '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
insert into public.battle_secrets (battle_id, state) values
  ('44444444-4444-4444-4444-444444444444', '{"seed": "secret"}');
insert into public.admin_audit_log (action) values ('test');
insert into realtime.messages (topic, extension) values ('test', 'broadcast');
refresh materialized view public.card_rankings;
refresh materialized view public.player_rankings;

-- ---------------------------------------------------------------- structure
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0, 'RLS est activé sur toutes les tables publiques');

-- ---------------------------------------------------------------- anonyme
set local role anon;
select is((select count(*)::int from public.cards), 1, 'anonyme : voit seulement les cartes actives');
select is((select count(*)::int from public.profiles), 0, 'anonyme : ne voit aucun profil');
select is((select count(*)::int from public.player_wallets), 0, 'anonyme : ne voit aucun portefeuille');
select is((select count(*)::int from public.card_rankings), 1, 'anonyme : lit le classement des cartes');
select throws_ok('select * from public.player_rankings', '42501', null,
  'anonyme : le classement des joueurs est réservé aux connectés');
reset role;

-- ---------------------------------------------------------------- alice
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is((select count(*)::int from public.profiles), 3, 'joueur : voit tous les profils publics');
select is((select dust from public.player_wallets), 10, 'joueur : voit son propre portefeuille');
select is((select count(*)::int from public.player_wallets), 1, 'joueur : ne voit pas le portefeuille des autres');
select is((select count(*)::int from public.player_private), 1, 'joueur : ne voit que ses données privées');
select is((select count(*)::int from public.battles), 1, 'joueur : voit son combat');
select is((select count(*)::int from public.battle_secrets), 0, 'joueur : ne voit jamais l''état secret');
select is((select count(*)::int from public.admin_audit_log), 0, 'joueur : pas de journal d''audit');
select is((select count(*)::int from public.player_rankings), 3, 'joueur : lit le classement des joueurs');

select throws_ok(
  $$insert into public.player_wallets (player_id, dust) values ('33333333-3333-3333-3333-333333333333', 999999)$$,
  '42501', null, 'joueur : ne peut pas créer de portefeuille');
select throws_ok($$update public.player_wallets set dust = 999999$$, '42501', null,
  'joueur : ne peut pas modifier son portefeuille');
select throws_ok($$update public.profiles set elo = 3000$$, '42501', null,
  'joueur : ne peut pas modifier son ELO');
select throws_ok($$delete from public.cards$$, '42501', null, 'joueur : ne peut pas supprimer de carte');
select throws_ok($$select public.check_rate_limit('x', 1, 60)$$, '42501', null,
  'joueur : ne peut pas appeler la limitation de débit');

-- Realtime : le sujet est fixé par connexion, d'où realtime.topic()
set local realtime.topic = 'battle:44444444-4444-4444-4444-444444444444';
select is((select count(*)::int from realtime.messages), 1, 'realtime : un participant reçoit son combat');
set local realtime.topic = 'battle:55555555-5555-5555-5555-555555555555';
select is((select count(*)::int from realtime.messages), 0, 'realtime : pas un combat inconnu');
set local realtime.topic = 'user:11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from realtime.messages), 1, 'realtime : reçoit son canal personnel');
set local realtime.topic = 'user:22222222-2222-2222-2222-222222222222';
select is((select count(*)::int from realtime.messages), 0, 'realtime : pas le canal d''un autre');
set local realtime.topic = 'battle:pas-un-uuid';
select is((select count(*)::int from realtime.messages), 0, 'realtime : sujet mal formé refusé');
reset role;

-- ---------------------------------------------------------------- chloé (hors combat)
set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.battles), 0, 'non-participant : ne voit pas le combat');
set local realtime.topic = 'battle:44444444-4444-4444-4444-444444444444';
select is((select count(*)::int from realtime.messages), 0, 'non-participant : ne reçoit pas le combat');
reset role;

-- ---------------------------------------------------------------- admin
set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated", "app_metadata": {"role": "admin"}}';
select is((select count(*)::int from public.admin_audit_log), 1, 'admin : lit le journal d''audit');
reset role;

select * from finish();
rollback;
