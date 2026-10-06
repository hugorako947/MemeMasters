# Décisions

Choix pris en cours de route, en complément du document de conception validé en phase 0.
Chaque entrée : la décision, puis la raison.

## Phase 0 (validée)

- **Achats réservés aux 18 ans et plus.** Date de naissance demandée à la première visite de la boutique, puis non modifiable par le joueur. Choix du propriétaire.
- **Lancement mondial.** Prix en euros, affichage en devise locale par Stripe, boutique désactivée en Belgique par défaut (`PAID_BOOSTERS_BLOCKED_COUNTRIES`). Choix du propriétaire.
- **Aucun âge minimum pour créer un compte.** Clé `MIN_ACCOUNT_AGE` (null) prévue pour en ajouter un sans refonte. À faire valider juridiquement (COPPA, RGPD art. 8). Choix du propriétaire.

## Phase 1

- **Next.js 16 : `src/proxy.ts` au lieu de `middleware.ts`.** Le fichier a été renommé dans Next 16 ; même rôle.
- **Service worker via `@serwist/turbopack`.** Next 16 compile avec Turbopack par défaut ; cette variante de Serwist sert le worker par une route (`/serwist/sw.js`) et évite de repasser à webpack.
- **Polices auto-hébergées (`@fontsource`).** Anton (titres, légendes façon meme) et Bricolage Grotesque (texte). Aucune requête vers Google Fonts : plus rapide, fonctionne hors ligne, pas de transfert de données à un tiers.
- **Direction visuelle.** Fond lavande, encre violet nuit, rose « notification », panneaux façon autocollant (contour d'encre, ombre décalée). L'audace est réservée aux cartes ; l'interface reste sobre autour.
- **Tutoiement dans l'interface.** Public jeune, codes des réseaux sociaux.
- **Carte en unités `cqw`.** Toutes les mesures dépendent de la largeur de la carte : la même carte reste nette en vignette comme en grand.
- **Nom de la carte affiché comme légende de meme sur l'illustration** (lettres blanches, contour noir). Les illustrations ne contiennent donc aucun texte, ce qui les rend sûres à stocker et indépendantes des polices.
- **Description de la carte absente de la face.** Elle sera affichée dans la vue détaillée (phase 3) ; sur la face, la place va aux stats et aux attaques.
- **Rareté jamais portée par la seule couleur.** Chaque rareté a un symbole et son nom écrit sur le bandeau de la carte.
- **Inclinaison au pointeur sans re-rendu React.** Les variables CSS sont posées directement sur l'élément ; fluide même sur des téléphones modestes.
- **`battles.winner_side` (a / b) au lieu de `winner_id`.** Un combat contre un bot n'a pas de second joueur ; le camp gagnant marche dans les deux cas.
- **`card_usage_daily` au lieu de `card_battle_stats`.** Des statistiques par jour donnent à la fois le taux de victoire global et l'utilisation sur 30 jours demandée pour la popularité.
- **Rôle admin uniquement dans `app_metadata`.** Pas de copie dans `profiles` : une seule source de vérité, modifiable seulement côté serveur.
- **`battle_actions` indexée par camp (`side`) et non par joueur.** Même raison que `winner_side`.
- **Révocation explicite des droits d'écriture des rôles `anon` et `authenticated`.** En plus de RLS : même une politique ajoutée par erreur ne permettrait pas d'écrire.
- **Pseudo modifiable seulement par un admin.** Évite l'usurpation et garde des classements lisibles.
- **Changement de fuseau : le premier est libre, puis un tous les 30 jours.** Le joueur peut corriger un fuseau mal détecté sans attendre.
- **Liens d'e-mail en flux `token_hash`.** Ils fonctionnent même si l'e-mail est ouvert sur un autre appareil que celui de l'inscription.
- **Limitation de débit qui échoue « fermé ».** Si la base est indisponible, les tentatives de connexion sont refusées plutôt que laissées sans limite.
- **Huit cartes de démonstration dans le code** (`sample-cards.ts`) pour l'accueil et `/raretes`. Le jeu de 40 cartes arrivera par le seed SQL en phase 2 ; ces huit cartes y seront reprises.
- **Script `scripts/check-sql.sh`.** Valide les migrations et lance les tests pgTAP sur un PostgreSQL ordinaire, sans Docker. La voie normale reste `npx supabase db reset && npx supabase test db`.
