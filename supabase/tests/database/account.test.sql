-- =============================================================================
-- Suppression définitive d'un compte : tout ce qui appartient au joueur
-- disparaît, ce qui concerne d'autres personnes est conservé sans lien.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(6);

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'part@test.local'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'reste@test.local');
insert into public.profiles (id, username) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'qui_part'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'qui_reste');
insert into public.player_private (player_id, timezone) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Europe/Paris');
insert into public.player_wallets (player_id, meme_money) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 42);
insert into public.trophy_history (player_id, trophies, rank, reason) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 0, 0, 'start');
insert into public.battles (id, mode, status, player_a, player_b, finished_at, winner_side) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'ranked', 'finished',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', now(), 'b');
insert into public.purchases (player_id, product_code, meme_money, amount_cents, currency, stripe_session_id, status)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'mm_20', 1, 99, 'eur', 'cs_test_1', 'paid');

-- Ce que fait l'application (deleteAccount) :
delete from auth.users where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select is((select count(*)::int from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0, 'le profil est supprimé');
select is((select count(*)::int from public.player_wallets where player_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0, 'le portefeuille est supprimé');
select is((select count(*)::int from public.trophy_history where player_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0, 'l''historique des trophées est supprimé');
select is((select player_a from public.battles where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'), null, 'le combat reste pour l''adversaire, sans lien');
select is((select count(*)::int from public.purchases where stripe_session_id = 'cs_test_1' and player_id is null), 1, 'l''achat est conservé (comptabilité), sans lien');
select is((select count(*)::int from public.profiles where username = 'qui_reste'), 1, 'l''autre joueur n''est pas touché');

select * from finish();
rollback;
