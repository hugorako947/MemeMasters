# MemeMasters

Jeu web multijoueur de cartes à collectionner sur le thème des memes : boosters, collection, combats et classements. Application installable (PWA) sur mobile et PC.

**État : phase 1 terminée** (fondations). Les boosters, la collection, les combats et la boutique arrivent dans les phases 2 à 5. Ce README sera complété à chaque phase.

## Ce que contient la phase 1

- Comptes : e-mail + mot de passe (avec confirmation), connexion Google, mot de passe oublié, déconnexion.
- Écran de bienvenue : choix du pseudo (vérification en direct), fuseau horaire détecté.
- Profil public et réglages (changement de fuseau limité).
- Base de données complète : schéma de tout le jeu, RLS sur toutes les tables, canaux Realtime privés, vues de classement.
- Design system : composant Carte avec les 8 raretés, illustrations générées, vitrine sur `/raretes`.
- Squelette PWA : manifest, icônes, service worker, page hors ligne.

## Prérequis

- Node.js 20.9 ou plus récent.
- Docker Desktop (pour faire tourner Supabase en local).
- Un compte [Supabase](https://supabase.com) et un compte [Vercel](https://vercel.com) pour la mise en ligne.

## Installation locale

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

## Configurer Supabase en production

1. Créez un projet Supabase et notez son mot de passe de base de données.
2. Liez le projet et envoyez les migrations :
   ```bash
   npx supabase login
   npx supabase link --project-ref <identifiant-du-projet>
   npx supabase db push
   ```
3. **Authentication → URL Configuration** : *Site URL* = l'URL du site (ex. `https://mememasters.vercel.app`) ; ajoutez dans *Redirect URLs* `https://<votre-domaine>/auth/callback` et `https://<votre-domaine>/auth/confirm`.
4. **Authentication → Providers → Email** : laissez « Confirm email » activé.
5. **Authentication → Email Templates** : remplacez les modèles *Confirm signup* et *Reset password* par le contenu de `supabase/templates/confirmation.html` et `supabase/templates/recovery.html` (ils utilisent `/auth/confirm`, indispensable).
6. **Authentication → Providers → Google** : activez-le avec l'identifiant et le secret créés dans Google Cloud Console (type « Application Web », URI de redirection autorisée : `https://<projet>.supabase.co/auth/v1/callback`).
7. Pour un usage réel, configurez un serveur SMTP (Authentication → SMTP) : l'envoi intégré de Supabase est très limité.

## Mettre en ligne sur Vercel

1. Importez le dépôt dans Vercel (le framework Next.js est détecté).
2. Dans **Settings → Environment Variables**, renseignez les variables de `.env.example`. Pour `DATABASE_URL`, utilisez la chaîne du **Transaction pooler** (port 6543) de Supabase.
3. Déployez. Chaque nouveau déploiement est détecté par le service worker (l'invite de mise à jour arrive en phase 6).

Attention : le plan gratuit de Vercel interdit l'usage commercial. Il faudra passer au plan Pro avant d'activer les paiements (phase 5).

## Personnaliser le jeu

Tout se règle dans **`src/config/game.config.ts`**, validé au démarrage (une erreur, par exemple des taux dont la somme n'est pas 100 %, empêche l'application de démarrer).

| Pour changer… | Modifier |
| --- | --- |
| Le nom du jeu (titre, manifest, logo) | `GAME_NAME` et `GAME_SHORT_NAME` |
| Les taux de drop | `DROP_RATES` (somme = 100) |
| La garantie et le pity | `GUARANTEED_MIN_RARITY`, `PITY_THRESHOLD` |
| Les boosters gratuits par jour | `DAILY_FREE_BOOSTERS` |
| Les défis quotidiens | `DAILY_CHALLENGES`, `CHALLENGE_REWARD_BOOSTERS` |
| La taille des équipes et les minuteurs | `TEAM_SIZE`, `TURN_SECONDS`, `RECONNECT_SECONDS` |
| Les prix et le plafond de dépenses | `PURCHASES` |

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
