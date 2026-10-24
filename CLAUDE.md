@AGENTS.md

# MemeMasters — mémoire du projet pour Claude Code

Ce fichier est lu automatiquement au début de chaque session. Il contient ce que le code ne dit pas : les choix du propriétaire, les règles à respecter et les pièges déjà rencontrés. **Lis-le en entier avant toute modification.** Pour le détail et l'historique de chaque choix, voir `DECISIONS.md` ; pour l'installation et le déploiement, `README.md`.

## 1. Le projet en bref

Jeu web multijoueur de cartes à collectionner sur le thème des memes (PWA installable sur téléphone et ordinateur). Les joueurs ouvrent des boosters, collectionnent, font évoluer leurs cartes, se classent, se font des amis et discutent. Public jeune et mobile ; interface en 7 langues.

- **Propriétaire** : un développeur seul, francophone, qui valide chaque fonctionnalité. **Toujours répondre en français**, clairement, sans jargon inutile.
- **Nom du jeu** : **« Battle Meme »**, provisoire (un jeu du même nom existe : il changera encore). Constantes uniques `GAME_CONFIG.GAME_NAME` et `GAME_SHORT_NAME` (`src/config/game.config.ts`) ; ne jamais écrire le nom en dur dans l'interface. Seules exceptions, à mettre à jour à chaque changement de nom : les modèles d'e-mails `supabase/templates/*.html` (à recoller ensuite dans Supabase, avec le « Sender name » du SMTP) et le pseudo réservé de `src/lib/validation/username.ts`. Le dépôt, `package.json`, les tables, les cookies `mm-…` et les documents de `docs/` gardent l'ancien nom technique « MemeMasters ».
- **État** : l'essentiel est en place (comptes, cartes, boosters, collection, évolutions, revente, classements, amis, messagerie, défi du jour, communauté, tableau de bord). **Restent** : les batailles (concept non validé, voir §8), les paiements Stripe (phase 5), les finitions (performances, audit de sécurité).

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
| `npm run cards:sql` | Régénère la migration du jeu de cartes de départ à partir de `src/content/cards/starter-set.ts`. |
| `npm run doctor` | Diagnostic de la configuration (`.env.local`, connexion). |
| `npm run tunnel` | Tunnel HTTPS Cloudflare (tester l'installation sur téléphone, la webcam). |

Pages de prévisualisation sans compte (développement uniquement) : `/apercu?vue=accueil|profil|reglages|boutique|infos|joueur&onglet=…&trophees=…&pays=…`.

## 4. Pile technique et versions

Next.js **16.3.8** (App Router, Turbopack, `src/proxy.ts` au lieu de `middleware.ts`), React **19.2**, TypeScript strict, Tailwind CSS **4** (pas de `tailwind.config` : le thème est dans `src/app/globals.css`), next-intl **4**, Supabase (Auth, PostgreSQL, Storage), **postgres.js** pour les transactions serveur, **Zod 4** (`z.uuid()`, `z.email()`…), Motion 14, Zustand 5, Serwist (`@serwist/turbopack`) pour le service worker, Vitest 5, pgTAP, sharp (images), qrcode. Déploiement visé : Vercel + Supabase.

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
    bataille/          bataille d'entraînement — NON reliée à l'interface (§8)
  components/          par domaine : card, collection, booster, infos, player, friends, messages,
                       moderation, community, challenges, install, pwa, layout, ui, battle, home, legal
  config/              game.config.ts (réglages validés par Zod), rarities.ts, ranks.ts, shop.ts, legal.config.ts
  content/cards/       starter-set.ts : les 40 cartes de départ
  lib/
    server/            tout le code serveur (marqué "server-only") : base, auth, jeu, administration
    economy/           logique pure et testée : boosters, évolutions et revente, tirage du défi
    battle/            moteur de bataille déterministe (§8)
    i18n/ theme/ navigation/ pwa/ time/ validation/ art/ client/ cards/ player/
messages/              traductions : fr (référence), en, es, pt, de, zh, ar
supabase/migrations/   migrations SQL (ordre chronologique, jamais modifiées une fois livrées)
supabase/tests/        tests pgTAP (rls.test.sql, account.test.sql)
scripts/               check-sql.sh, doctor, génération des cartes et des icônes PWA
docs/                  guides pour le propriétaire (Google OAuth et e-mails, Stripe)
```

## 6. Architecture côté serveur

- **Base de données** : `src/lib/server/db.ts` (`sql()`), connexion directe qui **contourne RLS** : chaque fonction vérifie elle-même l'identité et les droits. `DATABASE_URL` pointe sur le pooler Supabase ; une adresse en mode transaction (port 6543) est **convertie automatiquement en mode session (port 5432)** par `sessionPoolerUrl()` : en mode transaction, le pooler perdait des réponses quand plusieurs requêtes partaient en même temps (pages bloquées sur l'écran de chargement). Options : `prepare: false`, `max: 5`. **Ne jamais ajouter `max_pipeline`** : toute limite empêche postgres.js de réserver la connexion d'une transaction (erreur `UNSAFE_TRANSACTION`, toutes les ouvertures de booster et créations de carte échouaient). Si le trafic grandit (Vercel, beaucoup d'instances), surveiller la limite de connexions du mode session.
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
- **Tables principales** : `profiles` (pseudo, trophées, `last_seen_at`), `player_private` (fuseau, langue, thème, `role` player/admin, `banned_at`, `seen` des notifications), `player_wallets` (MemeMoney, `meme_money_cents`, boosters), `cards`, `user_cards` (`quantity`, `upgrade_level` 0 à 3), `booster_openings`, `daily_usage`, `economy_ledger`, `trophy_history`, `friendships`, `player_blocks`, `player_reports`, `messages`, `conversation_hides`, `news`, `challenge_templates`, `player_challenges`, `community_cards`, `community_votes`, `admin_requests`, `admin_audit_log`, `contact_messages`, `rate_limits`. Bucket Storage public `card-art` (illustrations).

## 8. Batailles : ATTENTION

**Concept choisi par le propriétaire (2026-10-24)** : un **battle royale 2D vu de dessus, jusqu'à 100 participants** ; chaque carte est un personnage jouable ; partie classée en solo contre des bots portant les personnages de vrais joueurs, parties entre amis en pair-à-pair. Cahier des charges complet : `docs/PROMPT_CLAUDE_CODE_Battle_Meme.md` ; conception (phase 0) : `docs/BATTLE_ROYALE_CONCEPTION.md`, **à faire valider avant tout code**. Travail par phases (0 conception → 7 finitions), avec un arrêt pour validation après la phase 0.

L'ancien code d'une bataille « arène à tours » existe encore (`src/lib/battle/` : moteur pur et déterministe en nombres entiers, bot, decks ; `src/components/battle/` ; page `/bataille`), mais **aucun lien n'y mène** et la page Batailles de l'accueil affiche « Bientôt ». Il est remplacé par le battle royale ; son sort est proposé en phase 0.

- Ne pas relier, étendre ni supprimer l'ancien code sans accord du propriétaire (proposition attendue en phase 0).
- Moteur du battle royale : **fonction pure et déterministe** (`état + commandes du tick → nouvel état`), entiers ou virgule fixe, aucun `Math.random`/`sin`/`cos`/`atan2`/`sqrt` flottant dans la simulation, tests d'abord, rejeu et vérification par le serveur des parties classées (le client ne décide jamais).
- Les trophées (+25 / −25 / 0), les récompenses de victoire et les défis liés aux batailles sont déjà prévus dans la configuration et la base, en attente.

## 9. Traductions (next-intl, 7 langues)

- Fichiers `messages/{fr,en,es,pt,de,zh,ar}.json`, **mêmes clés partout** (le français est la référence). Le test `src/lib/i18n/messages.test.ts` échoue dès qu'une clé manque ou est en trop dans une langue.
- Toute nouvelle clé : écrite dans les 7 fichiers et vraiment traduite (pas de français recopié). Pluriels au format ICU ; l'arabe utilise les formes `zero/one/two/few/many/other`, le chinois seulement `other`.
- Un message qui contient `{param}` exige ce paramètre à l'appel (sinon erreur d'exécution). Si on retire un paramètre d'un texte, le retirer dans les 7 langues.
- L'arabe s'affiche de droite à gauche : utiliser les propriétés logiques (`ms-`, `me-`, `start-`, `end-`) et `rtl:` quand une flèche doit s'inverser.
- **Vocabulaire imposé** (dans toutes les langues) : « exemplaires » (jamais « doublons ») ; « évolution / faire évoluer » (jamais « amélioration ») ; « MemeMoney » ; « boosters » ; tutoiement en français.
- Le tableau de bord `/admin` est volontairement en français uniquement.

## 10. Interface et style

- **Mobile d'abord** : tout doit fonctionner au pouce sur 375 px de large ; zones tactiles d'au moins 44 px (`min-h-11`) ; contenu jusqu'à 1 280 px (`max-w-7xl`) sur grand écran.
- **Sobriété** : pas d'émojis décoratifs (seuls ✓, ✕, les symboles de rareté et les étoiles d'évolution) ; contours de 2 px, ombres portées de 3 px ; ton amusant mais pas criard.
- **Couleurs** : uniquement via les variables du thème (`bg-paper`, `bg-surface`, `text-ink`, `text-ink-soft`, `bg-candy`, `border-ink`, `--color-*`…), car 5 thèmes existent (clair, sombre, inversé, personnalisé, aléatoire). Pointeur de souris : celui du système (le pointeur personnalisé a été abandonné : ne pas en recréer). Pas de couleur codée en dur hors identité visuelle (raretés, insignes).
- **Accessibilité** : contrastes suffisants, navigation au clavier, `aria-*` sur les contrôles, `prefers-reduced-motion` respecté (classes `motion-reduce:`, Motion en `reducedMotion="user"`).
- **Composants à réutiliser** : `MemeCard` / `InteractiveCard` (carte ; props `level` 0 à 3, `quantity`, `actions`), `SlideDeck` (pages glissantes avec onglets, URL `?vue=`, badges chiffrés), `NotificationDot`, `Button` / `ButtonLink`, `SubmitButton`, `Spinner`, `toast` (bulles de confirmation et d'erreur, `src/components/ui/Toast.tsx`), `PasswordField`, `Captcha`, `PlayerCounts`, `FullscreenToggle`, `ImagePicker`, `InfoSection` / `InfoTable` (pages d'Infos), `CardDetailDialog` (carte agrandie), `LegalInfo` (liens légaux), `markBusy` (`src/lib/client/busy.ts`, élément « en cours »), `postJson` (`src/lib/client/api.ts`) pour appeler les routes, `src/lib/client/errors.ts` pour traduire un code d'erreur.
- **Attente** (« le jeu doit paraître rapide ») :
  - changement de page : barre de chargement en haut dès le clic, puis écran d'attente des cartes (`loading.tsx`, visible seulement après 0,18 s) ;
  - action dans la même page (bouton, onglet de page glissante, lien qui ne change que `?…`, sachet de booster) : l'élément cliqué devient « en cours » (`src/lib/client/busy.ts`, attribut `data-mm-busy`) : clics bloqués aussitôt, puis après 0,15 s un cercle tournant remplace son contenu sans changer sa taille. `data-mm-busy-style="overlay"` garde le contenu visible, atténué (sachet). C'est automatique pour `postJson`/`postForm`, les liens dans la même page, `Button pending` et `SubmitButton` ; pour un autre cas, appeler `markBusy(élément)`.
  - Garder ce fonctionnement pour toute nouvelle page ou action.
- **Pas de pied de page dans le compte joueur** (comme un jeu vidéo) : liens légaux, contact et droits sont en bas des Réglages (`LegalInfo compact`). Le pied de page (`SiteFooter`) reste sur la vitrine, la connexion et l'inscription.
- **Thème** : un changement fait dans les Réglages passe par `applyLocalAppearance` ; `PreferenceSync` ignore un cadre de page préparé avant ce changement (`renderedAt`), sinon les pages gardées en mémoire remettaient l'ancien thème.
- **Hors ligne** : ajouter la classe `mm-online-only` à tout élément qui demande le serveur (il est grisé quand le réseau manque).
- **Pages glissantes existantes** : Accueil (Collection | Boosters | Batailles ; Boosters par défaut) ; Infos (Carte, Raretés, Évolutions, **Classement** par défaut, Rangs, Trophées, MemeMoney, News) ; Profil (Profil, Amis, Messages, Communauté). Navigation du bas : Boutique, Infos, Accueil, Profil, Réglages.
- **Notifications** : les points rouges affichent un nombre, calculés côté serveur par `getBadges()` ; une notification vue est marquée par `/api/seen`, et `router.refresh()` n'est appelé que lorsqu'une notification est réellement consommée.

## 11. Règles du jeu à respecter (valeurs dans `src/config/`)

- **7 raretés** : commune, rare, épique, légendaire, brainrot, superbrainrot, godlevel. Taux et compositions des boosters dans `GAME_CONFIG.BOOSTERS` ; taux affichés publiquement (obligation légale).
- **Boosters** : 10 cartes ; 3 boosters journaliers gratuits (remis à minuit, fuseau du joueur) ; « Booster en plus », Super Booster et Ultra Booster achetés en MemeMoney ; pity : légendaire garantie au 10e booster journalier sans légendaire. Le **défi du jour** (un par jour et par joueur, tiré au hasard) ne donne que des « boosters en plus » ; affiché en une phrase « défi = récompense » (« Ouvre 1 booster = 1 booster en plus »). **Ouverture** : un seul clic sur le sachet (au centre de la page Boosters) ouvre le booster ; la fenêtre montre directement les 10 cartes et se ferme d'un clic en dehors. Page Boosters volontairement épurée : pas de titre d'achat, pas de solde (il est en haut de l'écran), pas de « Au moins 1 … » ni « Il te manque … ».
- **Carte agrandie** : seul un clic en dehors de la carte (ou Échap) la ferme ; un clic sur la carte ne fait rien.
- **Statistiques des cartes** : PV, ATQ, DÉF, VIT, une attaque (puissance), une attaque spéciale (puissance + coût en énergie), une défense (effet `heal` soin, `reflect` renvoi de dégâts, `dodge` esquive, `cleanse` annule les effets négatifs, `recharge` +1 énergie ; schémas Zod dans `src/lib/validation/card.ts`). Budget de statistiques par rareté vérifié par `checkBudget` et par les tests du jeu de départ. **Plus de vibes** (supprimées du code et de la base).
- **Exemplaires** : le premier exemplaire d'une carte reste toujours dans la collection. Les exemplaires en trop servent à **faire évoluer** (Dorée ★, Dorée ★★, Divine ★★★ ; coûts par rareté dans `DUPLICATES.UPGRADES` ; bonus de statistiques +3 / +6 / +10 %) ou à **vendre** (prix bas en centièmes de MemeMoney, fractions conservées ; plafond quotidien de 20 MemeMoney pour communes, rares et épiques).
- **MemeMoney** : monnaie fermée, sans valeur réelle, jamais échangeable entre joueurs ni reconvertible en argent. C'est une règle légale essentielle des boosters payants : ne jamais créer de passerelle.
- **Rangs** : 10 rangs, un tous les 1 000 trophées ; récompenses données une seule fois par rang (`src/config/ranks.ts`).
- **Social** : amis (200 au plus, 50 demandes en attente), messages (500 caractères, 3 messages au plus à un non-ami tant qu'il n'a pas répondu), blocage (coupe amitié, demandes et messages dans les deux sens), signalements (traités dans le tableau de bord).
- **Communauté** : un joueur propose une carte (2 propositions en cours, 3 par jour), l'équipe la vérifie, tout le monde vote (une voix déplaçable, jamais pour sa propre carte), la plus votée peut sortir dans le jeu.
- **Achats en argent réel** (phase 5, pas encore actifs) : 18 ans et plus, plafond de dépenses sur 30 jours, pays bloqués, webhooks Stripe vérifiés par signature. Voir `docs/Guide_2_Stripe_Paiements_et_MemeMoney.md`.

## 12. Rôles et administration

- **Joueur**, **admin** (`player_private.role = 'admin'`, nommé par le Super Admin depuis le tableau de bord), **Super Admin** (le créateur) : désigné uniquement par la variable d'environnement `SUPER_ADMIN_IDS` (identifiants de comptes séparés par des virgules), lue côté serveur par `isSuperAdminId()`. Il n'existe ni page ni mot de passe spécial ; ne jamais en créer.
- **Droits** : un admin gère les joueurs (ni les autres admins, ni le Super Admin, ni son propre compte ; l'e-mail des membres de l'équipe lui est masqué). Ses actions importantes (cartes, ressources d'un joueur, suppression de compte, news, défis, sortie d'une carte de la Communauté) créent une **demande** (`admin_requests`) que le Super Admin valide ; la modération urgente (bannir, traiter un signalement ou un contact) est immédiate.
- Chaque action d'administration est inscrite dans `admin_audit_log` (`audit()`). Les opérations elles-mêmes sont dans `src/lib/server/admin-ops.ts` : utilisées directement par le Super Admin, ou à la validation d'une demande.
- Une modification visible par tous (carte créée ou rééquilibrée, règle changée) peut être annoncée par une **news** (table `news`), qui notifie tous les joueurs.

## 13. Checklist avant de dire « terminé »

```bash
npx next typegen        # si les types de pages manquent (copie neuve)
npm run check           # types + lint + tests (tout doit passer)
npm run db:check-local  # si une migration ou une table a changé
npm run build           # si le changement est important (pages, configuration)
```

Puis : textes ajoutés dans les 7 langues, `DECISIONS.md` complété si une décision a été prise, résumé clair au propriétaire (avec `npm install` ou `npx supabase db push` si nécessaire).

## 14. Pièges React / Next.js déjà rencontrés

- **Lint React 19** : pas de `setState` synchrone dans un `useEffect` (passer par `setTimeout(…, 0)`, un rappel d'événement ou `useSyncExternalStore`) ; pas de lecture ni d'écriture de `ref.current` pendant le rendu ; pas de réassignation de variable après le rendu.
- **Hydratation** : rien d'aléatoire ni de dépendant de l'heure (`Date.now()`, `Math.random()`, format de date local) dans le rendu initial d'un composant client. `<body suppressHydrationWarning>` existe uniquement pour les attributs ajoutés par les extensions du navigateur ; ne pas s'en servir pour masquer un vrai problème.
- **Styles en ligne** : propriétés en camelCase (`colorScheme`, pas `color-scheme`) ; les variables CSS `--…` sont acceptées telles quelles.
- **Modules serveur** : un composant client n'importe d'un fichier `server-only` que des **types** (`import type`).
- **Service worker** : actif seulement en production (`npm run build && npm start`) ou avec `NEXT_PUBLIC_ENABLE_SW_DEV`. L'installation sur téléphone exige HTTPS.
- **Images générées** : `next/image` n'est pas utilisé pour les illustrations en data URI ; mettre `// eslint-disable-next-line @next/next/no-img-element` avec la raison.

## 15. Fichiers obsolètes (ne pas utiliser, ne pas s'en inspirer)

Ces fichiers ne sont importés nulle part : `src/content/news.ts` (les news sont en base : `src/lib/server/news.ts`), `src/components/collection/DuplicateActions.tsx` (remplacé par `CardActions.tsx`), `src/components/layout/Breadcrumbs.tsx`, `src/components/layout/MainNav.tsx`. Ils peuvent être supprimés avec l'accord du propriétaire. `arborescence.txt` est un export ponctuel (UTF-16), pas une référence à jour.

## 16. Variables d'environnement (`.env.local`, et Vercel en production)

`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL` (pooler Supabase ; 6543 converti en 5432, voir §6), `SUPABASE_SECRET_KEY` (Storage des illustrations, opérations d'administration), `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `…_SECRET` (connexion Google), `NEXT_PUBLIC_ENABLE_SW_DEV`, `CRON_SECRET`, `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` (phase 5), `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` (captcha), `SUPER_ADMIN_IDS`. Toutes sont commentées dans `.env.example`. Ne jamais écrire de valeur secrète dans le code ni dans un fichier suivi par git.
