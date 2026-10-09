# MemeMasters

Jeu web multijoueur de cartes à collectionner sur le thème des memes : boosters, collection, combats et classements. Application installable (PWA) sur mobile et PC.

**État : phase 1 terminée** (fondations), avec les retours de la première revue. Les boosters, la collection, les combats et la boutique arrivent dans les phases 2 à 5. Ce README est complété à chaque phase.

## Ce que contient la phase 1

- Comptes réservés aux 18 ans et plus : inscription complète (pseudo, e-mail, mot de passe robuste, attestation de majorité, acceptation des conditions), connexion Google, mot de passe oublié, déconnexion. Les boutons ne s'activent que quand le formulaire est valide.
- Pages légales (modèles à compléter), pied de page, fil d'Ariane.
- Accueil : titre, les 8 raretés en vitrine, les fonctionnalités illustrées ; chaque carte s'ouvre en fiche détaillée sur fond flouté.
- Profil public et réglages (changement de fuseau limité).
- Base de données complète : schéma de tout le jeu, RLS sur toutes les tables, canaux Realtime privés, vues de classement.
- Design system : composant Carte avec les 8 raretés, illustrations générées, vitrine sur `/raretes`.
- Squelette PWA : manifest, icônes, service worker, page hors ligne.

## Prérequis

- Node.js 20.9 ou plus récent.
- Un compte [Supabase](https://supabase.com) (base de données et comptes) et un compte [Vercel](https://vercel.com) (hébergement du site).
- Docker Desktop, **seulement** si vous voulez une base Supabase sur votre machine (option B).

## Installation, option A (recommandée) : projet Supabase en ligne, sans Docker

1. Créez un projet sur supabase.com (région : Europe).
2. Envoyez les migrations :
   ```bash
   npm install
   npx supabase login
   npx supabase link --project-ref <identifiant>   # la partie xxxx de https://xxxx.supabase.co
   npx supabase db push                           # à refaire à chaque nouvelle migration
   ```
3. Copiez `.env.example` en `.env.local` et remplissez :
   - `NEXT_PUBLIC_SUPABASE_URL` : `https://<identifiant>.supabase.co`, sans guillemets ni espace ;
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` : Project Settings → API Keys ;
   - `DATABASE_URL` : bouton **Connect** → onglet **Direct** → **Transaction pooler** (port 6543), en remplaçant `[YOUR-PASSWORD]` par le mot de passe de la base. Évitez les caractères `@ # / : ? % &` dans ce mot de passe.
4. Réglez l'authentification dans le tableau de bord (voir « Configurer Supabase » plus bas). Pour tester sans e-mail, désactivez temporairement *Confirm email*.
5. Lancez `npm run dev` et ouvrez http://localhost:3000.

Si une variable est mal remplie, le site affiche un message qui la nomme.

## En cas de problème : `npm run doctor`

```bash
npm run doctor                    # vérifie .env.local, Supabase Auth et la base de données
npm run doctor -- --reset-limits  # efface aussi les compteurs de « Trop de tentatives »
```

Le diagnostic indique notamment si « Confirm email » est activé et si la dernière migration est appliquée. Le terminal où tourne `npm run dev` affiche aussi la vraie cause de chaque refus de Supabase, avec la marche à suivre.

**Inscription et e-mails de confirmation.** Sans serveur d'envoi personnel (SMTP), Supabase n'envoie que quelques e-mails par heure, et seulement aux adresses des membres de l'équipe du projet. Pour tester, désactivez « Confirm email » (Authentication → Sign In / Providers → Email) : l'inscription connecte alors directement. Avant la mise en ligne, configurez un SMTP (Resend, Brevo…) dans Authentication → SMTP Settings et réactivez la confirmation. L'e-mail contient un **lien** à cliquer, pas un code.

## Installation, option B : Supabase en local avec Docker

```bash
npm install
cp .env.example .env.local
npx supabase start          # démarre Supabase en local (Docker) et affiche les clés
npx supabase db reset       # applique les migrations et le seed
```

Recopiez dans `.env.local` les valeurs affichées par `supabase start` :

| Variable | Valeur affichée |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key |
| `SUPABASE_SECRET_KEY` | Secret key |
| `DATABASE_URL` | DB URL |

Puis :

```bash
npm run dev                 # http://localhost:3000
```

En local, les e-mails de confirmation ne partent pas vraiment : ils arrivent dans Mailpit, à l'adresse affichée par `supabase start` (en général http://127.0.0.1:54324).

À l'installation, npm signale « 5 high severity vulnerabilities » : elles concernent uniquement l'outil ESLint sur votre poste, pas le site. **Ne lancez pas `npm audit fix --force`**, qui casserait la configuration (voir DECISIONS.md).

## Commandes utiles

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` puis `npm start` | Version de production en local |
| `npm run check` | Types + lint + tests unitaires |
| `npm test` | Tests unitaires (Vitest) |
| `npm run db:test` | Tests des règles d'accès (pgTAP, nécessite Supabase local) |
| `npm run db:check-local` | Mêmes tests SQL sur un PostgreSQL ordinaire, sans Docker |
| `npm run db:types` | Régénère les types TypeScript de la base |
| `npm run assets:pwa` | Régénère les icônes de l'application |
| `npm run doctor` | Diagnostic de l'installation (voir plus haut) |

## Configurer Supabase en production

1. Créez un projet Supabase et notez son mot de passe de base de données.
2. Liez le projet et envoyez les migrations :
   ```bash
   npx supabase login
   npx supabase link --project-ref <identifiant-du-projet>
   npx supabase db push
   ```
3. **Authentication → URL Configuration** (ajoutez aussi `http://localhost:3000/auth/callback` et `http://localhost:3000/auth/confirm` pour développer) : *Site URL* = l'URL du site (ex. `https://mememasters.vercel.app`) ; ajoutez dans *Redirect URLs* `https://<votre-domaine>/auth/callback` et `https://<votre-domaine>/auth/confirm`.
4. **Authentication → Providers → Email** : laissez « Confirm email » activé, réglez *Minimum password length* sur **10** et *Password requirements* sur **lettres minuscules, majuscules, chiffres et symboles** (les mêmes règles que le formulaire).
5. **Authentication → Email Templates** (facultatif mais conseillé) : remplacez *Confirm signup* et *Reset password* par le contenu de `supabase/templates/confirmation.html` et `supabase/templates/recovery.html`, dans l'onglet **Source**. Sans eux, les liens reçus par e-mail ne marchent que dans le navigateur où le compte a été créé. Si l'éditeur est bloqué, configurez d'abord un SMTP (étape 7).
6. **Authentication → Providers → Google** : activez-le avec l'identifiant et le secret créés dans Google Cloud Console (type « Application Web », URI de redirection autorisée : `https://<projet>.supabase.co/auth/v1/callback`).
7. Pour un usage réel, configurez un serveur SMTP (Authentication → SMTP) : l'envoi intégré de Supabase est très limité.

## Mettre en ligne sur Vercel

1. Importez le dépôt dans Vercel (le framework Next.js est détecté).
2. Dans **Settings → Environment Variables**, renseignez les variables de `.env.example`. Pour `DATABASE_URL`, utilisez la chaîne du **Transaction pooler** (port 6543) de Supabase.
3. Déployez. Chaque nouveau déploiement est détecté par le service worker (l'invite de mise à jour arrive en phase 6).

Attention : le plan gratuit de Vercel interdit l'usage commercial. Il faudra passer au plan Pro avant d'activer les paiements (phase 5).

## Avant la mise en ligne : textes juridiques

Complétez **`src/config/legal.config.ts`** (éditeur, adresse, e-mail de contact, directeur de la publication, adresses des hébergeurs). Tant qu'une information manque, les pages légales l'affichent « À compléter » avec un bandeau d'avertissement. Les textes de `src/content/legal/fr.tsx` sont des modèles : faites-les relire par un professionnel du droit.

Quand vous modifiez les conditions, changez `TERMS_VERSION` : chaque joueur devra les accepter de nouveau à sa prochaine visite.

## Aperçu des pages joueur (développement)

Pour travailler le design sans compte ni base de données, lancez `npm run dev` puis ouvrez :

- http://localhost:3000/apercu (accueil du joueur)
- http://localhost:3000/apercu?vue=profil (profil, statistiques, graphique)
- http://localhost:3000/apercu?vue=reglages (réglages)

- http://localhost:3000/apercu?vue=boutique&pays=BR (boutique, prix dans la devise d'un pays)
- http://localhost:3000/apercu?vue=infos&onglet=rangs (Infos : raretes, rangs, classement ou news)
- http://localhost:3000/apercu?onglet=collection (collection fictive ; l'ouverture de booster demande un vrai compte)

Ajoutez `&trophees=4200` pour simuler un autre rang. Cette page utilise des données fictives et n'existe pas en production.

## Langues et thèmes

- **Langues** : anglais, chinois mandarin, espagnol, arabe (de droite à gauche), français, portugais, allemand. Textes dans `messages/<code>.json` ; un test vérifie que chaque langue traduit toutes les clés du français. Sans choix du joueur, la langue suit celle du navigateur, puis celle du pays (en-tête Vercel), sinon le français.
- **Thèmes** : clair (par défaut), obscur (noir), inversé (tout le site en négatif, cartes comprises), personnalisé (couleur principale, fond clair, obscur ou inversé).

## Installer le jeu sur un téléphone

La page `/installer` affiche les instructions adaptées à l'appareil. Le QR code de l'accueil et des réglages pointe vers `NEXT_PUBLIC_SITE_URL/installer` : renseignez l'adresse publique du site (Vercel) pour qu'il fonctionne. En local, un téléphone ne peut pas joindre `localhost` ; pour tester, mettez temporairement l'adresse IP de votre ordinateur sur le réseau Wi-Fi (par exemple `http://192.168.1.20:3000`) et lancez `npm run dev -- -H 0.0.0.0`. L'installation complète (service worker) ne fonctionne qu'en HTTPS, donc une fois déployé.

## Publier une news

Ajoutez une entrée en haut de `src/content/news.ts` (date, type, titre et texte en français, autres langues facultatives). Elle apparaît dans Infos → News.

## Messages de contact

Les messages envoyés depuis `/contact` sont dans la table `contact_messages` (tableau de bord Supabase → Table Editor). Passez `status` à `handled` une fois traités.

## Personnaliser le jeu

Tout se règle dans **`src/config/game.config.ts`**, validé au démarrage (une erreur, par exemple des taux dont la somme n'est pas 100 %, empêche l'application de démarrer).

| Pour changer… | Modifier |
| --- | --- |
| Le nom du jeu (titre, manifest, logo) | `GAME_NAME` et `GAME_SHORT_NAME` |
| La composition des 3 boosters (journalier, spécial, très spécial), la chance de la rareté supérieure et de la Godlevel | `BOOSTERS` |
| Le pity (légendaire garantie dans le booster journalier) | `PITY_THRESHOLD` |
| Les boosters gratuits par jour | `DAILY_FREE_BOOSTERS` |
| Les défis quotidiens | `DAILY_CHALLENGES`, `CHALLENGE_REWARD_BOOSTERS` |
| La taille des équipes et les minuteurs | `TEAM_SIZE`, `TURN_SECONDS`, `RECONNECT_SECONDS` |
| Les trophées gagnés ou perdus, le nombre de trophées par rang | `TROPHIES` |
| Les prix en MemeMoney et le gain par victoire | `MEME_MONEY` |
| Les rangs et leurs récompenses | `src/config/ranks.ts` (`RANK_REWARDS`) |
| Les packs de MemeMoney, leurs bonus, leurs prix et le plafond de dépenses | `PURCHASES` |
| Les prix locaux par devise, les offres et promotions (avec leurs dates) | `src/config/shop.ts` |

Deux exceptions, vérifiées par les tests : les poids de popularité (`RANKING`) sont aussi écrits dans la migration `20261006000400_classements.sql`, et l'ordre des raretés et des vibes doit rester identique aux types SQL. Si vous les modifiez, ajoutez une migration ; `npm test` vous signale tout décalage.

Les textes de l'interface sont dans **`messages/fr.json`**.

## Organisation du code

```text
src/config/        configuration du jeu, raretés, vibes
src/lib/           logique (cartes, illustrations, fuseaux, validation) et serveur
src/components/    carte, interface, navigation, PWA
src/app/           pages et routes API
supabase/          migrations SQL, seed, tests pgTAP, modèles d'e-mail
messages/fr.json   tous les textes
```

Règle d'or : toute logique sensible s'exécute sur le serveur. Les navigateurs ne peuvent que **lire** la base (filtrée par RLS) ; toute écriture passe par les routes API, qui vérifient l'identité, valident les entrées (Zod) et limitent le débit.

Les choix faits en cours de route sont expliqués dans [`DECISIONS.md`](./DECISIONS.md).
