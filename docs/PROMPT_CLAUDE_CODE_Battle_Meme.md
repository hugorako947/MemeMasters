# Prompt pour Claude Code : « Battle Meme », le battle royale 2D

> Dépôt : https://github.com/hugorako947/MemeMasters.git (tu travailles dans ce dépôt, à jour).
> Colle ce texte entier dans Claude Code, ou place-le dans `docs/` et donne-le-lui avec `@docs/PROMPT_CLAUDE_CODE_Battle_Meme.md`.

---

<regles_permanentes>
Ces règles valent pour toute la suite du projet, sans que j'aie à les rappeler :

1. **« Explique-moi ce que tu comptes modifier avant de le faire, surtout pour les changements qui touchent plusieurs fichiers. »**
   Avant chaque modification, annonce les fichiers concernés et ce qui change dans chacun, puis attends mon accord quand plusieurs fichiers sont touchés.

2. **« Analyse, intègre et comprends CLAUDE.md. Met-le à jour régulièrement quand une nouvelle règle ou une nouvelle décision apparaît, pour que la mémoire du projet reste à jour. »**
   Relis CLAUDE.md en entier au début de chaque session. Chaque décision durable s'ajoute dans CLAUDE.md, et en détail dans DECISIONS.md, dans la même tâche que le changement qui la crée.

3. **« Ne fais pas d'erreurs. »**
   Concrètement :
   - lis le code existant avant d'écrire ;
   - vérifie chaque API de Next.js 16 dans `node_modules/next/dist/docs/` plutôt que de te fier à ta mémoire ;
   - écris les tests avant la logique de jeu ;
   - avant de dire « terminé », passe la checklist §13 de CLAUDE.md : `npm run check`, `npm run db:check-local` si la base change, `npm run build` si le changement est important ;
   - affiche réellement les pages touchées ;
   - si tu n'es pas sûr d'une règle de jeu, demande-moi au lieu de deviner (CLAUDE.md §2, règle 1).

Ces trois règles complètent celles de CLAUDE.md. Elles ne les remplacent pas.
</regles_permanentes>

<contexte>
Le jeu est une PWA de cartes à collectionner sur le thème des memes. Tout est en place sauf les batailles : comptes, 7 raretés, boosters (pity, probabilités publiées), collection, évolutions ★/★★/★★★, revente, MemeMoney, boutique (paiements Stripe en phase 5), rangs et trophées, classements, amis, messagerie, modération, défi du jour, Communauté, tableau de bord Admin et Super Admin, 7 langues. Tout est décrit dans CLAUDE.md et DECISIONS.md.

**Le cœur du jeu est maintenant décidé** : les batailles sont un **battle royale 2D vu de dessus, jusqu'à 100 participants**. Chaque carte de meme est un **personnage jouable** à part entière. On joue **en solo contre des bots** qui portent les personnages, les statistiques et les pseudos de vrais joueurs inscrits. Il existe aussi des **parties entre amis**.

Contraintes d'hébergement : **Vercel + Supabase uniquement, aucun serveur de jeu permanent.** Vercel n'exécute que des fonctions courtes. Supabase Realtime est limité (de l'ordre de 100 messages par seconde en offre gratuite et 500 en Pro, pour tout le projet) et ne doit jamais transporter le déroulé d'une partie. Vérifie ces limites dans la documentation actuelle de Supabase et de Vercel avant de concevoir.

Le code de l'ancienne « arène à tours » existe encore : `src/lib/battle/`, `src/components/battle/`, page `/bataille`, tables `battles`, `battle_secrets`, `battle_actions`, `battle_turns`. Il est remplacé par ce concept. Tu peux réutiliser ses bonnes idées : moteur pur et déterministe en nombres entiers, générateur aléatoire à graine. Pour son sort (suppression, réutilisation, tables à garder ou à abandonner par une nouvelle migration), fais une proposition en phase 0 et attends mon accord. Ne modifie jamais une migration déjà livrée.
</contexte>

<taches_immediates>
Avant la phase 0, fais ces deux petits changements. Annonce-les d'abord, comme toujours.

**1. Nom du jeu.** Le jeu s'appelle désormais **« Battle Meme »**, de façon provisoire : un jeu du même nom existe déjà, donc le nom changera encore. Change uniquement `GAME_CONFIG.GAME_NAME` dans `src/config/game.config.ts`. Vérifie ensuite que le nom suit partout : manifest de la PWA, titres de pages, e-mails, textes des 7 langues, pages légales, icônes si elles contiennent du texte. Aucun « MemeMasters » ne doit rester en dur ; fais un `grep -ri mememasters` pour le vérifier. Ne renomme ni le dépôt, ni les clés techniques, ni les noms de tables.

**2. Écran de chargement de l'Accueil.** Quand on clique sur le bouton Accueil de la navigation, l'écran des cartes animées couvre aujourd'hui toute la page.

- **Cause probable** : l'accueil du joueur est `src/app/page.tsx`, hors du groupe `(jeu)`. Il utilise donc `src/app/loading.tsx` (`<LoadingScreen fullscreen />`) au lieu de `src/app/(jeu)/loading.tsx` (`<LoadingScreen />`, qui garde le cadre).
- **Comportement voulu** : comme pour les autres pages du jeu, l'écran de chargement laisse visibles :
  - la barre de navigation en bas ;
  - le logo et le titre en haut au centre ;
  - le rang et les trophées en haut à gauche ;
  - le compteur de MemeMoney en haut à droite, qui mène à la Boutique.
- **Contrainte** : l'accueil des **visiteurs** (non connectés) garde son comportement actuel.
- Propose la solution la plus propre (réorganisation des routes ou des layouts, écran de chargement qui reconnaît un joueur connecté, ou autre) avec ses avantages et ses risques, puis applique-la après mon accord.
- **Vérifie en conditions réelles** : `npm run build && npm start`, navigation depuis Boutique, Infos, Profil et Réglages vers l'Accueil, sur 375 px et sur grand écran.
</taches_immediates>

<concept_battle_royale>

<modes_de_jeu>
Le joueur choisit un mode depuis la page « Batailles » de l'accueil (Collection | Boosters | Batailles).

**A. Partie classée (mode principal, seul à rapporter trophées et MemeMoney)**
- Le joueur joue seul, en vrai : il se déplace, vise, tire, ramasse du butin et fuit la zone. Le jeu tourne dans son navigateur.
- Les autres participants (99 par défaut, nombre configurable) sont des **bots**. Chaque bot porte le personnage choisi par un **vrai joueur inscrit**, avec ses statistiques, son niveau d'évolution et son pseudo, tels qu'enregistrés au moment où la partie est créée.
- Les adversaires sont tirés parmi des joueurs au nombre de trophées proche, actifs récemment. On exclut le joueur lui-même, les joueurs bannis et les joueurs bloqués dans un sens ou dans l'autre.
- S'il n'y a pas assez de vrais joueurs, surtout au lancement, on complète avec des **bots « système »**. Ils utilisent des cartes du jeu et sont **clairement présentés comme des bots** : on ne fait jamais passer un bot pour un humain.
- La partie est créée par le serveur : graine, carte, butin, liste des adversaires figée. À la fin, elle est **vérifiée par le serveur** (voir `<anti_triche>`) avant toute récompense.

**B. Entre amis + bots (non classée)**
- Un joueur crée une salle et invite des amis (liste d'amis existante). Ils jouent **ensemble, en direct**, dans la même partie.
- Les places manquantes sont remplies par des bots, comme en partie classée.

**C. Entre amis uniquement (non classée)**
- Comme B, mais **uniquement des comptes humains, aucun bot**. Il faut au moins 2 joueurs ; le maximum est configurable (proposition : 8).

**Technique des modes B et C : pair-à-pair, sans serveur de jeu.**
- Le navigateur de l'**hôte** fait tourner la partie et fait foi.
- Les autres joueurs lui envoient leurs commandes et reçoivent l'état de la partie par **WebRTC** (canaux de données).
- **Supabase Realtime** ne sert qu'à la salle d'attente (présence, invitations, « prêt ») et à la mise en relation des appareils (échange des offres WebRTC). Cela représente très peu de messages, compatible avec les limites.
- Prévois un serveur STUN public et un service **TURN** pour les réseaux qui bloquent les connexions directes. Propose un fournisseur et son coût en phase 0.
- **Déconnexion** : un invité a 60 secondes pour revenir, sinon son personnage est éliminé. Si l'hôte part, la partie s'arrête ; aucune récompense n'est en jeu.
- Choisis en phase 0 entre « hôte qui envoie l'état » et « simulation identique sur chaque appareil (lockstep) », en justifiant : robustesse sur réseau mobile, joueur en retard, téléphone lent.

**Récompenses des modes B et C** : proposition, **ni trophées ni MemeMoney**, car l'hôte pourrait tricher et des amis pourraient « farmer » entre eux. Ces parties peuvent compter pour un défi du jour du type « Joue une partie avec un ami ». **À me faire valider en phase 0.**

**Mode Entraînement hors ligne (optionnel)** : partie solo contre des bots, sans récompense, jouable sans réseau si c'est simple. Donne ton avis en phase 0.

**Règle importante : la progression vient uniquement de ses propres parties.** Un joueur ne gagne ni ne perd rien (trophées, MemeMoney, défis, statistiques de profil) quand son personnage apparaît comme bot dans la partie d'un autre, et il n'en est pas notifié. Seules les parties qu'il joue lui-même le font progresser.
</modes_de_jeu>

<deroulement_d_une_partie>
Les valeurs ci-dessous sont des propositions. Elles sont toutes dans la configuration (`GAME_CONFIG`, validée par Zod), à affiner en phase 0 avec des simulations.

- **Avant la partie** : le joueur choisit son personnage parmi les cartes qu'il possède. Ce choix est mémorisé et sert aussi de personnage « fantôme » pour les autres joueurs.
- **Arrivée** : tous les participants apparaissent à des endroits répartis sur la carte, avec une arme de départ faible.
- **Butin** : armes (pistolet, fusil à pompe, mitraillette, fusil de précision… avec des noms et des visuels originaux et drôles), munitions, soins, armure. Les **mêmes chances pour tout le monde** : la rareté du personnage ne change jamais le butin.
- **Zone** : elle rétrécit par étapes et inflige des dégâts croissants à l'extérieur. Visuellement, on peut la présenter comme « le scroll » qui chasse les memes du fil d'actualité.
- **Carte** : générée à partir de la graine, avec obstacles, couvertures et bâtiments simples. Elle est lisible en vue de dessus.
- **Durée visée** : 5 à 8 minutes.
- **Fin** : quand il ne reste qu'un participant, quand le joueur est éliminé (en classée, la partie peut alors être calculée jusqu'au bout pour donner son classement final), ou quand le joueur abandonne.
- **Abandon** : fermer l'onglet au milieu d'une partie classée compte comme une élimination à la place actuelle. Propose la règle exacte.
- **Écran de fin** : place, éliminations, dégâts infligés, personnage qui l'a éliminé (avec le pseudo du joueur réel), récompenses, bouton « Rejouer ».
</deroulement_d_une_partie>

<personnages>
Chaque carte de meme est un personnage jouable, avec ses **avantages et ses inconvénients** :

| Stat de la carte | Dans le battle royale |
|---|---|
| PV | Points de vie |
| DÉF | Armure |
| VIT | Vitesse de déplacement |
| ATQ | Multiplicateur de dégâts des armes |
| Attaque spéciale | **Capacité active** avec temps de recharge (au lieu du coût en énergie) ; ses effets existants (`stun`, `drain`, `multi`, `dot`, `pierce`, `buff`, `debuff`) sont transposés |
| Défense | **Passif** : `heal` → régénération, `dodge` → esquive, `reflect` → renvoi de dégâts, `cleanse` → annulation des effets négatifs, `recharge` → recharge plus rapide de la capacité |

- **Inconvénients réels** : la taille de la zone de touche peut croître avec les PV (un personnage robuste est plus facile à toucher), un personnage rapide est fragile, etc. Propose un système clair.
- **Rareté** : un personnage plus rare est plus fort, mais **l'écart est borné et configurable**. Les boosters s'achètent indirectement avec de l'argent réel : un écart trop grand rendrait le jeu « payant pour gagner », ce qui tue un jeu de tir. Mesure l'écart avec des tournois de bots (voir `<bots>`). Propose une limite, par exemple : à niveau égal, une godlevel ne gagne pas plus de X fois plus souvent qu'une commune.
- **Évolutions** : les évolutions ★/★★/★★★ actuelles (exemplaires + bonus de statistiques) sont conservées et s'appliquent au personnage. Le bonus reste modeste et configurable.
- **Maîtrise (proposition à valider)** : une progression **par personnage**, gagnée seulement en jouant avec lui (parties jouées, places, éliminations). Elle débloque des récompenses **cosmétiques** (cadre, effet, titre), pas de puissance. Elle respecte la règle « on progresse en jouant ».
- **Mêmes conditions pour tous** : même champ de vision quelle que soit la taille de l'écran (fixé par le moteur, pas par la fenêtre), même chance de butin, même vitesse de la zone.
- **Apparence** : une bulle ronde avec l'illustration de la carte (`imageUrl`, sinon l'illustration générée à partir de `artSeed` par `src/lib/art/`). Le cadre est aux couleurs de la rareté, les étoiles d'évolution sont visibles, et l'arme est dessinée à côté de la bulle.
- **Fiche personnage** : dans la Collection, la carte agrandie montre aussi ses statistiques de bataille (PV, armure, vitesse, dégâts, capacité, passif, avantages et inconvénients) et un bouton « Choisir pour les batailles ».
</personnages>

<moteur>
Le moteur est le cœur de l'équité. Il est écrit **avant** tout le reste, **tests d'abord**.

- **Fonction pure et déterministe** : `(état, commandes du tick) → nouvel état`. Pas d'accès au DOM, au réseau ni à l'heure. Exécutable dans le navigateur, sur Vercel (Node) et dans Vitest.
- **Pas de temps fixe** : par exemple 20 ou 30 calculs par seconde. L'affichage à 60 images par seconde interpole entre deux états.
- **Déterminisme strict** :
  - nombres entiers ou à virgule fixe partout ;
  - **aucun** `Math.random`, `Math.sin`, `Math.cos`, `Math.atan2` ou `Math.sqrt` en virgule flottante dans la simulation, car leurs résultats peuvent varier d'un moteur JavaScript à l'autre : utilise des tables ou des approximations entières testées ;
  - générateur aléatoire à graine, avec des flux séparés (carte, butin, bots) ;
  - ordre d'itération stable.
- **Test de déterminisme obligatoire** : une même graine et les mêmes commandes donnent un état final identique, octet pour octet, sur plusieurs centaines de parties.
- **Commandes du joueur** : direction de déplacement et angle de visée quantifiés, plus des boutons sous forme de bits. Elles sont enregistrées tick par tick et compressées ; une partie doit tenir en quelques dizaines de Ko au plus.
- **Performances** : 100 participants plus leurs bots doivent tourner sur un téléphone de milieu de gamme. Utilise une grille spatiale pour les collisions et les tirs, et une IA calculée moins souvent et en décalé. Fixe un budget en millisecondes par tick et teste-le.
- **Rejeu serveur** : le moteur doit pouvoir rejouer une partie complète à partir de la graine et des commandes, sans affichage, en quelques secondes au plus. Mesure ce temps et compare-le à la durée maximale des fonctions Vercel de mon plan (à vérifier dans la documentation).
</moteur>

<bots>
Les bots doivent être **bien codés et réagir correctement, voire très bien, à leur environnement**. C'est ce qui rend le mode classé crédible.

- **Perception** : le même champ de vision que le joueur, la ligne de vue bloquée par les obstacles, l'« audition » des tirs proches, la mémoire de la dernière position connue d'un ennemi.
- **Déplacement** : chemin sur grille (A* ou champ de flux) vers le butin, la zone ou une couverture. Les bots ne restent jamais coincés contre un mur (détection et sortie de blocage).
- **Décisions** : une IA par scores d'utilité, qui compare à chaque instant :
  - ramasser du butin ;
  - se soigner ;
  - attaquer ;
  - fuir ;
  - se mettre à couvert ;
  - rejoindre la zone à temps ;
  - profiter d'un combat entre deux autres.
- **Combat** : temps de réaction, erreur de visée, anticipation du mouvement de la cible, déplacements latéraux, rechargement au bon moment, repli quand les PV sont bas, usage de la capacité active au bon moment.
- **Personnalités** : style déduit du personnage (prudent, agressif, mobile, tireur de loin…) avec une variation aléatoire à graine, pour que deux bots ne jouent jamais pareil. Les bots se battent aussi entre eux.
- **Difficulté liée aux trophées** : comme tous les adversaires d'une partie classée sont des bots, leur difficulté (réaction, précision, décisions) **suit le nombre de trophées du joueur**. C'est notre « matchmaking » : un débutant affronte des bots accessibles, un Immortel des bots redoutables. La courbe est configurable.
- **Déterminisme** : les bots font partie du moteur. Ils utilisent le générateur à graine et ne lisent rien d'extérieur, pour que le rejeu serveur donne exactement la même partie.
- **Banc d'essai obligatoire** : un script Node sans affichage (`npm run bots:tournament`) fait jouer des milliers de parties bot contre bot et produit des indicateurs :
  - durée moyenne ;
  - répartition des places par rareté et par évolution ;
  - part des morts dues à la zone (trop élevée = IA qui gère mal la zone) ;
  - bots restés immobiles ;
  - taux de victoire par personnage.
  Fixe des seuils cibles en phase 0 et fais échouer le script quand ils ne sont pas tenus. Ces chiffres servent aussi à équilibrer les cartes.
</bots>

<anti_triche>
Règle d'or de CLAUDE.md : **le client ne décide jamais**.

- **Ticket de partie** : `POST /api/battle/start` crée la partie côté serveur (graine, adversaires figés, heure de début, mode) et renvoie un identifiant à usage unique, qui expire.
- **Une seule partie classée en cours** par joueur.
- **Envoi de la partie** : `POST /api/battle/submit` reçoit les commandes enregistrées. Le serveur rejoue la partie avec le moteur et **calcule lui-même** la place, les éliminations et les récompenses, dans une transaction.
- **Contrôles de vraisemblance** :
  - la durée réelle entre le début et l'envoi doit être au moins égale à la durée simulée ;
  - vitesse de rotation de la visée plafonnée ;
  - commandes impossibles refusées ;
  - un seul envoi par ticket.
- **Partie non envoyée** : elle est comptée comme un abandon à l'expiration du ticket.
- **Protections habituelles** : limites de débit (`RATE_LIMITS`), validation Zod, `assertSameOrigin`, modèle de route de CLAUDE.md §6.
- **Stockage** : les commandes compressées sont conservées un temps limité (Storage ou table), pour revoir une partie signalée par la modération.
</anti_triche>

<economie>
Le système actuel (+25 / −25 / 0 par victoire, défaite ou nul ; 1 MemeMoney par victoire) est **remplacé**. Les trophées et la MemeMoney dépendent de la **place finale** : plus on est proche du Top 1, plus on gagne.

**Trophées** (proposition de départ pour 100 participants, à ajuster par simulation) :

| Place | Trophées |
|---|---|
| Top 1 | +40 |
| 2 – 3 | +30 |
| 4 – 5 | +24 |
| 6 – 10 | +18 |
| 11 – 20 | +12 |
| 21 – 30 | +6 |
| 31 – 40 | +2 |
| 41 – 50 | 0 |
| 51 – 70 | −4 |
| 71 – 90 | −8 |
| 91 – 100 | −12 |

- Petit bonus par élimination, plafonné.
- **Selon le rang** : gains réduits et pertes augmentées en montant, pour que chaque joueur se stabilise près de son vrai niveau. La difficulté des bots suit la même logique.
- On ne descend jamais sous 0 trophée.
- Les rangs (un tous les 1 000 trophées) et leurs récompenses uniques (`src/config/ranks.ts`) sont conservés.
- Si le nombre de participants change, les tranches se calculent en pourcentage du nombre de participants.

**MemeMoney** (proposition) :
- Top 1 : 5 ; Top 2–5 : 3 ; Top 6–10 : 2 ; Top 11–25 : 1 ; au-delà : 0.
- **Plafond quotidien** de MemeMoney gagnée en bataille, configurable.
- Calcule et montre-moi la MemeMoney gagnée par heure de jeu, selon le niveau du joueur, comparée au prix des boosters (20 / 40 / 80). La MemeMoney reste une monnaie fermée (CLAUDE.md §11).

**Évolutions** : conservées (exemplaires + bonus). Propose seulement les ajustements que les tournois de bots rendent nécessaires, et la « Maîtrise » cosmétique décrite plus haut.

**Défis du jour** : active les défis de bataille prévus mais inactifs, par exemple « Finis dans le Top 10 », « Élimine 5 adversaires », « Joue 3 parties classées », « Joue une partie avec un ami ».

**Tout ce qui précède est réglable** dans `GAME_CONFIG`, validé par Zod, testé, et documenté dans les pages Infos (Trophées, Rangs, MemeMoney, Carte), dans les 7 langues.
</economie>

<impacts_sur_l_existant>
Liste en phase 0 tout ce qui doit changer, et propose comment :

- **Profil** : les statistiques victoires / nuls / défaites deviennent parties jouées, Top 1, Top 10, éliminations, meilleure place, place moyenne. Le graphique des trophées est conservé.
- **Classement des cartes** : le « taux de victoire en combat » devient « taux de Top 1 » et « place moyenne » par personnage. La popularité utilise le taux d'utilisation dans les parties.
- **Infos → Carte** : l'exemple de dégâts est refait pour le battle royale.
- **Page Batailles de l'accueil** : choix du personnage, des modes A, B et C, salle d'amis, invitations, historique des dernières parties.
- **Notifications** : invitation d'un ami à une partie (point rouge existant, `getBadges()`).
- **PWA** : ne jamais proposer ni forcer le rechargement pour une mise à jour pendant une partie en cours. Le mode classé exige le réseau au début et à l'envoi ; prévois un message clair hors ligne.
- **Base de données** : nouvelles tables par **nouvelles migrations** uniquement, par exemple :
  - parties ;
  - participants figés ;
  - commandes enregistrées ;
  - personnage choisi par joueur ;
  - salles d'amis et invitations ;
  - statistiques par personnage.
  RLS et révocations sur chaque nouvelle table, avec des tests pgTAP (CLAUDE.md §7).
</impacts_sur_l_existant>

<interface_et_controles>
- **Mobile d'abord** : la partie se joue en **paysage** sur téléphone. Deux joysticks virtuels (déplacement à gauche, visée et tir à droite), boutons de capacité, soin et changement d'arme, zones tactiles d'au moins 44 px. Sur ordinateur : clavier et souris.
- **Proposition d'aide à la visée légère sur mobile**, la même pour tous, dans le moteur. Elle est réglable.
- **Rendu** : Canvas ou WebGL. Propose une bibliothèque (par exemple PixiJS) et vérifie qu'elle fonctionne avec Next.js 16, Turbopack et le service worker. Les illustrations des personnages sont regroupées dans une seule texture.
- **Lisibilité** : mini-carte, zone visible, compteur de survivants, fil des éliminations avec les pseudos, indicateurs de dégâts lisibles sans dépendre de la couleur seule.
- **Accessibilité** : `prefers-reduced-motion` réduit les tremblements d'écran et les flashs ; contrastes suffisants ; menus de la partie utilisables au clavier.
- **Plein écran** : réutilise `FullscreenToggle`. Sur iPhone, l'application installée donne le meilleur résultat.
- **Textes** : tout nouveau texte est dans les 7 langues (CLAUDE.md §9), avec le vocabulaire imposé.
- **Visuels** : armes, objets et carte sont des créations originales, sans reprendre les visuels d'un autre jeu. Les mécaniques du battle royale ne sont pas protégées ; les noms et les images d'autres jeux, si.
</interface_et_controles>

</concept_battle_royale>

<methode_de_travail>
Travaille par phases. À la fin de chaque phase : tout compile, tous les tests passent, la checklist §13 est faite, CLAUDE.md et DECISIONS.md sont à jour, et tu me résumes ce qui est fait, comment le tester et ce qui reste.

**Phase 0 – Conception (ARRÊTE-TOI ensuite et attends ma validation).** Livre un document `docs/BATTLE_ROYALE_CONCEPTION.md` contenant :
- l'architecture (client, moteur partagé, routes Vercel, Supabase, WebRTC) avec un schéma ;
- les nouvelles tables et le plan de migration, y compris le sort de l'ancien code de bataille ;
- les routes d'API ;
- le format des commandes enregistrées ;
- les mesures prévues pour les performances et le temps de rejeu ;
- les formules des personnages et de leurs inconvénients ;
- l'architecture de l'IA des bots et les seuils du banc d'essai ;
- l'économie (trophées, MemeMoney, plafond) avec une simulation chiffrée ;
- le choix technique des parties entre amis et le fournisseur TURN avec son coût ;
- la liste de tout ce qui change dans l'existant.
Pose-moi ici les questions vraiment bloquantes, et seulement celles-là, dont au minimum : récompenses des parties entre amis, règle d'abandon, écart de puissance maximal entre raretés, nombre de participants au lancement.

**Phase 1 – Moteur** : tests d'abord, déterminisme prouvé, rejeu sans affichage mesuré.

**Phase 2 – Bots** : IA complète et banc d'essai `npm run bots:tournament`, avec les seuils tenus.

**Phase 3 – Jouabilité** : rendu, contrôles mobile et ordinateur, interface de partie, écran de fin, mode Entraînement.

**Phase 4 – Partie classée** : tickets, choix des adversaires, rejeu et vérification serveur, économie par place, rangs, défis, historique.

**Phase 5 – Intégration** : page Batailles, fiche personnage, Profil, Classement, Infos, notifications, 7 langues.

**Phase 6 – Parties entre amis** : salle d'attente (Supabase Realtime), invitations, WebRTC, modes B et C, déconnexions.

**Phase 7 – Finitions** : performances sur téléphone modeste, audit de sécurité de toutes les nouvelles routes, équilibrage final avec les tournois de bots, README et guides mis à jour.

Pour une décision mineure non précisée ici, fais un choix raisonnable, note-le dans DECISIONS.md et continue. Pour toute décision qui touche l'économie, l'équité ou ce que voient les joueurs, demande-moi d'abord (CLAUDE.md §2).
</methode_de_travail>
