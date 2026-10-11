-- =============================================================================
-- MemeMasters – Défi du jour (2/2) : modèles de défis et news existantes
-- Un défi par jour et par joueur, tiré au hasard ; récompense : boosters en plus.
-- =============================================================================

insert into public.challenge_templates (code, type, target, reward_boosters, weight, params, is_active) values
  ('open_1', 'open_boosters', 1, 1, 3, '{"difficulty": "easy"}'::jsonb, true),
  ('open_3', 'open_boosters', 3, 2, 3, '{"difficulty": "medium"}'::jsonb, true),
  ('new_cards_3', 'new_cards', 3, 1, 3, '{"difficulty": "easy"}'::jsonb, true),
  ('new_cards_6', 'new_cards', 6, 2, 2, '{"difficulty": "medium"}'::jsonb, true),
  ('new_cards_10', 'new_cards', 10, 3, 1, '{"difficulty": "hard"}'::jsonb, true),
  ('sell_5', 'sell_copies', 5, 1, 2, '{"difficulty": "easy"}'::jsonb, true),
  ('sell_15', 'sell_copies', 15, 2, 2, '{"difficulty": "medium"}'::jsonb, true),
  ('sell_30', 'sell_copies', 30, 3, 1, '{"difficulty": "hard"}'::jsonb, true),
  ('evolve_1', 'evolve_card', 1, 2, 2, '{"difficulty": "medium"}'::jsonb, true),
  ('message_2', 'send_messages', 2, 1, 2, '{"difficulty": "easy"}'::jsonb, true),
  ('friend_1', 'add_friend', 1, 2, 1, '{"difficulty": "hard"}'::jsonb, true)
on conflict (code) do nothing;

-- Les défis prévus pour les batailles restent inactifs tant qu'elles n'existent pas.
update public.challenge_templates set is_active = false
where type in ('win_battles', 'play_battles', 'act_with_vibe', 'use_special', 'ko_cards', 'dust_action');

insert into public.news (published_at, kind, title, body) values
  ('2026-10-09T09:00:00Z', 'news', '{"fr": "Nouvel onglet Infos", "en": "New Info tab"}'::jsonb, '{"fr": "Raretés, classement des joueurs et news sont désormais réunis au même endroit. Choisis ton classement : autour de toi, dans ton rang ou dans le monde.", "en": "Rarities, player rankings and news are now in one place. Pick your ranking: around you, in your rank or worldwide."}'::jsonb),
  ('2026-10-08T09:00:00Z', 'change', '{"fr": "7 raretés et 3 boosters", "en": "7 rarities and 3 boosters"}'::jsonb, '{"fr": "Bienvenue aux raretés Brainrot et SuperBrainrot ! Les boosters journaliers, Super Boosters et Ultra Boosters ont chacun leur composition. La Godlevel, elle, ne s''obtient que par chance.", "en": "Welcome Brainrot and SuperBrainrot rarities! Daily boosters, Super Boosters and Ultra Boosters each have their own line-up. Godlevel cards can only be won by luck."}'::jsonb),
  ('2026-10-07T09:00:00Z', 'update', '{"fr": "7 langues et 4 thèmes", "en": "7 languages and 4 themes"}'::jsonb, '{"fr": "Le jeu parle désormais anglais, chinois, espagnol, arabe, français, portugais et allemand. Dans les réglages : thème clair, obscur, inversé ou personnalisé.", "en": "The game now speaks English, Chinese, Spanish, Arabic, French, Portuguese and German. In settings: light, dark, inverted or custom theme."}'::jsonb),
  ('2026-10-06T09:00:00Z', 'upcoming', '{"fr": "Bientôt : l''ouverture des boosters", "en": "Coming soon: opening boosters"}'::jsonb, '{"fr": "Déchire, retourne, collectionne : l''ouverture des boosters et la collection arrivent dans la prochaine mise à jour, suivies des batailles en temps réel.", "en": "Tear, flip, collect: opening boosters and the collection arrive in the next update, followed by real-time battles."}'::jsonb);
