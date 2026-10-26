@AGENTS.md

# MemeMasters — mémoire du projet pour Claude Code

Ce fichier est lu automatiquement au début de chaque session. Il contient ce que le code ne dit pas : les choix du propriétaire, les règles à respecter et les pièges déjà rencontrés. **Lis-le en entier avant toute modification.** Pour le détail et l'historique de chaque choix, voir `DECISIONS.md` ; pour l'installation et le déploiement, `README.md`.

## 1. Le projet en bref

Jeu web multijoueur de cartes à collectionner sur le thème des memes (PWA installable sur téléphone et ordinateur). Les joueurs ouvrent des boosters, collectionnent, font évoluer leurs cartes, se classent, se font des amis et discutent. Public jeune et mobile ; interface en 7 langues.

- **Propriétaire** : un développeur seul, francophone, qui valide chaque fonctionnalité. **Toujours répondre en français**, clairement, sans jargon inutile.
- **Nom du jeu** : **« Battle Meme »**, provisoire (un jeu du même nom existe : il changera encore). Constantes uniques `GAME_CONFIG.GAME_NAME` et `GAME_SHORT_NAME` (`src/config/game.config.ts`) ; ne jamais écrire le nom en dur dans l'interface. Seules exceptions, à mettre à jour à chaque changement de nom : les modèles d'e-mails `supabase/templates/*.html` (à recoller ensuite dans Supabase, avec le « Sender name » du SMTP) et le pseudo réservé de `src/lib/validation/username.ts`. Le dépôt, `package.json`, les tables, les cookies `mm-…` et les documents de `docs/` gardent l'ancien nom technique « MemeMasters ».
- **État** : l'essentiel est en place (comptes, cartes, boosters, collection, évolutions, revente, classements, amis, messagerie, défi du jour, communauté, tableau de bord). **Restent** : le battle royale (conception validée, phases 1 « moteur », 2 « bots » et 3 « jouabilité » faites, ajustements d'avant la phase 4 faits le 2026-10-26 et soumis au propriétaire, phases 4 à 7 à venir, voir §8), les paiements Stripe, les finitions (performances, audit de sécurité).

## 2. Règles de travail (à suivre à chaque tâche)

1. **Ne jamais deviner une règle de jeu.** Si une demande touche l'économie (prix, taux, récompenses), les batailles ou le comportement visible par les joueurs et que ce fichier ou `DECISIONS.md` ne tranche pas, demander au propriétaire avant de coder.
2. **Toute logique sensible s'exécute côté serveur** : tirages des boosters, ventes, évolutions, récompenses, compteurs quotidiens, droits d'administration, paiements. Le client affiche et envoie des intentions ; il ne décide jamais.
3. **Lire le code existant avant d'écrire** : réutiliser les utilitaires (§6, §10) au lieu d'en recréer.
4. **Petites étapes vérifiées** : après chaque changement, lancer la checklist du §13. Ne jamais terminer une tâche avec une erreur de type, de lint ou un test rouge.
5. **Toute nouvelle phrase affichée existe dans les 7 langues** (§9). Un texte en dur dans un composant est un bug (seule exception : le tableau de bord `/admin`, en français uniquement).
6. **Consigner les décisions** : toute décision non triviale s'ajoute en fin de `DECISIONS.md` (section par sujet, en français, avec le « pourquoi »).
7. **Ne pas réécrire ce qui marche** sans demande explicite, et ne jamais supprimer une fonctionnalité sans accord.
8. **Après la tâche**, résumer au propriétaire ce qui a changé, comment le tester, et s'il doit lancer `npm install` ou `npx supabase db push`.
9. **Annoncer avant de modifier, puis attendre l'accord** (règle permanente du propriétaire) : annoncer les fichiers concernés et ce qui change dans chacun ; **attendre son accord quand plusieurs fichiers sont touchés**. Pour un choix technique, proposer les options avec leurs avantages et leurs risques, et une recommandation.
10. **Tenir ce fichier à jour** : toute nouvelle règle ou décision durable est ajoutée ici (et détaillée dans `DECISIONS.md`) dans la même tâche.
11. **Vérifier à l'exécution, pas seulement à la compilation** (« ne fais pas d'erreurs ») : une erreur d'affichage d'un composant serveur n'apparaît ni au typecheck ni au build. Afficher les pages touchées (`/apercu?vue=…` avec `npm run dev`) et lire le journal du serveur ; pour la base, tester les écritures dans une transaction annulée. Pour un parcours de joueur connecté (accord du propriétaire donné le 2026-10-24) : `npm run build && npm start`, Chrome local piloté par `puppeteer-core` installé dans le dossier temporaire (jamais dans le projet), compte de test créé par l'API d'administration de Supabase puis supprimé, avec vérification qu'il ne reste aucune ligne.
12. **Rigueur** : vérifier chaque API de Next.js 16 dans `node_modules/next/dist/docs/` plutôt que de se fier à sa mémoire ; écrire les tests **avant** la logique de jeu.

## 3. Commandes

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement (vérifie d'abord les dépendances : `predev`). |
| `npm run check` | Types + lint + tests unitaires (`typecheck`, `lint`, `test`). |
| `npm run typecheck` | `tsc --noEmit`. Sur une copie neuve, lancer d'abord `npx next typegen` (sinon erreurs « `PageProps` introuvable »). |
| `npm run lint` / `npm test` | ESLint / Vitest. |
| `npm run build` | Build de production (à lancer avant de livrer un changement important). |
| `npm run db:check-local` | Applique **toutes** les migrations sur un PostgreSQL local et lance les tests pgTAP, sans Docker. |
| `npm run db:check` / `npm run db:status` | Migrations à appliquer sur Supabase (simulation) / état local vs distant. |
| `npx supabase db push` | Applique les nouvelles migrations sur la base Supabase du propriétaire. |
| `npm run cards:sql` | Régénère la migration du jeu de cartes de départ à partir de `src/content/cards/starter-set.ts` (refuse d'écraser une migration déjà livrée : une modification passe par une nouvelle migration). |
| `npm run br:bench [-- N]` | Banc d'essai du moteur du battle royale : N parties complètes à 50 participants (pilote de test), coût par tick, temps de rejeu, part des éliminations par la zone. |
| `npm run bots:tournament [-- --rapide]` | Tournoi de bots (3 600 parties, environ 25 min sur 7 cœurs ; `--rapide` : 10 %, seulement indicatif) : vérifie les 8 seuils de la conception (§7.7) et échoue s'ils ne sont pas tenus. À relancer après tout changement des réglages du battle royale ou de l'IA. |
| `npm run doctor` | Diagnostic de la configuration (`.env.local`, connexion). |
| `npm run tunnel` | Tunnel HTTPS Cloudflare (tester l'installation sur téléphone, la webcam). |

Pages de prévisualisation sans compte (développement uniquement) : `/apercu?vue=accueil|profil|reglages|boutique|infos|joueur&onglet=…&trophees=…&pays=…`.

## 4. Pile technique et versions

Next.js **16.3.8** (App Router, Turbopack, `src/proxy.ts` au lieu de `middleware.ts`), React **19.2**, TypeScript strict, Tailwind CSS **4** (pas de `tailwind.config` : le thème est dans `src/app/globals.css`), next-intl **4**, Supabase (Auth, PostgreSQL, Storage), **postgres.js** pour les transactions serveur, **Zod 4** (`z.uuid()`, `z.email()`…), Motion 14, Zustand 5, **PixiJS 8.22** (rendu des parties, chargé seulement au lancement d'une partie), Serwist (`@serwist/turbopack`) pour le service worker, Vitest 5, pgTAP, sharp (images), qrcode. Déploiement visé : Vercel + Supabase.

Next.js 16 diffère de ce que tu connais : consulter `node_modules/next/dist/docs/` avant d'utiliser une API inhabituelle (cf. `AGENTS.md`).

## 5. Arborescence

```
src/
  app/                 Pages et routes API (App Router)
    (auth)/            connexion, inscription, mot de passe (actions serveur dans actions.ts)
    (jeu)/             accueil (page.tsx), boutique, infos, parametres, profil/[pseudo] (cadre joueur)
    admin/             tableau de bord (Super Admin / admins) : page.tsx, actions.ts, CardEditor
    api/               routes JSON (une action = une route ; voir §6)
    apercu/            prévisualisation sans compte (développement)
  components/          par domaine : card, collection, booster, infos, player, friends, messages,
                       moderation, community, challenges, install, pwa, layout, ui, home, legal,
                       match (Entraînement, écran de partie : rendu PixiJS, interface, commandes tactiles, menu, fin, sons)
  config/              game.config.ts (réglages validés par Zod), rarities.ts, ranks.ts, shop.ts, legal.config.ts, audio.ts (musiques)
  content/cards/       starter-set.ts : les 40 cartes de départ
  lib/
    server/            tout le code serveur (marqué "server-only") : base, auth, jeu, administration
    economy/           logique pure et testée : boosters, évolutions et revente, tirage du défi,
                       récompenses du battle royale selon la place (placement.ts)
    br/                moteur du battle royale, pur et déterministe, en entiers (§8)
    br-client/         partie dans le navigateur, sans affichage et testée : commandes, rythme, Entraînement, vision,
                       événements d'un tick (tirs, couteau, impacts, caisses : effets et sons)
    client/            côté navigateur : appels d'API, attente, réglages du Battle Royale (touches, volumes), bruitages, musique
    i18n/ theme/ navigation/ pwa/ time/ validation/ art/ client/ cards/ player/
messages/              traductions : fr (référence), en, es, pt, de, zh, ar
supabase/migrations/   migrations SQL (ordre chronologique, jamais modifiées une fois livrées)
supabase/tests/        tests pgTAP (rls.test.sql, account.test.sql)
scripts/               check-sql.sh, doctor, génération des cartes et des icônes PWA
docs/                  guides pour le propriétaire (Google OAuth et e-mails, Stripe)
```

## 6. Architecture côté serveur

- **Base de données** : `src/lib/server/db.ts` (`sql()`), connexion directe qui **contourne RLS** : chaque fonction vérifie elle-même l'identité et les droits. `DATABASE_URL` pointe sur le pooler Supabase en **mode transaction (port 6543)** ; une adresse en 5432 est convertie par `transactionPoolerUrl()`. **Jamais le mode session** sur Vercel : il n'accepte que 15 clients en tout (mesuré le 2026-10-24), les instances Vercel le saturaient et les pages plantaient (« Oups, cette page a planté »). En mode transaction, le pooler perd les réponses de requêtes envoyées en rafale sur une connexion, d'où **deux groupes de connexions** : requêtes isolées avec `max_pipeline: 0` (une à la fois), et transactions (`sql().begin`, réassigné vers un second groupe sans `max_pipeline`, car `max_pipeline: 0` casse `begin` : erreur `UNSAFE_TRANSACTION`). Ne pas modifier ce montage sans refaire le test de charge (1 000 requêtes simultanées sur le vrai pooler, décrit dans `DECISIONS.md`).
- **Transactions** : `sql().begin(async (tx) => …)` pour tout ce qui doit être tout-ou-rien ; verrouiller les lignes lues puis modifiées (`for update`).
- **Routes API** (`src/app/api/**/route.ts`), toujours sur ce modèle :
  ```ts
  export const POST = withErrors(async (request: Request) => {
    assertSameOrigin(request);                       // anti-CSRF
    const { player } = await apiPlayer();            // session + profil + consentement + non banni
    if (!(await consumeRateLimit(RATE_LIMITS.xxx, player.id))) throw new ApiError(429, "rate_limited");
    const data = await readJson(request, schemaZod); // validation des entrées
    return NextResponse.json(await fonctionMetier(player, data));
  });
  ```
  Les erreurs métier lèvent `new ApiError(status, "code_erreur")` ; chaque code doit avoir sa phrase dans `errors.*` des 7 langues.
- **Pages** : `requirePlayer()` (redirige vers la connexion, `/bienvenue` ou `/banni`), `requireAdmin()` / `requireAdmin("superadmin")` (renvoie une **404** aux autres : l'existence du tableau de bord n'est pas révélée).
- **Groupe `(jeu)`** : il contient l'Accueil (`(jeu)/page.tsx`), pour que le cadre du joueur (rang, trophées, MemeMoney, navigation) reste affiché pendant le chargement. Son layout laisse donc passer les visiteurs sans cadre (seul l'Accueil vitrine leur est montré) : **chaque page du groupe doit appeler `requirePlayer()` elle-même** (vérifié par `src/app/(jeu)/guards.test.ts` ; `src/proxy.ts` protège aussi `/boutique`, `/infos`, `/profil`, `/parametres`).
- **Limites de débit** : déclarées dans `RATE_LIMITS` (`src/lib/server/rate-limit.ts`) ; toute nouvelle route sensible en reçoit une.
- **Captcha** : Cloudflare Turnstile sur connexion, inscription, mot de passe oublié et contact (`verifyCaptcha`, composant `Captcha`). En local sans clés : clés de test de Cloudflare automatiques. Ne pas activer en plus le captcha de Supabase (un jeton ne sert qu'une fois).
- **Adresse du site** : `publicBaseUrl()` (`site-url.ts`) suit l'adresse réelle de la requête (Vercel, tunnel, ou adresse Wi-Fi en local) ; elle alimente le QR code d'installation.
- **Illustrations** : `card-art.ts` redimensionne (sharp) et téléverse dans le bucket public `card-art` de Supabase Storage, avec un nom unique à chaque envoi.

## 7. Base de données et migrations

- **Une migration = un nouveau fichier** `supabase/migrations/AAAAMMJJHHMMSS_nom_explicite.sql`. Ne jamais modifier une migration déjà livrée (le propriétaire l'a peut-être appliquée).
- **Ajout d'une valeur à un type `enum`** : dans une migration **séparée** de celle qui utilise la nouvelle valeur (PostgreSQL l'interdit dans la même transaction).
- **Toute nouvelle table** : `enable row level security`, politiques de lecture minimales, `revoke insert, update, delete … from anon, authenticated` (les écritures passent par le serveur), **et** des assertions dans `supabase/tests/database/rls.test.sql` (mettre à jour `select plan(N)`). Vérifier avec `npm run db:check-local`.
- **Pièges postgres.js déjà rencontrés** :
  - ne pas passer `"-infinity"` en paramètre de date (erreur de sérialisation) : passer `null` et écrire `(${d}::timestamptz is null or col > ${d}::timestamptz)` ;
  - PostgreSQL stocke les microsecondes, JavaScript les millisecondes : comparer avec `date_trunc('milliseconds', col)` quand une date relue sert de repère ;
  - les `count()` et `sum()` reviennent en `bigint` (texte) : caster en `::int` dans la requête ;
  - **jamais `${JSON.stringify(objet)}::jsonb`** : la chaîne est encodée une seconde fois et la base stocke un texte, pas un objet (les contraintes `jsonb_typeof(…) = 'object'` refusent alors l'écriture). Écrire `${JSON.stringify(objet)}::text::jsonb`, ou `${sql().json(objet)}`.
- **Tables principales** : `profiles` (pseudo, trophées, `last_seen_at`), `player_private` (fuseau, langue, thème, `role` player/admin, `banned_at`, `seen` des notifications), `player_wallets` (MemeMoney, `meme_money_cents`, boosters), `cards`, `user_cards` (`quantity`, `upgrade_level` 0 à 3), `booster_openings`, `daily_usage`, `economy_ledger`, `trophy_history`, `friendships`, `player_blocks`, `player_reports`, `messages`, `conversation_hides`, `news`, `challenge_templates`, `player_challenges`, `community_cards`, `community_votes`, `admin_requests`, `admin_audit_log`, `contact_messages`, `rate_limits`, `br_characters` (personnage du Battle Royale choisi par le joueur : une carte qu'il possède). Bucket Storage public `card-art` (illustrations).

## 8. Batailles : ATTENTION

**Concept choisi par le propriétaire (2026-10-24)** : un **battle royale 2D vu de dessus, jusqu'à 100 participants** (50 depuis le 2026-10-26, choix du propriétaire) ; chaque carte est un personnage jouable ; partie classée en solo contre des bots portant les personnages de vrais joueurs, parties entre amis en pair-à-pair. Cahier des charges : `docs/PROMPT_CLAUDE_CODE_Battle_Meme.md` ; conception **validée le 2026-10-24** (propositions du §16 retenues) : `docs/BATTLE_ROYALE_CONCEPTION.md`. Travail par phases (0 conception → 7 finitions) ; le propriétaire valide chaque phase avant la suivante.

- **Phase 1 (moteur) faite** : `src/lib/br/`. `fixed.ts` (trigonométrie sur 256 pas en tables Q14, arc tangente, racine et divisions entières exactes : **seul fichier du moteur où `/` est permis**), `rng.ts` (xoshiro128**, flux séparés : carte, butin, zone, combats, un par bot), `commands.ts` (commande de 3 octets par tick, plages, tranches de 400 ticks), `rules.ts` (configuration → ticks et sous-unités, 1 unité = 16), `character.ts` (carte → personnage : compression κ des statistiques, de la puissance de la capacité et de l'intensité du passif ; part du bonus d'évolution ; capacité, passif), `map.ts` (carte générée, ligne de vue, collisions), `state.ts` (état en tableaux d'entiers, copie, empreinte FNV-1a), `engine.ts` (`createMatch`, `advance` en place, `step` pur), `replay.ts` (rejeu sans affichage), `test-driver.ts` (pilote de test : **pas** l'IA des bots, jamais importé par le code de production).
- **Interdits dans le moteur** (ESLint et `purity.test.ts`) : fonctions flottantes de `Math`, nombres décimaux, `/` hors de `fixed.ts`, `Date`, `performance`, minuteries. Ordre d'itération fixe (participants par emplacement, projectiles par création).
- **`ENGINE_VERSION`** (`engine.ts`) : à augmenter à chaque changement qui modifie le résultat d'une partie ; le test d'empreinte de `replay.test.ts` échoue pour le rappeler (puis `npx vitest run -u`).
- **Réglages** : `GAME_CONFIG.BATTLE_ROYALE` (validé par Zod), dont `ECONOMY` (trophées et MemeMoney par place, bonus d'élimination, effet du rang, abandon, plafond quotidien) appliquée par `src/lib/economy/placement.ts` (pages d'Infos dès maintenant, serveur en phase 4). Les anciens champs `TROPHIES.WIN/LOSS/DRAW`, `MEME_MONEY.WIN_REWARD`, `TEAM_SIZE`… restent jusqu'à la phase 4 mais ne sont plus affichés.
- **Phase 2 (bots) faite** : `bot.ts` (IA par scores d'utilité, 4 décisions par seconde, perception honnête, personnalités, difficulté selon les trophées), `nav.ts` (chemins A* bornés et carte des distances vers la zone), `grid.ts` (grille spatiale), `vision.ts` ; tournoi `npm run bots:tournament` (`src/lib/br-tournament/`, `scripts/bots-tournament.mts`) : **les 8 seuils de la conception doivent passer** après tout changement des réglages, du moteur ou de l'IA.
- **Équilibrage (2026-10-25, détail dans DECISIONS.md)** : la régénération n'est qu'un filet de sécurité (8 % des PV max au plus, après 12 s sans être touché) ; κ = 10 % comprime aussi la puissance des capacités et l'intensité des passifs ; le bonus d'évolution compte à 15 % en bataille. **Trousse de soins : soin immédiat au ramassage** (+40 PV), jamais ramassée avec tous ses PV, aucun bouton de soin (bit 4 des commandes réservé). Les objets inutiles (soin, gilet, munitions pleins) restent au sol et ne gênent pas le ramassage d'un autre. Caisses : 2 cases libres autour ; pas de cloison au ras d'une porte.
- **Ajustements du 2026-10-26 (avant la phase 4, détail dans DECISIONS.md)** : **50 participants** (carte 124 × 124) ; vitesse 130 + 1,3 × VIT ; **trois armes en boucle** : arme de départ → arme ramassée → **couteau de combat** (`KNIFE`, après le projectile de brûlure : 20 dégâts toutes les 0,5 s, portée 50, arc devant soi, touche aussi la première caisse sur sa trajectoire) ; **caisses destructibles** (40 PV, `s.crates` ; brisée, elle devient du sol et lâche un objet : soin 30, munitions 25, gilet 15, arme 12, boisson 10, lunette 8) ; **boisson énergisante** (+20 % de vitesse pendant 15 s) ; **lunettes ×2 (60 %) / ×4 (40 %)** : champ de vision agrandi (même règle pour les bots ; la vue du joueur s'éloigne). Bots : couteau au contact s'il frappe plus fort que l'arme à feu (gardé jusqu'à 40 unités au-delà, sinon ils changeaient d'arme à chaque pas), ouverture des caisses sans ennemi en vue. `ENGINE_VERSION` 4, `CONFIG_VERSION` 4 ; seuil du tournoi pour le Top 1 par carte : 1 à 4 % (attendu 2 %). **Scroll 25 % plus lent** (fermeture en 8 min 45 s au lieu de 7 min) : proposé pour tenir la durée de 5 à 8 min avec 50 participants, **à valider par le propriétaire**.
- **Mesures** (portable, Node 24) : partie complète à 50 participants ≈ 0,15 ms par tick en moyenne (tournoi du 2026-10-26, 8 seuils tenus) ; rejeu identique.
- **Ancien code « arène à tours » supprimé** (`src/lib/battle/`, `src/components/battle/`, page `/bataille`). Ses tables (`battles`, `decks`, `matchmaking_queue`…) restent jusqu'à leur suppression par une nouvelle migration en phase 4.
- **Phase 3 (jouabilité) faite** : l'**Entraînement est dans la page Battle Royale de l'accueil, ouvert à tous les joueurs** (2026-10-26 ; `TrainingPanel` : seule la difficulté se choisit, le personnage se choisit dans la Collection) ; l'écran de partie s'ouvre par-dessus, **rendu dans `<body>` par un portail** (une page glissante, transformée, l'enfermerait) ; la page `/partie` est supprimée. `src/lib/br-client/` (sans affichage, testé) : `input.ts` (clavier, souris, joysticks → commande ; un appui bref part sur un tick puis est relâché), `loop.ts` (20 ticks/s sur l'horloge réelle, rattrapage par paquets, pas de pause), `training.ts` (participants − 1 bots « BOT », difficulté Facile / Normal / Difficile), `events.ts` (événements d'un tick pour les effets et les sons), `view.ts` (**ne montrer au joueur que ce que les règles de vision des bots permettent**, interface, dégâts, objet à ramasser). `src/components/match/` : `renderer.ts` (PixiJS, importé dynamiquement : carte en blocs de 16 × 16, textes dans une couche écran, bandes au-delà du champ de vision du moteur), `atlas.ts` (portraits dans une seule image), `MatchScreen`, `Hud`, `TouchControls`, `MatchMenu`, `EndScreen`, `TrainingPanel`, `minimap.ts` (clic : carte agrandie), `audio-director.ts`. Commandes par défaut : ZQSD/WASD (touches physiques) ou flèches, souris, clic gauche tir, **clic droit ramasser, C capacité**, R recharger, molette/Tab arme suivante, **1/2/3** arme de départ / arme ramassée / couteau, Échap menu ; aucun bouton de soin. **Touches modifiables et volumes dans Réglages → Battle Royale** (`src/lib/client/br-settings.ts`, gardés sur l'appareil). Clic sur la mini-carte : carte agrandie (Échap ou clic la referme ; la partie continue). Pendant une partie, `<html data-mm-match>` est posé (aucune invite de mise à jour ne doit couper une partie).
- **Personnage** : choisi dans la Collection (« Choisir pour le Battle Royale », route `/api/battle/character`, table `br_characters`, carte possédée vérifiée côté serveur) ; sans personnage, l'Entraînement invite à en choisir un.
- **Sons** : bruitages synthétisés (Web Audio, `src/lib/client/sfx.ts`), volume selon la distance et placés à gauche ou à droite (`audio-director.ts`) ; musique : fichiers à déposer dans `public/audio` et à déclarer dans `src/config/audio.ts` (le propriétaire les composera).
- La page Battle Royale de l'accueil propose l'Entraînement ; « Classée » et « Entre amis » affichent « Bientôt » jusqu'à la phase 5. Les trophées et la MemeMoney de bataille ne bougent pas avant la phase 4 (partie classée vérifiée par le serveur ; le client ne décide jamais).

## 9. Traductions (next-intl, 7 langues)

- Fichiers `messages/{fr,en,es,pt,de,zh,ar}.json`, **mêmes clés partout** (le français est la référence). Le test `src/lib/i18n/messages.test.ts` échoue dès qu'une clé manque ou est en trop dans une langue.
- Toute nouvelle clé : écrite dans les 7 fichiers et vraiment traduite (pas de français recopié). Pluriels au format ICU ; l'arabe utilise les formes `zero/one/two/few/many/other`, le chinois seulement `other`.
- Un message qui contient `{param}` exige ce paramètre à l'appel (sinon erreur d'exécution). Si on retire un paramètre d'un texte, le retirer dans les 7 langues.
- L'arabe s'affiche de droite à gauche : utiliser les propriétés logiques (`ms-`, `me-`, `start-`, `end-`) et `rtl:` quand une flèche doit s'inverser.
- Textes des parties (préparation, interface, commandes, menu, fil des éliminations, fin) : espace `match` ; la zone s'appelle « le Scroll » dans toutes les langues.
- Textes du battle royale : espace `battleRoyale` (noms des armes et des objets, phrases des capacités et des passifs, utilisées par `src/components/infos/battle-texts.ts`). Noms **réalistes et génériques** (2026-10-26) : Pistolet, Fusil à pompe, Mitraillette, Fusil de précision, Couteau de combat, Trousse de soins, Gilet pare-balles, Boisson énergisante, Lunette ×N ; jamais de marque ni de nom d'un autre jeu. Le nom de la page de l'accueil est « Battle Royale » (« 大逃杀 » en chinois, « باتل رويال » en arabe).
- Nombres signés ou tranches (« +40 », « 2 – 3 ») dans une phrase ou un tableau : les isoler avec `<bdi dir="ltr">`, sinon l'arabe les inverse.
- **Vocabulaire imposé** (dans toutes les langues) : « exemplaires » (jamais « doublons ») ; « évolution / faire évoluer » (jamais « amélioration ») ; « MemeMoney » ; « boosters » ; tutoiement en français.
- Le tableau de bord `/admin` est volontairement en français uniquement.

## 10. Interface et style

- **Mobile d'abord** : tout doit fonctionner au pouce sur 375 px de large ; zones tactiles d'au moins 44 px (`min-h-11`) ; contenu jusqu'à 1 280 px (`max-w-7xl`) sur grand écran.
- **Sobriété** : pas d'émojis décoratifs (seuls ✓, ✕, les symboles de rareté et les étoiles d'évolution) ; contours de 2 px, ombres portées de 3 px ; ton amusant mais pas criard.
- **Couleurs** : uniquement via les variables du thème (`bg-paper`, `bg-surface`, `text-ink`, `text-ink-soft`, `bg-candy`, `border-ink`, `--color-*`…), car 5 thèmes existent (clair, sombre, inversé, personnalisé, aléatoire). Pointeur de souris : celui du système (le pointeur personnalisé a été abandonné : ne pas en recréer). Pas de couleur codée en dur hors identité visuelle (raretés, insignes).
- **Accessibilité** : contrastes suffisants, navigation au clavier, `aria-*` sur les contrôles, `prefers-reduced-motion` respecté (classes `motion-reduce:`, Motion en `reducedMotion="user"`).
- **Composants à réutiliser** : `MemeCard` / `InteractiveCard` (carte ; props `level` 0 à 3, `quantity`, `actions`), `SlideDeck` (pages glissantes avec onglets, URL `?vue=`, badges chiffrés), `NotificationDot`, `Button` / `ButtonLink`, `SubmitButton`, `Spinner`, `toast` (bulles de confirmation et d'erreur, `src/components/ui/Toast.tsx`), `PasswordField`, `Captcha`, `PlayerCounts`, `FullscreenToggle`, `ImagePicker`, `InfoSection` / `InfoTable` (pages d'Infos), `CardDetailDialog` (carte agrandie), `LegalInfo` (liens légaux), `markBusy` (`src/lib/client/busy.ts`, élément « en cours »), `postJson` (`src/lib/client/api.ts`) pour appeler les routes, `src/lib/client/errors.ts` pour traduire un code d'erreur.
- **Attente** (« le jeu doit paraître rapide ») :
  - changement de page : barre de chargement en haut dès le clic, cercle sur le lien cliqué s'il tarde, puis écran d'attente des cartes (`loading.tsx`, visible seulement après 0,18 s) **dans le cadre du jeu** : `(jeu)/loading.tsx` entre deux pages du jeu, `PlayerLoading` (`app/loading.tsx`, `admin/loading.tsx`) en entrant dans l'Espace Admin ou en revenant au jeu ; plein écran seulement pour un visiteur ;
  - élément « en cours » (`src/lib/client/busy.ts`, attribut `data-mm-busy`) : clics bloqués aussitôt, puis après 0,15 s un cercle tournant remplace son contenu sans changer sa taille. `data-mm-busy-style="overlay"` garde le contenu visible, atténué (sachet). C'est automatique pour `postJson`/`postForm`, **tous les liens internes** (`NavigationProgress`), les navigations lancées par `startNavigationProgress()`, `Button pending` et `SubmitButton` (seul le bouton pressé tourne quand un formulaire en a plusieurs) ; pour un autre cas, appeler `markBusy(élément)` ou afficher `Spinner` (liste qui se charge).
  - `NavigationProgress` écoute les clics **à la capture** : un `<Link>` de Next.js annule l'événement (`preventDefault`) avant tout écouteur ordinaire du document (la barre et le cercle ne démarraient jamais).
  - Garder ce fonctionnement pour toute nouvelle page ou action.
- **Pas de pied de page dans le compte joueur** (comme un jeu vidéo) : liens légaux, contact et droits sont en bas des Réglages (`LegalInfo compact`). Le pied de page (`SiteFooter`) reste sur la vitrine, la connexion et l'inscription.
- **Thème** : un changement fait dans les Réglages passe par `applyLocalAppearance` ; `PreferenceSync` ignore un cadre de page préparé avant ce changement (`renderedAt`), sinon les pages gardées en mémoire remettaient l'ancien thème.
- **Hors ligne** : ajouter la classe `mm-online-only` à tout élément qui demande le serveur (il est grisé quand le réseau manque).
- **Écran de partie** (ouvert depuis la page Battle Royale) : plein écran, `touch-none`, fond `--mm-night` ; interface aux couleurs du thème (`bg-surface/90`, `border-ink`) ; joysticks à gauche et à droite **physiques** (pas `start`/`end` : c'est la position des pouces, même en arabe) ; boutons tactiles de 56 px ; message « Tourne ton téléphone » en portrait sur écran tactile. Les couleurs du monde (herbe, parquet, briques, eau, buissons, caisses, Scroll) sont l'identité visuelle de la partie et ne suivent pas le thème, comme les cartes ; chaque carte a sa finition d'arme (dorée pour une godlevel). Effets : flashs, traceurs, étincelles, éclats de bois, coups de couteau, éliminations, halo doré « capacité prête » (visible de tous), légère secousse quand on est touché ; **animations réduites** : ni secousse, ni eau qui ondule, ni halo qui pulse.
- **Pages glissantes existantes** : Accueil (Collection | Boosters | Battle Royale ; Boosters par défaut ; clé `batailles` gardée dans `?vue=` ; toutes aux couleurs du thème : panneau `bg-surface`, fond intérieur `bg-paper`, cases `bg-surface`, jamais de rose ni de jaune codés en dur) ; Infos (Carte, Raretés, Évolutions, **Classement** par défaut, Rangs, Trophées, MemeMoney, News) ; Profil (Profil, Amis, Messages, Communauté). Navigation du bas : Boutique, Infos, Accueil, Profil, Réglages.
- **Notifications** : les points rouges affichent un nombre, calculés côté serveur par `getBadges()` ; une notification vue est marquée par `/api/seen`, et `router.refresh()` n'est appelé que lorsqu'une notification est réellement consommée.

## 11. Règles du jeu à respecter (valeurs dans `src/config/`)

- **5 raretés** : commune, rare, épique, légendaire, godlevel (brainrot et superbrainrot fusionnées dans légendaire le 2026-10-26, migration `20261026000200_cinq_raretes.sql` ; les joueurs gardent leurs exemplaires et leurs niveaux). Taux et compositions des boosters dans `GAME_CONFIG.BOOSTERS` ; taux affichés publiquement (obligation légale).
- **Boosters** : 10 cartes ; 3 boosters journaliers gratuits (remis à minuit, fuseau du joueur) ; « Booster en plus », Super Booster et Ultra Booster achetés en MemeMoney ; pity : légendaire garantie au 10e booster journalier sans légendaire. Le **défi du jour** (un par jour et par joueur, tiré au hasard) ne donne que des « boosters en plus » ; affiché en une phrase « défi = récompense » (« Ouvre 1 booster = 1 booster en plus »). **Ouverture** : un seul clic sur le sachet (au centre de la page Boosters) ouvre le booster ; la fenêtre montre directement les 10 cartes et se ferme d'un clic en dehors. Page Boosters volontairement épurée : pas de titre d'achat, pas de solde (il est en haut de l'écran), pas de « Au moins 1 … » ni « Il te manque … ».
- **Carte agrandie** : seul un clic en dehors de la carte (ou Échap) la ferme ; un clic sur la carte ne fait rien.
- **Statistiques des cartes** : PV, ATQ, DÉF, VIT, une attaque (puissance), une attaque spéciale (puissance + coût en énergie), une défense (effet `heal` soin, `reflect` renvoi de dégâts, `dodge` esquive, `cleanse` annule les effets négatifs, `recharge` +1 énergie ; schémas Zod dans `src/lib/validation/card.ts`). Budget de statistiques par rareté vérifié par `checkBudget` et par les tests du jeu de départ. **Plus de vibes** (supprimées du code et de la base).
- **Exemplaires** : le premier exemplaire d'une carte reste toujours dans la collection. Les exemplaires en trop servent à **faire évoluer** (Dorée ★, Dorée ★★, Divine ★★★ ; coûts par rareté dans `DUPLICATES.UPGRADES` ; bonus de statistiques +3 / +6 / +10 %) ou à **vendre** (prix bas en centièmes de MemeMoney, fractions conservées ; plafond quotidien de 20 MemeMoney pour communes, rares et épiques).
- **MemeMoney** : monnaie fermée, sans valeur réelle, jamais échangeable entre joueurs ni reconvertible en argent. C'est une règle légale essentielle des boosters payants : ne jamais créer de passerelle.
- **Rangs** : 10 rangs, un tous les 1 000 trophées ; récompenses données une seule fois par rang (`src/config/ranks.ts`).
- **Battle Royale** (validé, appliqué à partir de la phase 4) : trophées et MemeMoney selon la place finale (`GAME_CONFIG.BATTLE_ROYALE.ECONOMY` : Top 1 +40 … −12 ; +1 par élimination jusqu'à +5 dans la première moitié ; gains −5 % et pertes +10 % par rang ; MemeMoney du Top 1 au Top 25, 15 par jour au plus) ; abandon = élimination à la place du moment, −5 trophées, aucune MemeMoney ; parties entre amis et Entraînement sans récompense ; écart de rareté borné (compression κ = 10 % des statistiques, capacités et passifs ; bonus d'évolution compté à 15 %), mesuré par le tournoi de bots (godlevel ≤ ×1,3 de Top 1 qu'une commune, ★★★ ≤ ×1,15).
- **Social** : amis (200 au plus, 50 demandes en attente), messages (500 caractères, 3 messages au plus à un non-ami tant qu'il n'a pas répondu), blocage (coupe amitié, demandes et messages dans les deux sens), signalements (traités dans le tableau de bord).
- **Communauté** : un joueur propose une carte (2 propositions en cours, 3 par jour), l'équipe la vérifie, tout le monde vote (une voix déplaçable, jamais pour sa propre carte), la plus votée peut sortir dans le jeu.
- **Achats en argent réel** (phase 5, pas encore actifs) : 18 ans et plus, plafond de dépenses sur 30 jours, pays bloqués, webhooks Stripe vérifiés par signature. Voir `docs/Guide_2_Stripe_Paiements_et_MemeMoney.md`.

## 12. Rôles et administration

- **Joueur**, **admin** (`player_private.role = 'admin'`, nommé par le Super Admin depuis le tableau de bord), **Super Admin** (le créateur) : désigné uniquement par la variable d'environnement `SUPER_ADMIN_IDS` (identifiants de comptes séparés par des virgules), lue côté serveur par `isSuperAdminId()`. Il n'existe ni page ni mot de passe spécial ; ne jamais en créer.
- **Droits** : un admin gère les joueurs (ni les autres admins, ni le Super Admin, ni son propre compte ; l'e-mail des membres de l'équipe lui est masqué). Ses actions importantes (cartes, ressources d'un joueur, suppression de compte, news, défis, sortie d'une carte de la Communauté) créent une **demande** (`admin_requests`) que le Super Admin valide ; la modération urgente (bannir, traiter un signalement ou un contact) est immédiate.
- **Passage d'un espace à l'autre** : dans les Réglages, un seul bouton « Espace Admin » (admin) ou « Espace Super Admin » ; dans le tableau de bord, un bouton « Espace Joueur » (vers les Réglages) à la place du fil d'Ariane.
- Chaque action d'administration est inscrite dans `admin_audit_log` (`audit()`). Les opérations elles-mêmes sont dans `src/lib/server/admin-ops.ts` : utilisées directement par le Super Admin, ou à la validation d'une demande.
- Une modification visible par tous (carte créée ou rééquilibrée, règle changée) peut être annoncée par une **news** (table `news`), qui notifie tous les joueurs.

## 13. Checklist avant de dire « terminé »

```bash
npx next typegen        # si les types de pages manquent (copie neuve)
npm run check           # types + lint + tests (tout doit passer)
npm run db:check-local  # si une migration ou une table a changé (exige PostgreSQL + pgTAP en local ;
                        # à défaut, exécuter la migration sur la base dans une transaction annulée)
npm run build           # si le changement est important (pages, configuration)
npm run bots:tournament # si les réglages du battle royale, le moteur ou l'IA des bots ont changé
```

Sur cet ordinateur (Windows), lancer les tests depuis **PowerShell** : depuis Git Bash, Vitest échoue au démarrage de chaque fichier (« Cannot read properties of undefined (reading 'config') »), sans rapport avec le code. Le test de performance (`perf.test.ts`) prend pour chaque tick le plus court de 3 parties identiques : sous Windows, le chronomètre de calcul n'avance que par paliers de 15 à 16 ms, et les autres tests lancés en même temps ralentissent les mesures.

Puis : textes ajoutés dans les 7 langues, `DECISIONS.md` complété si une décision a été prise, résumé clair au propriétaire (avec `npm install` ou `npx supabase db push` si nécessaire).

## 14. Pièges React / Next.js déjà rencontrés

- **Lint React 19** : pas de `setState` synchrone dans un `useEffect` (passer par `setTimeout(…, 0)`, un rappel d'événement ou `useSyncExternalStore`) ; pas de lecture ni d'écriture de `ref.current` pendant le rendu ; pas de réassignation de variable après le rendu.
- **Hydratation** : rien d'aléatoire ni de dépendant de l'heure (`Date.now()`, `Math.random()`, format de date local) ni des données du navigateur (`Intl.supportedValuesOf`, dont la liste diffère de celle de Node : erreur React n° 418 sur les Réglages) dans le rendu initial d'un composant client ; passer par `useSyncExternalStore` avec une valeur serveur. `<body suppressHydrationWarning>` existe uniquement pour les attributs ajoutés par les extensions du navigateur ; ne pas s'en servir pour masquer un vrai problème.
- **Styles en ligne** : propriétés en camelCase (`colorScheme`, pas `color-scheme`) ; les variables CSS `--…` sont acceptées telles quelles.
- **Modules serveur** : un composant client n'importe d'un fichier `server-only` que des **types** (`import type`).
- **Service worker** : actif seulement en production (`npm run build && npm start`) ou avec `NEXT_PUBLIC_ENABLE_SW_DEV`. L'installation sur téléphone exige HTTPS.
- **Mise en ligne** : un onglet resté ouvert sur l'ancienne version peut réclamer un fichier JavaScript disparu (`ChunkLoadError`) ; `error.tsx` et `global-error.tsx` rechargent alors la page une fois par minute au plus (`src/lib/client/stale-build.ts`).
- **Images générées** : `next/image` n'est pas utilisé pour les illustrations en data URI ; mettre `// eslint-disable-next-line @next/next/no-img-element` avec la raison.

## 15. Fichiers obsolètes (ne pas utiliser, ne pas s'en inspirer)

Ces fichiers ne sont importés nulle part : `src/content/news.ts` (les news sont en base : `src/lib/server/news.ts`), `src/components/collection/DuplicateActions.tsx` (remplacé par `CardActions.tsx`), `src/components/layout/Breadcrumbs.tsx`, `src/components/layout/MainNav.tsx`. Ils peuvent être supprimés avec l'accord du propriétaire. `arborescence.txt` est un export ponctuel (UTF-16), pas une référence à jour.

## 16. Variables d'environnement (`.env.local`, et Vercel en production)

`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL` (pooler Supabase en mode transaction, port 6543 ; 5432 converti, voir §6), `SUPABASE_SECRET_KEY` (Storage des illustrations, opérations d'administration), `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `…_SECRET` (connexion Google), `NEXT_PUBLIC_ENABLE_SW_DEV`, `CRON_SECRET`, `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` (phase 5), `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` (captcha), `SUPER_ADMIN_IDS`. Toutes sont commentées dans `.env.example`. Ne jamais écrire de valeur secrète dans le code ni dans un fichier suivi par git.
