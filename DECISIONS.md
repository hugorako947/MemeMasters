# Décisions

Choix pris en cours de route, en complément du document de conception validé en phase 0.
Chaque entrée : la décision, puis la raison.

## Phase 0 (validée)

- **Achats réservés aux 18 ans et plus.** Date de naissance demandée à la première visite de la boutique, puis non modifiable par le joueur. Choix du propriétaire.
- **Lancement mondial.** Prix en euros, affichage en devise locale par Stripe, boutique désactivée en Belgique par défaut (`PAID_BOOSTERS_BLOCKED_COUNTRIES`). Choix du propriétaire.
- ~~Aucun âge minimum pour créer un compte.~~ Remplacé en revue de phase 1 : voir ci-dessous.

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

## Revue de la phase 1

- **Comptes réservés aux 18 ans et plus** (demande du propriétaire), par une case d'attestation à l'inscription. `MIN_ACCOUNT_AGE = 18`. La date de naissance prévue à la boutique (phase 5) devient un second contrôle, à confirmer ou supprimer à ce moment-là.
- **Inscription en une seule étape.** Pseudo, e-mail, mot de passe, confirmation, majorité, conditions ; le profil est créé dès l'inscription avec les consentements horodatés (`age_confirmed_at`, `terms_accepted_at`, `terms_version`). `/bienvenue` ne sert plus qu'aux comptes Google et aux mises à jour des conditions.
- **Mot de passe : 10 caractères minimum, minuscule, majuscule, chiffre et caractère spécial.** Règles définies une seule fois (`PASSWORD_RULES`), utilisées par la liste affichée en direct et par le serveur.
- **Boutons d'envoi désactivés tant que le formulaire est invalide.** Le serveur revalide tout de toute façon. Le remplissage automatique du navigateur est détecté pour ne pas bloquer la connexion.
- **Vérification de pseudo accessible sans compte**, limitée par adresse IP (les pseudos sont publics).
- **Bouton Connexion en couleur, Inscription en blanc** sur l'accueil (demande du propriétaire).
- **Raretés de la plus rare à la plus courante** dans la vitrine latérale : la Godlevel attire l'œil en premier. Carrousel horizontal sur mobile.
- **Fiche de carte dans un `<dialog>` natif**, rendu dans `<body>` : le reste du site (`#mm-app`) est flouté directement, car `backdrop-filter` seul ne s'affichait pas partout.
- **Illustration de carte au format 3:2** (au lieu de 5:4) : la face de la carte ne coupait plus la dernière ligne de texte en grand format.
- **Textes juridiques en modèles**, dans `src/content/legal/fr.tsx`, avec les informations de l'éditeur dans `src/config/legal.config.ts`. Bandeau « à compléter » tant qu'il manque une information. Aucun cookie autre que la session : pas de bandeau de consentement.
- **`TERMS_VERSION`** : changer cette date redemande l'acceptation des conditions à tous les joueurs.
- **Fil d'Ariane** calculé depuis l'adresse ; « Profil » n'est pas cliquable car il n'a pas de page propre.

## Économie des boosters (demande du propriétaire)

- **3 boosters gratuits par jour, 10 cartes par booster** (au lieu de 2 et 5). Le 10e emplacement reste garanti « rare ou mieux ».
- Conséquences, recalculées : une légendaire ou mieux sort dans 29 % des boosters (une fois tous les 3,4 boosters en moyenne) ; le pity à 10 boosters ne se déclenche plus que dans 4,6 % des séries ; une Godlevel apparaît dans 0,56 % des boosters.
- 10 est aussi le maximum accepté par la base (`booster_openings.card_ids`) et par la validation de la config. Aller au-delà demandera une migration ; un test le vérifie.

## Installation

- **Scripts d'installation autorisés dans `package.json` (`allowScripts`).** Les versions récentes de npm bloquent les scripts d'installation non approuvés. Quatre paquets en ont besoin pour leur moteur natif : esbuild et @swc/core (service worker), @parcel/watcher (traductions en développement), unrs-resolver (ESLint). Les autorisations visent une version précise : après une mise à jour de ces paquets, npm peut redemander l'approbation (`npm install-scripts approve <paquet>`).
- **Alerte `npm audit` sur `braces` ignorée.** Elle ne concerne qu'ESLint, sur le poste de développement, jamais le site en ligne. `npm audit fix --force` casserait la configuration ESLint de Next.js 16. À revoir quand Next.js mettra sa dépendance à jour.

## Revue de la phase 1 (suite)

- **Un message par cause de refus.** « Trop de tentatives » ne désigne plus que notre propre limite. Limite d'envoi d'e-mails de Supabase, adresse non autorisée par l'envoi intégré, inscriptions désactivées et base injoignable ont chacune leur message. La vraie cause et la solution sont écrites dans le terminal du serveur.
- **Limites de débit 20 fois plus larges hors production** (`RATE_LIMIT_MULTIPLIER`), pour pouvoir tester l'inscription à répétition.
- **`npm run doctor`** : diagnostic de l'installation, avec `--reset-limits` pour effacer les compteurs.
- **Pages de connexion et d'inscription centrées, sans la vitrine des raretés** (demande du propriétaire). Elle reste sur l'accueil.
- **« ← Retour à … » au lieu du fil d'Ariane sur ces pages.** La cible est la page visitée juste avant, mémorisée dans une pile propre à l'onglet (stockage de session, rien n'est envoyé au serveur) ; revenir en arrière dépile. Sans historique, le lien mène au parent logique (ex. mot de passe oublié → connexion). Le fil d'Ariane reste sur les autres pages.
- **Liens d'action à l'infinitif** : « Déjà un compte ? Se connecter » et, par cohérence, « Pas encore de compte ? S'inscrire ».

## Rangs, trophées et MemeMoney (demande du propriétaire)

- **Les trophées remplacent l'ELO, les rangs remplacent les niveaux (XP supprimée).** +25 par victoire, −25 par défaite, 0 pour un nul, jamais sous 0. Un rang tous les 1 000 trophées : bronze, argent, fer, or, platine, diamant, maître, grand maître, super grand maître, immortel (l'ordre demandé, fer après argent, est conservé). Immortel n'a pas de plafond.
- **Le rang suit les trophées** : un joueur qui perd peut redescendre. Les **récompenses** d'un rang ne sont données **qu'une fois** (`profiles.highest_rank`), sinon on pourrait les cumuler en descendant puis remontant.
- **Récompenses de rang proposées** (`RANK_REWARDS`) : argent 3 boosters + 10 MemeMoney, puis de plus en plus généreuses jusqu'à immortel (10 boosters + 150). Les boosters offerts vont dans la réserve « bonus », qui se cumule, contrairement aux 3 boosters gratuits du jour.
- **MemeMoney** : +1 par victoire classée ; booster en plus 20, spécial 40, très spécial 80. Les achats en argent réel portent désormais sur des packs de MemeMoney (prix provisoires : 20 pour 0,99 €, 110 pour 4,99 €, 240 pour 9,99 €). La colonne `purchases.boosters` devient `meme_money`.
- **Contenu des boosters spéciaux et très spéciaux à définir en phase 2.** Proposition : spécial = 10e carte épique ou mieux ; très spécial = 10e carte légendaire ou mieux. Leurs probabilités seront publiées comme les autres.
- **Matchmaking par trophées** : adversaire à ±150 trophées, fenêtre élargie de 100 toutes les 5 s (phase 4).
- **Historique des trophées** (`trophy_history`) : un point par changement, pour le graphique du profil. Lisible par les joueurs connectés, comme le profil.

## Interface du joueur (demande du propriétaire)

- **Barre du haut** : rang et trophées à gauche (lien vers le profil), titre au centre, MemeMoney à droite. **Navigation en bas, au centre**, qui reste visible pendant le défilement puis se pose au-dessus du pied de page.
- **Plus de fil d'Ariane dans l'espace joueur.** Seules les pages légales affichent « ← Retour à l'accueil » (joueur ou visiteur). Les pages Raretés et légales gardent la barre du joueur s'il est connecté.
- **Déconnexion et suppression du compte dans les Réglages**, pas dans le Profil : le profil est la vitrine publique du joueur, les réglages concernent son compte.
- **Suppression du compte** : fenêtre de confirmation où le joueur retape son pseudo, vérifié aussi par le serveur. Tout ce qui lui appartient est effacé (cascade depuis `auth.users`) ; ses achats restent pour la comptabilité et ses combats pour ses adversaires, sans lien avec lui. Testé en pgTAP.
- **Profil** : date d'arrivée, rang, victoires / nuls / défaites en nombres et pourcentages, ratio, séries, graphique des trophées avec choix de la période. L'heure de référence du graphique vient du serveur, pour éviter un décalage à l'hydratation.

## Langues et thèmes (demande du propriétaire)

- **Ordre des langues** : anglais, chinois mandarin, espagnol, arabe, français, portugais, allemand (nombre total de locuteurs ; les sources divergent pour l'arabe et le français). Chaque langue est affichée dans sa propre langue.
- **Détection** : choix du joueur, puis langue du navigateur, puis pays, puis anglais si la langue détectée n'est pas encore traduite, sinon français. La langue du navigateur passe avant le pays : elle reflète mieux la langue parlée (un francophone en voyage reste en français).
- **Traductions livrées : français et anglais.** Chinois, arabe (avec mise en page de droite à gauche), espagnol, portugais et allemand : prochaine livraison ; ils apparaissent « Bientôt » dans les réglages. Un test vérifie qu'une langue disponible traduit toutes les clés. Les textes juridiques restent en français (version qui fait foi), avec une mention dans les autres langues.
- **Thème inversé** : l'interface en négatif photo ; cartes, sachets et illustrations gardent leurs vraies couleurs. **Personnalisé** : couleur principale parmi 8 et fond clair ou obscur ; la couleur du texte sur l'accent est choisie automatiquement pour rester lisible.
- **Préférences enregistrées dans le compte et dans des cookies** (appliquées dès le premier affichage, sans clignotement), recopiées automatiquement sur un nouvel appareil.
- **Page `/apercu`** (développement uniquement, 404 en production) pour travailler le design des pages joueur sans compte.

## Raretés et boosters (refonte demandée par le propriétaire)

- **7 raretés** : commune, rare, épique, légendaire, brainrot, superbrainrot, godlevel. Mystique et omniversal disparaissent ; la migration convertit mystique → épique et omniversal → brainrot (aucune carte n'existait encore).
- **Boosters à composition fixe** au lieu de taux par emplacement. Chacun a des cartes garanties et un emplacement « au choix », orienté vers la rareté habituelle :
  - journalier : 5 communes, 3 rares, 1 épique + 1 épique (85 %) ou 1 légendaire (15 %) ;
  - spécial : 3 communes, 3 rares, 2 épiques, 1 légendaire + 1 légendaire (88 %) ou 1 brainrot (12 %) ;
  - très spécial : 2 communes, 2 rares, 2 épiques, 2 légendaires, 1 brainrot + 1 brainrot (90 %) ou 1 superbrainrot (10 %).
- **Godlevel uniquement par chance**, dans tous les boosters : elle remplace une commune, avec 0,05 % (journalier), 0,1 % (spécial) ou 0,25 % (très spécial) de chance par booster. Pourcentages proposés, modifiables dans `BOOSTERS`.
- **Pity conservé** pour le booster journalier : la légendaire est garantie au 10e booster d'affilée sans elle.
- **Probabilités publiées** calculées depuis la même config que le tirage (`src/lib/economy/boosters.ts`, testé, y compris statistiquement). La page Raretés affiche, pour chaque rareté, la chance d'en obtenir au moins une dans le booster le plus accessible.
- **Budget de stats** : 7 rangs, de 160 (commune) à 208 (godlevel).

## Boutique et navigation (demande du propriétaire)

- **La Boutique ne vend que de la MemeMoney** en argent réel. Les boosters en plus, spéciaux et très spéciaux s'achètent en MemeMoney depuis la case Boosters de l'accueil.
- **Accès à la Boutique** : compteur de MemeMoney (en haut à droite), bouton de la barre de navigation, case de l'accueil.
- **Packs** : 20, 110 (100 + 10), 240 (200 + 40), 650 (500 + 150) MemeMoney ; le bonus grandit avec le pack. Prix provisoires.
- **Prix locaux par paliers ronds**, comme les boutiques d'applications (pas de conversion au taux du jour), dans 13 devises choisies selon le pays (`src/config/shop.ts`). Le paiement réel (Stripe) arrive en phase 5 : les boutons « Acheter » sont désactivés d'ici là.
- **Offres honnêtes** : « première recharge ×2 » et une réduction de lancement datée. Les dates sont réelles : aucun faux compte à rebours ni pression artificielle.
- **Barre de navigation** : Boutique, Raretés, Accueil (au centre, rond, surélevé), Profil, Réglages.
- **Logo** : petit dandinement périodique, rebond au survol, « boing » et confettis au clic avant de revenir à l'accueil (sauf si le joueur préfère réduire les animations).

## Thèmes (demande du propriétaire)

- **Obscur** : noir et gris neutres, plus aucun bleu.
- **Inversé** : tout est inversé, cartes et boosters compris. Une blague assumée.
- **Personnalisé** : fond clair, obscur ou inversé.

## Traductions

- **7 langues complètes** : anglais, chinois mandarin (simplifié), espagnol, arabe (mise en page de droite à gauche), français, portugais, allemand. Tutoiement dans chaque langue qui le distingue. Les marges utilisent des propriétés logiques (début / fin) pour se retourner en arabe ; le graphique des trophées reste de gauche à droite (le temps).
- Ces traductions ont été écrites sans relecture par des locuteurs natifs : à faire relire avant le lancement, surtout le chinois et l'arabe.

## Images de memes (à trancher avant la phase 2)

- Le propriétaire prévoit d'utiliser des images de memes venues d'internet. **La plupart ne sont pas libres de droits** (droit d'auteur de l'image d'origine, droit à l'image des personnes photographiées, parfois des marques déposées). Mentions légales et pied de page sont rédigés pour couvrir les deux cas et prévoir le retrait sur demande.
- À prévoir en phase 2 : pour chaque carte, la source, l'auteur et la licence de l'image (champs dans l'administration) et une procédure de retrait rapide.

## Ajustements (demande du propriétaire)

- **Boosters renommés** : « Booster en plus » (inchangé), « Super Booster » (ex-spécial, 40 MemeMoney), « Ultra Booster » (ex-très spécial, 80 MemeMoney). Les clés techniques restent `special` et `very_special`. Noms adaptés dans chaque langue (Súper Sobre, Super Pacote, Super-Booster, 超级卡包, حزمة سوبر…).
- **Pièce de MemeMoney** : un « M » traversé de deux barres horizontales, sur le modèle du peso (₱).
- **Bouton Accueil** : l'anneau de pointillés animé est retiré, pour ne pas distraire le joueur.
- **Boutique** : plus de second compteur de MemeMoney ; celui de la barre du haut suffit.
- **Pied de page (français)** : « contactez-nous », au vouvoiement, pour la demande de retrait d'un contenu.

## Navigation, Infos et contact (demande du propriétaire)

- **Œil sur les champs mot de passe** (connexion, inscription, nouveau mot de passe) : bouton accessible au clavier et aux lecteurs d'écran.
- **Page `/contact`** avec formulaire (e-mail, sujet, message). Les messages sont enregistrés dans `contact_messages` (aucun accès client, lecture depuis Supabase) en attendant l'adresse e-mail dédiée ; quand `LEGAL.PUBLISHER.email` est renseignée, elle s'affiche aussi. Champ piège contre les robots, 5 messages par heure et par adresse IP.
- **Accès au contact** : bouton « Nous contacter » sur l'accueil visiteur, sous les formulaires de connexion et d'inscription, lien « contactez-nous » et entrée « Contact » du pied de page. Pour le joueur connecté : section **« Aide et contact » dans les Réglages**, l'endroit où l'on cherche naturellement de l'aide, sans encombrer la navigation de jeu ; le pied de page reste aussi disponible.
- **« Infos » plutôt que « Informations »** : un mot court, qui tient dans la barre de navigation à 5 boutons sur un téléphone de 375 px. Infos regroupe trois pages glissantes : Raretés, Classement (ouvert par défaut) et News.
- **Classement à trois portées** : « Autour de moi » (±250 trophées, positions mondiales), « Mon rang » (positions dans le rang), « Monde » (50 meilleurs). Égalité départagée par l'ancienneté d'inscription. Calculé directement sur `profiles` ; la vue matérialisée `player_rankings` prendra le relais quand le nombre de joueurs le demandera.
- **News** dans `src/content/news.ts` (français obligatoire, autres langues facultatives avec repli sur le français), en attendant une gestion depuis l'administration.
- **Accueil du joueur en pages glissantes** : Collection, Boosters (au milieu, ouvert par défaut), Batailles. La case Boutique disparaît ; un lien discret dans la page Boosters rappelle l'offre de première recharge.
- **Pages glissantes** : onglets du bandeau, glissement au doigt, flèches du clavier (pas de boutons fléchés sur les côtés, à la demande du propriétaire), hauteur ajustée à la page affichée, onglet actif dans l'adresse (`?vue=`), mise en miroir en arabe, animations coupées si le joueur préfère réduire les mouvements.

## Prix de la Boutique (demande du propriétaire)

- **Packs** : 20 MemeMoney à 0,25 €, 110 à 1 €, 240 à 2 €, 650 à 5 € (prix locaux recalculés dans les 13 devises, `src/config/shop.ts`). Les plus gros packs restent les plus avantageux.
- **À trancher avant la phase 5 (paiements)** : Stripe refuse les paiements par carte sous 0,50 € ; le pack à 0,25 € ne pourra donc pas être payé seul. Et sur les petits montants, les frais de carte (de l'ordre de 0,25 € fixes + un pourcentage en Europe, à vérifier sur le site de Stripe) absorbent l'essentiel du prix : un achat à 0,25 € ne rapporterait rien, un achat à 1 € environ 0,75 €.
- **Libellé du bouton de contact** : « Contactez-nous » (sans icône), sur l'accueil, sous la connexion et l'inscription, et dans les Réglages.
