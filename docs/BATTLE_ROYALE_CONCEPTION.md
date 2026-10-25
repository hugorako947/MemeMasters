# Battle royale — document de conception (phase 0)

> Statut : **validé par le propriétaire le 2026-10-24**, propositions du §16 retenues (détail dans `DECISIONS.md`). Reste à préciser : les offres Vercel et Supabase (question n° 5), avant la phase 4.
> **Phase 1 (moteur) livrée le 2026-10-24 et validée. Phase 2 (bots) terminée le 2026-10-25** : les 8 seuils du §7.7 sont tenus après équilibrage (régénération réduite, compression κ étendue aux capacités et passifs, soin immédiat au ramassage) ; chiffres et raisons dans `DECISIONS.md`. **Phase 3 (jouabilité) terminée le 2026-10-25** : page `/partie`, rendu PixiJS, commandes ordinateur et téléphone, interface, écran de fin et mode Entraînement (réservé à l'équipe jusqu'à la phase 5). Les valeurs chiffrées des §6 et §7 ci-dessous sont celles de la conception d'origine : les valeurs en vigueur sont dans `GAME_CONFIG.BATTLE_ROYALE`.
> Cahier des charges : `docs/PROMPT_CLAUDE_CODE_Battle_Meme.md`. Règles du projet : `CLAUDE.md`.
> Toutes les valeurs chiffrées (stats, trophées, MemeMoney, durées) sont des **propositions** rangées dans `GAME_CONFIG` (validée par Zod) et ajustées ensuite par les tournois de bots.

---

## 0. Résumé en une page

| Sujet | Proposition |
|---|---|
| Moteur | Fonction pure et déterministe en **nombres entiers**, **20 ticks par seconde**, la même dans le navigateur, sur Vercel et dans Vitest. Mesure préliminaire : **0,22 ms par tick** (pire cas, 100 participants), soit environ **2 s pour rejouer 8 minutes** (§3.7). |
| Partie classée | Jouée dans le navigateur contre 99 bots. Le serveur crée la partie (graine, adversaires figés), reçoit les commandes **par tranches pendant la partie**, puis **rejoue toute la partie** et calcule lui-même place, éliminations et récompenses (§5). |
| Adversaires | Bots portant le personnage, les statistiques, l'évolution et le pseudo de **vrais joueurs** proches en trophées. Ils sont complétés par des bots « système » **marqués BOT**. Affichage honnête : « Tes adversaires sont des IA qui jouent les personnages de vrais joueurs » (§5.3). |
| Personnages | Statistiques de la carte → PV, armure, vitesse, dégâts, taille de la zone de touche. Attaque spéciale → **capacité active** avec recharge. Défense → **passif**. Écart entre raretés **comprimé et borné** (§6). |
| Bots | Perception honnête (même champ de vision, ligne de vue, ouïe, mémoire). Chemins sur grille. **IA par scores d'utilité**, personnalités, **difficulté qui suit les trophées du joueur**. Banc d'essai `npm run bots:tournament` avec seuils bloquants (§7). |
| Économie | Trophées et MemeMoney selon la **place finale** ; gains réduits et pertes accrues en montant. Simulation : un joueur moyen se stabilise vers 2 000 trophées, environ **4 à 6 MemeMoney par heure** de jeu, plafond quotidien proposé de **15 MemeMoney** (§8). |
| Entre amis | **Pair-à-pair WebRTC, l'hôte fait foi** (il envoie l'état). Supabase Realtime ne sert qu'à la salle d'attente et à la mise en relation. TURN : **Cloudflare Realtime**, 1 000 Go gratuits par mois puis 0,05 $/Go (§9). |
| Rendu | **PixiJS v8** (WebGL, WebGPU), chargé seulement sur la page de partie ; repli Canvas 2D si l'essai de la phase 3 déçoit (§12). |
| Ancien code | **Supprimer** l'ancienne « arène à tours » (moteur, bot, decks, composants, page `/bataille`, déjà cassée) et ses tables, par une **nouvelle** migration. On garde ses principes (moteur pur, rejeu, empreinte, graine), mais tout en entiers, ce que l'ancien moteur ne faisait pas entièrement (§10.4, §13). |
| À trancher | 9 questions au §16, dont 4 demandées par le cahier des charges. |

---

## 1. Contraintes vérifiées (documentation consultée le 2026-10-24)

| Service | Limite | Conséquence pour la conception |
|---|---|---|
| **Vercel Functions** (Fluid compute) | Durée max **300 s** (Hobby et Pro par défaut), jusqu'à 800 s en Pro ; corps de requête et de réponse **4,5 Mo** ; mémoire 2 Go et 1 vCPU par défaut. | Le rejeu serveur (quelques secondes, §3.7) tient largement. Les commandes d'une partie (~10 Ko, §4) sont très loin de 4,5 Mo. Route de rejeu : `export const maxDuration = 60` (option vérifiée dans la doc de Next.js 16). |
| **Vercel Hobby** | « *Hobby teams are restricted to non-commercial personal use only* » : tout paiement demandé aux visiteurs est un usage commercial. Hobby inclut **4 h de CPU actif par mois** et 1 million d'invocations. | **Le plan Pro est obligatoire dès que les achats (Stripe) sont ouverts.** En Hobby, 4 h de CPU ne permettraient qu'environ 1 500 parties classées rejouées par mois (§3.7). Question n° 5. |
| **Supabase Realtime** | Gratuit : 200 connexions simultanées, 100 messages/s, 2 millions de messages par mois, 20 messages de présence/s. Pro : 500 connexions, 500 messages/s, 5 millions de messages par mois (puis 2,50 $ le million). | Realtime ne transporte **jamais** le déroulé d'une partie : seulement la salle d'attente, les invitations et la mise en relation WebRTC (~150 messages par salle). On quitte le canal au lancement de la partie. |
| **Supabase base et stockage** | Gratuit : base 500 Mo, stockage 1 Go, projet **mis en pause après 1 semaine d'inactivité**. Pro (25 $/mois) : 8 Go, 100 Go, pas de pause. Pooler en mode session : nombre de clients limité par la taille de pool (petite sur Nano/Micro). | Les commandes enregistrées sont purgées après **14 jours** (sauf partie signalée). Le pooler en mode session n'accepte que 15 clients (mesuré) : la connexion du serveur repasse en mode transaction depuis le 2026-10-24 (§14, risque R2 traité). |
| **TURN Cloudflare Realtime** | STUN gratuit et illimité (`stun.cloudflare.com`). TURN : **0,05 $ par Go** sortant, **1 000 Go gratuits par mois** (partagés avec le SFU). | Coût négligeable (§9.4). Alternatives plus chères : Metered (essai 500 Mo, puis 99 $/mois pour 150 Go), Twilio. |
| **PixiJS** | v8 (8.18 à 8.19 en 2026), WebGL et WebGPU, environ 245 Ko compressé pour tout le paquet, moins après tri du code inutile ; ne fonctionne pas côté serveur. | Import dynamique dans un composant client (`ssr: false` n'est permis que dans un composant client, d'après la doc de Next.js). Le moteur, lui, ne dépend jamais de PixiJS. |

Sources : vercel.com/docs/functions/limitations, vercel.com/docs/plans/hobby, vercel.com/docs/limits/fair-use-guidelines, supabase.com/docs/guides/realtime/limits, supabase.com/pricing, supabase.com/docs/guides/platform/compute-and-disk, developers.cloudflare.com/realtime/turn/faq, metered.ca/pricing, pixijs.com.

---

## 2. Architecture

```
                         ┌──────────────────────────── NAVIGATEUR DU JOUEUR ───────────────────────────┐
                         │  Page « Partie » (client)                                                    │
                         │  ┌────────────┐   commandes du tick   ┌─────────────────────────┐            │
                         │  │ Contrôles  │ ────────────────────▶ │  MOTEUR (src/lib/br/)   │            │
                         │  │ joysticks, │                       │  fonction pure, entiers │            │
                         │  │ clavier,   │ ◀──── état (interpolé)│  + IA des bots          │            │
                         │  │ souris     │                       └────────────┬────────────┘            │
                         │  └────────────┘   ┌──────────────┐                 │ état                    │
                         │                   │ Rendu PixiJS │ ◀───────────────┘                         │
                         │                   └──────────────┘                                           │
                         └──────┬─────────────────────────┬──────────────────────────────┬──────────────┘
          1. ticket de partie   │ 2. tranches de commandes│ 3. fin de partie             │ (amis) WebRTC
             POST /api/battle/  │    (toutes les 20 s,    │    POST /api/battle/submit   │ hôte ⇄ invités
             start              │    écriture Supabase)   │                              ▼
                         ┌──────▼─────────────────────────▼───────┐            ┌──────────────────────┐
                         │   VERCEL (fonctions courtes)           │            │ STUN / TURN          │
                         │   routes /api/battle/*                 │            │ Cloudflare Realtime  │
                         │   → MÊME MOTEUR, rejoué sans affichage │            └──────────────────────┘
                         └──────┬─────────────────────────────────┘
                                │ transactions (postgres.js)
                         ┌──────▼─────────────────────────────────┐
                         │   SUPABASE                             │
                         │   Postgres : parties, participants     │
                         │   figés, tranches de commandes, stats  │
                         │   Realtime : salle d'attente et mise   │
                         │   en relation (jamais la partie)       │
                         └────────────────────────────────────────┘
```

- **Moteur partagé** (`src/lib/br/`) : TypeScript pur, sans DOM, réseau ni horloge. Il est importé tel quel par la page de partie, les routes `/api/battle/*` et Vitest. Une partie est entièrement définie par `(version du moteur, configuration, graine, participants figés, commandes du joueur)`.
- **Le temps de la partie suit l'horloge réelle** : si l'onglet passe en arrière-plan, la simulation rattrape les ticks manquants au retour, avec le personnage du joueur immobile. Pas de pause possible, donc pas de « ralenti » pour mieux viser (§5.5).
- **Versions** : chaque partie enregistre `engine_version`. Le serveur rejoue avec le même moteur ; une partie lancée avec une version retirée est annulée sans pénalité.

---

## 3. Moteur

### 3.1 Principes
- `step(état, commandes) → état` : **fonction pure**. L'état est un objet de tableaux typés (`Int32Array`…), sans référence partagée, et peut être copié pour l'interpolation.
- **20 ticks par seconde** (50 ms). L'affichage à 60 images par seconde interpole entre les deux derniers états.
- **Nombres entiers partout.**
  - Positions en virgule fixe : 1 unité de carte = 16 sous-unités ; carte de 128 × 128 tuiles de 32 unités pour 100 participants, soit 65 536 sous-unités de côté, ce qui tient dans un entier 32 bits.
  - Angles sur **256 pas**. Sinus et cosinus par une **table entière (Q14)**. Distances au carré ; racine carrée entière (méthode de Newton sur entiers, testée) seulement si besoin.
  - **Aucun** `Math.random`, `Math.sin`, `Math.cos`, `Math.atan2`, `Math.sqrt` ni nombre flottant dans la simulation. Une règle ESLint l'interdit dans `src/lib/br/**`, et un test vérifie l'absence de ces fonctions.
- **Générateur à graine** : xoshiro128** (entier 32 bits) avec **flux séparés** dérivés de la graine de la partie : carte, butin, zone, chaque bot, combats (esquive, dispersion). Un tirage dans un flux ne décale jamais les autres.
- **Ordre d'itération stable** : participants triés par numéro d'emplacement, projectiles par numéro de création. Aucun `Map`/`Set` parcouru dans la simulation sans ordre défini.
- **Version** : `ENGINE_VERSION` incrémentée à chaque changement qui modifie le résultat d'une partie (test « empreinte » qui la rappelle).

### 3.2 Contenu de l'état
Participants (position, vitesse, PV, armure, arme et munitions, effets actifs, recharge de la capacité), projectiles, objets au sol (armes, munitions, soins, armure), zone (centre, rayon, phase), compteurs (tick, survivants), journal des éliminations (tick, tueur, victime, arme).

### 3.3 Carte
- Générée par la graine : tuiles (sol, eau infranchissable, murs, buissons qui cachent sans bloquer les tirs), **bâtiments simples** (pièces rectangulaires avec portes) et couvertures (caisses).
- **Lisibilité en vue de dessus** : contraste murs et sol, buissons semi-transparents, butin avec icône et contour.
- Validation à la génération : toute zone accessible est reliée (remplissage) ; sinon on tire une autre carte avec la même graine dérivée.

### 3.4 Zone (« le Scroll »)
6 phases. Chacune enchaîne une attente, puis un rétrécissement linéaire vers un nouveau cercle tiré dans le cercle actuel. Les dégâts hors zone augmentent par phase (proposition : 1, 2, 4, 6, 10, 15 PV par seconde). Habillage : le fil d'actualité qui défile et pousse les memes hors de l'écran. Durée totale visée : **6 min 30 à 7 min 30**.

### 3.5 Commandes du joueur (par tick)
| Champ | Bits | Valeurs |
|---|---|---|
| Déplacement | 5 | 0 = immobile ; 1 à 16 = 16 directions (joystick quantifié) ; 17 à 31 réservés (marche lente) |
| Visée | 8 | 256 angles |
| Boutons | 6 | tirer, capacité, soin, arme suivante, recharger, ramasser |
| Réserve | 5 | futur (emote) |

Soit **3 octets par tick**. La rotation de la visée est **plafonnée par le moteur** (même règle pour tous les joueurs et tous les bots). L'**aide à la visée** sur mobile est légère, identique pour tous et calculée dans le moteur : léger aimant de 8 pas d'angle maximum sur la cible visible la plus proche de l'axe. Elle est réglable dans la configuration.

### 3.6 Grille spatiale et budget
- Grille de cases de 256 unités pour les collisions, les tirs et la perception des bots.
- **IA décalée** : chaque bot réfléchit 4 fois par seconde (un cinquième des bots par tick). Les chemins sont calculés par **champs de flux** partagés vers la zone et par A* borné (2 000 nœuds) vers un objectif précis, au plus 2 recalculs A* par tick.
- **Budget par tick** (test de performance, phase 1) : 2 ms en moyenne et 5 ms au 99e centile sur un ordinateur portable ; à vérifier en phase 7 sur un téléphone de milieu de gamme, avec un objectif de 8 ms par tick (16 % des 50 ms).

### 3.7 Mesure préliminaire (banc d'essai de phase 0)
Prototype jetable, hors du dépôt : entiers, table de sinus, grille spatiale, ligne de vue, IA décalée, A*, et **100 participants en vie pendant 8 minutes** (pire cas : dans une vraie partie, ils meurent au fil du temps).

| Mesure (Intel i7-1165G7, Node 24) | Résultat |
|---|---|
| Coût moyen d'un tick | **0,22 ms** |
| Rejeu d'une partie de 8 min (9 600 ticks) | **2,1 à 2,2 s** |

Le vrai moteur sera plus lourd (projectiles, butin, effets, IA plus riche) : prévoir **×3 à ×5**, soit 6 à 11 s de rejeu dans le pire cas, et 1 vCPU Vercel un peu plus lent qu'un portable. Ces chiffres restent très loin des 300 s autorisés. Coût CPU estimé : environ **10 s de CPU par partie classée**, soit environ 0,0004 $ par partie sur Vercel Pro (0,128 $ l'heure de CPU actif). Les mesures exactes sont un livrable de la phase 1.

### 3.8 Tests obligatoires (écrits avant la logique)
- **Déterminisme** : 300 parties (graines différentes, commandes aléatoires à graine) jouées deux fois → empreinte (hachage) de l'état final identique, octet pour octet. Même test entre « tick par tick » et « rejeu d'un bloc ».
- **Rejeu** : partie enregistrée puis rejouée sans affichage → même place, mêmes éliminations, même journal.
- **Invariants** : PV entre 0 et le maximum, aucun participant dans un mur, butin conservé (rien ne se crée ni ne disparaît hors règles), zone toujours incluse dans la précédente.
- **Sans flottant** : analyse du code de `src/lib/br/` (aucune fonction `Math.*` interdite).
- **Performance** : budget par tick (§3.6) et temps de rejeu, avec des seuils qui font échouer la suite de tests.

---

## 4. Format des commandes enregistrées

- **Codage** : le flux de commandes (3 octets par tick) est découpé en **plages** `(commande, répétitions)`, car un joueur garde souvent la même commande plusieurs ticks. Il est ensuite compressé (`CompressionStream("deflate-raw")` dans le navigateur, `zlib` côté serveur).
- **Taille estimée** : 9 600 ticks × 3 octets = 28,8 Ko bruts. Avec un changement de commande tous les 3 ticks en moyenne : environ 3 200 plages × 4 octets, soit **≈ 13 Ko, puis 5 à 10 Ko compressés**. On est bien sous les « quelques dizaines de Ko » visées.
- **Tranches** : une tranche toutes les **20 secondes** de jeu (400 ticks), numérotée, avec `from_tick` et `to_tick`. La dernière tranche part avec `POST /api/battle/submit`.
- **Envoi des tranches** : écrites **directement dans Supabase** depuis le navigateur. La règle RLS d'insertion n'autorise que le propriétaire d'une partie en cours. `received_at` est rempli par la base, le client ne peut pas le choisir. Résultat : aucun appel Vercel pendant la partie (24 tranches par partie, sinon 24 invocations).
- **Conservation** : 14 jours, puis purge quotidienne (cron Vercel protégé par `CRON_SECRET`). Une partie signalée par la modération est gardée jusqu'à son traitement. La rejouer sert aussi à la revoir.

---

## 5. Partie classée (mode A)

### 5.1 Déroulé côté serveur
1. **`POST /api/battle/start`** `{ mode: "ranked" }`, sur le modèle de route de CLAUDE.md §6 (`assertSameOrigin`, `apiPlayer`, limite de débit, Zod) :
   - termine d'abord une éventuelle partie classée expirée du joueur, comptée comme abandon (§5.4) : **une seule partie classée à la fois** ;
   - choisit les adversaires (§5.2), fige leur personnage dans `br_participants`, tire la graine (aléa cryptographique) ;
   - enregistre la partie (`status = running`, `started_at`, `expires_at = started_at + durée max + 2 min`) ;
   - renvoie l'identifiant de partie (usage unique), la graine, les participants figés et la configuration.
2. **Pendant la partie** : tranches de commandes écrites dans `br_input_chunks` (§4).
3. **`POST /api/battle/submit`** `{ matchId, lastChunk }` (`maxDuration = 60`) :
   - vérifie (§5.5) et **rejoue toute la partie** avec le moteur ;
   - calcule place, éliminations, dégâts, éliminé par qui ;
   - dans **une transaction** : trophées, MemeMoney (avec plafond), statistiques, défis, maîtrise, `status = finished` ;
   - **un seul envoi par partie** (verrou `for update` sur la ligne de la partie).
4. **Écran de fin** : il affiche le résultat **renvoyé par le serveur**. Le calcul local sert seulement à afficher l'écran aussitôt ; en cas d'écart, le serveur fait foi et le message le dit.

### 5.2 Choix des adversaires
- Candidats : joueurs ayant choisi un personnage (`br_characters`), actifs dans les **14 derniers jours** (`last_seen_at`), non bannis.
- Exclus : le joueur lui-même et les joueurs bloqués dans un sens ou dans l'autre. Exclus aussi, si la question n° 7 est validée ainsi, les joueurs qui ont refusé d'apparaître.
- Trophées dans une fenêtre de **± 300**, élargie par pas de 300 jusqu'à ± 1 500 ; tirage au hasard parmi les candidats, au plus 99.
- Le reste est complété par des **bots « système »** : cartes actives du jeu, nom de la forme « BOT · Pixel », **badge BOT visible partout** (liste des survivants, fil des éliminations, écran de fin).
- **Figés** à la création : pseudo, carte, statistiques, niveau d'évolution. Si le joueur réel change ensuite de personnage ou de pseudo, la partie n'est pas modifiée.
- **La progression ne vient que de ses propres parties** : apparaître comme bot ne rapporte ni ne coûte rien, et ne déclenche aucune notification.

### 5.3 Transparence (à valider, question n° 7)
- Texte du mode classé : « **Tes 99 adversaires sont des IA.** Elles jouent les personnages et portent les pseudos de vrais joueurs proches de ton niveau ; les BOT complètent quand il en manque. »
- Les politiques de confidentialité et les conditions d'utilisation (pages légales) doivent mentionner que le pseudo et le personnage choisi apparaissent dans les parties des autres.
- Proposition : un réglage « **Mon personnage peut apparaître dans les parties des autres** », activé par défaut.

### 5.4 Abandon (à valider, question n° 2)
- Proposition : **un abandon compte comme une élimination à la place du moment**. Cela vaut pour un abandon volontaire (bouton « Quitter »), pour un onglet fermé, et pour l'absence de nouvelle tranche pendant 60 s, constatée à l'expiration.
- Le serveur rejoue les tranches reçues et place le joueur au rang qu'il aurait eu s'il était éliminé au dernier tick reçu, soit nombre de survivants + 1.
- Cela ne rapporte jamais plus que de continuer à jouer et mourir. Pour éviter l'abus « je quitte dès que ça tourne mal », chaque abandon retire en plus **5 trophées** (configurable) et ne rapporte **aucune MemeMoney**.
- Partie non envoyée à `expires_at` : abandon, traité à la prochaine visite du joueur et par la purge quotidienne.

### 5.5 Anti-triche (le client ne décide jamais)
| Contrôle | Comment |
|---|---|
| Résultat | Calculé uniquement par le **rejeu serveur**. |
| Rythme réel | Chaque tranche couvrant les ticks jusqu'à `t` doit arriver **après** `started_at + t / 20 s − 3 s` : impossible d'aller plus vite que le jeu, donc impossible de calculer la partie à l'avance avec un outil. La partie entière doit durer au moins sa durée simulée (le temps du jeu suit l'horloge réelle, §2). |
| Ralenti et pause | Impossibles : la simulation rattrape le temps réel. Une tranche plus de 60 s en retard sur l'horloge vaut abandon (§5.4). |
| Commandes impossibles | Valeurs hors bornes, tranches qui se chevauchent ou manquent → partie **rejetée** (aucun trophée, journal de modération). |
| Visée | Rotation plafonnée par le moteur ; statistiques de précision et de temps de réaction calculées au rejeu ; valeurs aberrantes **signalées à la modération**, jamais de sanction automatique. |
| Rejeu | Un seul envoi par partie, partie liée au compte, expiration, limites de débit (`RATE_LIMITS.battleStart`, `battleSubmit`). |

Limite honnête : un programme qui jouerait à la place du joueur avec des commandes plausibles ne peut pas être détecté à coup sûr dans un jeu qui tourne sur l'appareil. Il ne gagne cependant que contre des bots, et les statistiques signalées permettent une vérification humaine.

---

## 6. Personnages

### 6.1 Des statistiques de la carte à la bataille (après compression, §6.3)
| Carte | Bataille | Formule proposée (entiers) | Plage |
|---|---|---|---|
| PV 60–140 | Points de vie | `100 + (hp − 60) × 5 / 4` | 100 – 200 |
| PV | **Zone de touche** (inconvénient) | rayon `14 + (hp − 60) / 10` unités | 14 – 22 |
| DÉF 20–65 | Armure | dégâts subis `× 100 / (100 + déf / 2)` | −9 % à −25 % |
| VIT 10–100 | Vitesse | `200 + vit × 2` unités/s | 220 – 400 |
| ATQ 20–65 | Multiplicateur des armes | `90 + (atq − 20) × 20 / 45` en % | 90 % – 110 % |

- **Avantages et inconvénients réels** : un personnage robuste a beaucoup de PV mais une grosse zone de touche et reste lent (le budget de statistiques des cartes oppose déjà vitesse et robustesse). Un personnage rapide est fragile.
- Les **armes** font l'essentiel des dégâts, et l'ATQ ne les module que de ±10 %. Le butin est le même pour tout le monde.

### 6.2 Capacité active et passif
| Attaque spéciale (effet) | Capacité active (recharge `6 s + 3 s × coût d'énergie`, soit 12 à 18 s ; intensité `× puissance / 70`) |
|---|---|
| `none` | **Sprint** : +40 % de vitesse pendant 2 s |
| `stun` | Prochaine balle dans les 3 s : **étourdit** 0,4 s + chance/100 s |
| `drain` | 4 s : soigne `percent` % des dégâts infligés |
| `multi` | Rafale de `hits` projectiles à `percent` % des dégâts |
| `dot` | Projectile de **brûlure** : `percent` % des PV max par seconde pendant `turns` s |
| `pierce` | 4 s : les tirs ignorent `percent` % de l'armure |
| `buff` (atq, déf, vit) | +25 % de la statistique pendant 5 s |
| `debuff` (atq, déf, vit) | Prochaine balle dans les 3 s : −20 % de la statistique de la cible pendant 4 s |

| Défense (effet) | Passif |
|---|---|
| `heal` | Après 4 s sans dégâts : régénère `percent / 10` % des PV max par seconde |
| `dodge` | `chance / 3` % de chances d'esquiver une balle (flux aléatoire « combat » de la graine) |
| `reflect` | Renvoie `percent / 4` % des dégâts subis au tireur |
| `cleanse` | Effets négatifs reçus raccourcis de moitié |
| `recharge` | Recharge de la capacité −25 % |

### 6.3 Rareté : écart borné
- **Compression** : chaque statistique est rapprochée de la valeur moyenne d'une commune, `stat_eff = ref + κ × (stat − ref)`, avec **κ = 0,5** par défaut, configurable. Les plages du §6.1 s'appliquent ensuite.
- **Borne proposée** (question n° 3) : à niveau d'évolution égal et à niveau de jeu égal, une godlevel ne fait pas plus de **1,3 fois** plus de Top 1 qu'une commune, mesuré par les tournois de bots. Le banc d'essai échoue au-delà, et κ est réglé en conséquence.
- **Évolutions** ★/★★/★★★ : conservées. En bataille, leur bonus de +3 / +6 / +10 % est appliqué **à moitié** (`EVOLUTION_BR_FACTOR = 0,5`). Borne : un ★★★ fait au plus **1,15 fois** plus de Top 1 que la même carte sans évolution.

### 6.4 Maîtrise (à valider, question n° 9)
Progression **par personnage**, gagnée seulement en jouant avec lui : 10 points par partie, plus 5 par élimination, plus un bonus de place. Elle débloque des récompenses **cosmétiques uniquement** : cadre de bulle, traînée, titre (« Maître du Chat Qui Juge »). Aucune puissance.

### 6.5 Apparence et fiche
- **Bulle ronde** avec l'illustration (`imageUrl`, sinon l'illustration générée par `src/lib/art/`). Contour aux couleurs de la rareté, étoiles d'évolution, arme dessinée à côté.
- Toutes les illustrations d'une partie sont rassemblées dans **une seule texture** au chargement. Le stockage Supabase public autorise le cross-origin, donc le canvas n'est pas « contaminé ».
- **Fiche personnage** : dans la carte agrandie de la Collection, un volet « En bataille » montre PV, armure, vitesse, dégâts, capacité, passif, avantages et inconvénients, et le bouton « **Choisir pour les batailles** ».

---

## 7. Bots

### 7.1 Architecture
Chaque bot est une **machine de décision par scores d'utilité**, calculée 4 fois par seconde, et un **contrôleur** qui produit, à chaque tick, une commande du même format que celle d'un joueur. Les bots n'ont donc **aucun pouvoir spécial** : ils passent par les mêmes règles.

### 7.2 Perception (honnête)
- Même **champ de vision** que le joueur (rectangle fixé par le moteur, environ 900 × 500 unités), **ligne de vue** bloquée par les murs, buissons qui cachent.
- **Ouïe** : les tirs dans un rayon de 1 200 unités sont « entendus », avec une position approximative.
- **Mémoire** : dernière position connue de chaque ennemi pendant 5 s, et du butin vu.

### 7.3 Déplacement
- **Champs de flux** recalculés à chaque phase de zone (vers la zone sûre) et partagés par tous les bots.
- **A*** borné vers un objectif précis (butin, couverture, ennemi).
- **Anti-blocage** : un bot qui n'a pas avancé de 16 unités en 1 s change de direction (glissement le long du mur), puis recalcule un chemin. Un bot bloqué 3 s de suite est compté par le banc d'essai.

### 7.4 Décisions (scores d'utilité de 0 à 1000, en entiers)
| Action | Le score monte avec… |
|---|---|
| Ramasser du butin | qualité de l'objet comparée à l'équipement actuel, faible distance, peu de danger |
| Se soigner | PV bas, soin disponible, à couvert et hors de vue |
| Attaquer | cible visible, avantage de PV et de portée, munitions |
| Fuir | PV bas, plusieurs ennemis, désavantage d'arme |
| Se mettre à couvert | sous le feu, couverture proche |
| Rejoindre la zone | distance à la zone sûre comparée au temps restant avant le rétrécissement |
| Profiter d'un combat (« troisième homme ») | deux ennemis qui se battent, cible affaiblie |

Une petite part de **hasard à graine** évite les égalités et les comportements identiques.

### 7.5 Combat
- **Temps de réaction** avant le premier tir et **erreur de visée** (dispersion autour de la cible).
- **Anticipation** du mouvement de la cible, **déplacements latéraux**, rechargement à couvert, repli quand les PV sont bas, capacité active utilisée au bon moment (score dédié).
- **Personnalités** déduites du personnage, avec une variation à graine. Les bots se battent aussi entre eux.

| Personnalité | Personnage type |
|---|---|
| Prudent | PV hauts, défense `heal` |
| Agressif | ATQ haute |
| Mobile | VIT haute |
| Tireur de loin | `pierce`, `debuff` |

### 7.6 Difficulté qui suit les trophées du joueur
`niveau = min(10, trophées / 600)` interpole linéairement chaque réglage. La courbe est dans la configuration :

| Réglage | Niveau 0 (débutant) | Niveau 10 (Immortel) |
|---|---|---|
| Temps de réaction | 650 ms | 170 ms |
| Erreur de visée | ±16 pas d'angle | ±3 pas |
| Anticipation de la cible | 0 % | 90 % |
| Qualité des décisions (bruit des scores) | ±250 | ±30 |
| Déplacements latéraux | jamais | fréquents |

Tous les bots d'une partie partent du même niveau ; leur personnalité le fait varier de ±1.

### 7.7 Banc d'essai `npm run bots:tournament` (seuils qui font échouer le script)
Milliers de parties bot contre bot, sans affichage, en parallèle (`worker_threads`), avec un rapport (moyennes et intervalles de confiance) :

| Indicateur | Seuil proposé |
|---|---|
| Durée moyenne d'une partie | entre 5 et 8 min |
| Morts dues à la zone | ≤ 15 % des éliminations |
| Bots immobiles (plus de 10 s sans bouger hors couverture voulue) | ≤ 1 % des bots |
| Bots coincés non résolus | 0 |
| Taux de Top 1 par personnage (attendu : 1 %) | entre 0,5 % et 2 % pour toute carte jouée au moins 2 000 fois |
| Godlevel / commune (Top 1, à évolution égale) | ≤ 1,3 |
| ★★★ / sans évolution (même carte) | ≤ 1,15 |
| Temps moyen d'un tick (Node) | ≤ 2 ms |

Le rapport sert aussi à **équilibrer les cartes** : taux de Top 1 et place moyenne par personnage.

---

## 8. Économie

### 8.1 Trophées (100 participants ; tranches en pourcentage si le nombre change)
| Place | 1 | 2–3 | 4–5 | 6–10 | 11–20 | 21–30 | 31–40 | 41–50 | 51–70 | 71–90 | 91–100 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Trophées | +40 | +30 | +24 | +18 | +12 | +6 | +2 | 0 | −4 | −8 | −12 |

- **Élimination** : +1 par élimination, plafonné à +5, et seulement dans la première moitié du classement.
- **Selon le rang r** (0 à 9) : gains × (1 − 0,05 r), pertes × (1 + 0,10 r).
- Jamais sous 0. Rangs et récompenses uniques de `src/config/ranks.ts` conservés. Abandon : §5.4.

### 8.2 MemeMoney
- Top 1 : 5 ; Top 2–5 : 3 ; Top 6–10 : 2 ; Top 11–25 : 1 ; au-delà : 0.
- **Plafond quotidien** proposé : **15 MemeMoney** gagnés en bataille (fuseau du joueur, comme les boosters gratuits). C'est une nouvelle colonne de `daily_usage`.
- La MemeMoney reste une monnaie fermée (CLAUDE.md §11).

### 8.3 Simulation chiffrée (modèle jetable de phase 0, à recaler avec les vraies parties)
Modèle :
- chaque participant a une performance égale à son niveau plus du hasard, et la place est son rang : à niveau égal, chacun gagne 1 partie sur 100 ;
- la difficulté des bots suit les trophées ;
- durée de vie dans une partie : `7 min × (percentile de survie)^0,6`, plus 45 s de salle d'attente et d'écran de fin.

| Profil de joueur | Trophées où il se stabilise | Parties pour atteindre 1 000 / 3 000 / 5 000 | Place moyenne à l'équilibre | MemeMoney par heure | Heures pour un « Booster en plus » (20 MM) |
|---|---|---|---|---|---|
| Débutant | ≈ 170 | — / — / — | 55 | ≈ 3,0 | ≈ 6,6 |
| Moyen | ≈ 2 050 | 51 / — / — | 53 | ≈ 4,3 | ≈ 4,7 |
| Bon | ≈ 4 000 | 25 / 108 / — | 51 | ≈ 4,5 | ≈ 4,4 |
| Très bon | ≈ 6 400 | 23 / 73 / 150 | 48 | ≈ 5,8 | ≈ 3,5 |

Lecture :
- Le plafond de 15 MemeMoney par jour n'est atteint qu'après environ 3 heures de jeu.
- Un **Super Booster (40 MM)** demande 7 à 13 heures de bataille, un **Ultra Booster (80 MM)** 14 à 27 heures, en plus des 3 boosters gratuits par jour et de la revente.
- La table brute, à place uniforme, donne +0,78 trophée par partie. La réduction par rang et la difficulté adaptative ramènent chaque profil à l'équilibre.
- **À valider** (question n° 8) : ce rythme de MemeMoney. Pour récompenser davantage, on peut doubler la table ou ajouter une MemeMoney de participation.

### 8.4 Défis du jour (activés)
| Défi | Difficulté | Récompense |
|---|---|---|
| Joue 3 parties classées | Facile | 1 booster en plus |
| Finis dans le Top 10 | Moyen | 2 boosters en plus |
| Élimine 5 adversaires (cumul de la journée) | Moyen | 2 boosters en plus |
| Gagne une partie (Top 1) | Difficile | 3 boosters en plus |
| Joue une partie avec un ami | Facile | 1 booster en plus |

Les nouvelles valeurs de l'énumération `challenge_type` sont ajoutées dans une **migration séparée** (CLAUDE.md §7). Les anciens défis de bataille inactifs (`win_battles`, `act_with_vibe`…) restent inactifs.

---

## 9. Parties entre amis (modes B et C)

### 9.1 Choix : l'hôte fait foi et envoie l'état (et non le « lockstep »)
| Critère | Hôte qui envoie l'état (**choisi**) | Simulation identique sur chaque appareil (lockstep) |
|---|---|---|
| Réseau mobile instable | Un invité en retard ne ralentit que lui. | Tout le monde attend le plus lent : saccades pour tous. |
| Téléphone lent | Seul l'hôte doit tenir la simulation complète, comme en solo. | Chaque appareil doit tenir la simulation complète. |
| Désynchronisation | Impossible : un seul état fait foi. | Le moindre écart (onglet ralenti par le navigateur) casse la partie. |
| Arrivée et retour d'un joueur | On renvoie l'état complet. | Il faut tout rejouer depuis le début. |
| Bande passante | Plus élevée (environ 5 Ko/s par invité), réduite par l'envoi des seuls changements et des seuls objets proches. | Très faible. |

### 9.2 Réseau
- **Topologie en étoile** : l'hôte (le créateur de la salle) est relié à chaque invité. Deux canaux de données WebRTC :
  - non fiable et non ordonné : commandes des invités à 20 par seconde, état envoyé par l'hôte 10 fois par seconde, avec seulement ce qui a changé et ce qui est proche du joueur ;
  - fiable : événements (éliminations, fin de partie, messages de la salle).
- **Côté invité** : prédiction locale de son propre déplacement ; les autres participants sont interpolés avec 100 ms de tampon.
- Max **8 humains** (configurable). En mode B, l'hôte complète avec des bots jusqu'au nombre de participants configuré.

### 9.3 Salle d'attente (Supabase Realtime)
- Canal privé `salle:<id>` : présence, « prêt », lancement et échange des offres WebRTC. Les invitations sont des lignes en base (avec la notification point rouge).
- Environ **150 messages par salle**, puis on quitte le canal au lancement. Compatible avec 100 messages/s et 2 millions par mois (offre gratuite).
- Autorisation Realtime par RLS : seuls les membres d'une salle rejoignent son canal.

### 9.4 TURN : Cloudflare Realtime (recommandé)
- Identifiants temporaires (1 h) délivrés par **`POST /api/battle/turn`**, réservée aux membres d'une salle et soumise à une limite de débit. Nouvelles variables d'environnement : `CLOUDFLARE_TURN_KEY_ID` et `CLOUDFLARE_TURN_API_TOKEN`.
- **Coût** : un invité relayé reçoit environ 2,6 Mo par partie de 7 min. Une partie à 8 entièrement relayée fait environ 20 Mo. Les **1 000 Go gratuits** couvrent environ 50 000 parties entièrement relayées par mois ; au-delà, 0,05 $/Go. En pratique, 10 à 20 % seulement des connexions passent par le relais.

### 9.5 Déconnexions
- Un invité a **60 s** pour revenir (reconnexion WebRTC par la salle Realtime) ; son personnage reste immobile pendant ce temps, puis il est éliminé.
- Si l'hôte part, la partie s'arrête, avec le message « L'hôte a quitté la partie ».

### 9.6 Récompenses (à valider, question n° 1)
Proposition : **ni trophées ni MemeMoney**. L'hôte pourrait tricher, et des amis pourraient « farmer » entre eux. Ces parties comptent seulement pour le défi « Joue une partie avec un ami » (un par jour au plus, donc borné) et pour les statistiques de Maîtrise, si elle est validée.

### 9.7 Mode Entraînement (avis : oui, phase 3)
Partie solo contre des bots « système », sans récompense ni envoi au serveur. Il est **jouable hors ligne** une fois le jeu chargé (même moteur, bots locaux). Il sert aussi de **tutoriel**, et c'est l'outil de test le plus simple pendant le développement.

---

## 10. Données

### 10.1 Nouvelles tables (une nouvelle migration ; RLS activée, écritures réservées au serveur sauf mention, tests pgTAP)
| Table | Colonnes principales | Lecture |
|---|---|---|
| `br_characters` | `player_id` (clé), `card_id`, `updated_at` | publique (personnage visible sur le profil) |
| `br_matches` | `id`, `mode` (`ranked`, `friends_bots`, `friends_only`), `player_id`, `room_id`, `seed`, `engine_version`, `config_version`, `participant_count`, `status` (`running`, `finished`, `abandoned`, `expired`, `rejected`), `started_at`, `expires_at`, `ended_at`, `sim_ticks`, `place`, `kills`, `damage`, `eliminated_by_slot`, `trophies_delta`, `meme_money_delta`, `flags` (jsonb) | le joueur pour ses parties |
| `br_participants` | `match_id`, `slot`, `kind` (`player`, `ghost`, `system`, `friend`), `player_id`, `username` (figé), `card_id`, `card_snapshot` (jsonb, figé), `level`, `bot_level`, `final_place` | le joueur pour ses parties |
| `br_input_chunks` | `match_id`, `idx`, `from_tick`, `to_tick`, `data` (bytea, ≤ 16 Ko), `received_at` (par la base) | aucune ; **insertion** par le propriétaire d'une partie classée en cours (RLS) |
| `br_player_stats` | `player_id`, `games`, `top1`, `top10`, `kills`, `best_place`, `place_sum`, `damage_sum`, `abandons` | publique (profil) |
| `br_character_stats` | `card_id`, `games`, `top1`, `place_sum`, `picks` | publique (classement des cartes) |
| `br_mastery` (si validée) | `player_id`, `card_id`, `xp`, `level` | le joueur |
| `br_rooms` | `id`, `host_id`, `mode`, `max_players`, `status`, `created_at`, `started_at` | membres |
| `br_room_members` | `room_id`, `player_id`, `ready`, `joined_at` | membres |
| `br_invites` | `id`, `room_id`, `from_id`, `to_id`, `status`, `created_at`, `expires_at` | expéditeur et destinataire |

Autres changements de base :
- `daily_usage` reçoit une colonne `battle_meme_money` (plafond quotidien).
- `challenge_type` reçoit les nouvelles valeurs dans une migration séparée.
- Si la question n° 7 est validée : `player_private.br_ghost_opt_out`.

### 10.2 Ordre des migrations (jamais de modification d'une migration livrée)
1. `…_bataille_royale_types.sql` : énumérations et nouvelles valeurs de `challenge_type`.
2. `…_bataille_royale.sql` : tables, index, RLS, révocations, fonction de purge.
3. `…_ancienne_arene_retiree.sql` : suppression des anciennes tables (§10.4), après vérification qu'elles sont vides.

### 10.3 Index et volumes
- Index : `br_matches (player_id, started_at desc)`, `br_matches (status, expires_at)`, `br_characters (card_id)`, `profiles (trophies, last_seen_at)` pour le choix des adversaires.
- Volume : environ 10 Ko de tranches par partie classée. À 1 000 parties par jour, cela fait 10 Mo par jour, soit environ 140 Mo sur la fenêtre de 14 jours. C'est compatible avec les 500 Mo de l'offre gratuite, mais pas au-delà de quelques milliers de parties par jour (Supabase Pro conseillé).

### 10.4 Sort de l'ancien code de bataille (à valider, question n° 6)
**Proposition : le supprimer**, dans une étape à part, une fois le nouveau moteur en place (phase 1).
- Fichiers : `src/lib/battle/` (moteur, bot, decks, règles et leurs tests), `src/components/battle/` et la page `/bataille`. Celle-ci est déjà cassée : ses textes ont disparu des 7 langues.
- Tables, vues, fonctions et énumérations de l'ancien modèle (liste au §13.2) : par une **nouvelle** migration.
- Ce qu'on garde de lui : le moteur pur et déterministe, les entiers, le générateur à graine et le style de tests. C'est réécrit dans `src/lib/br/`, avec un générateur à flux séparés et réservé au moteur (celui de `src/lib/art/prng.ts` reste réservé aux illustrations).
- Inventaire précis des fichiers et tables concernés : §13.

---

## 11. Routes d'API (modèle CLAUDE.md §6 ; limites de débit dans `RATE_LIMITS`)
| Route | Rôle |
|---|---|
| `POST /api/battle/character` `{ cardId }` | Choisir son personnage (une carte possédée). |
| `POST /api/battle/start` `{ mode: "ranked" }` | Crée la partie classée (§5.1) ; renvoie identifiant, graine, participants figés, configuration. |
| *(écriture Supabase directe)* `br_input_chunks` | Tranches de commandes pendant la partie (RLS). |
| `POST /api/battle/submit` `{ matchId, lastChunk }` | Rejeu, vérifications, résultats et récompenses (`maxDuration = 60`). |
| `POST /api/battle/abandon` `{ matchId }` | Quitter volontairement (§5.4). |
| `POST /api/battle/rooms` / `…/rooms/invite` / `…/rooms/respond` / `…/rooms/leave` / `…/rooms/start` | Salles d'amis et invitations. |
| `POST /api/battle/rooms/result` `{ roomId }` | Fin d'une partie entre amis (statistiques non classées, défi « avec un ami »). |
| `POST /api/battle/turn` | Identifiants TURN temporaires (membres d'une salle). |
| Cron `GET /api/cron/battle-cleanup` | Abandons expirés, purge des tranches de plus de 14 jours (`CRON_SECRET`). |

L'historique des parties, les statistiques et le choix du personnage sont lus par les pages serveur (composants serveur), sans route dédiée.

---

## 12. Interface et contrôles
- **Page de partie** plein écran (`/partie`), hors du cadre du jeu. Le moteur et PixiJS y sont chargés à la demande, jamais sur les autres pages.
- **Mobile en paysage**.
  - Le manifest de la PWA impose aujourd'hui `orientation: "portrait"` : il passe à `"any"`.
  - La page demande le paysage avec `screen.orientation.lock("landscape")` en plein écran (Android).
  - Sur iPhone, où le verrouillage est impossible, la page affiche « Tourne ton téléphone ».
- **Contrôles**.
  - Mobile : joystick de déplacement à gauche, joystick de visée et tir à droite, boutons de capacité, de soin et d'arme suivante (≥ 44 px).
  - Ordinateur : ZQSD/WASD, souris pour viser et tirer, touches pour les actions.
- **Lisibilité** : mini-carte, zone visible, compteur de survivants, fil des éliminations (avec le badge BOT), dégâts affichés en chiffres et pas seulement en couleur.
- **Accessibilité** : `prefers-reduced-motion` coupe les tremblements et les flashs ; menus utilisables au clavier ; contrastes suffisants.
- **Plein écran** : réutilise `FullscreenToggle`.
- **PWA** : aucune invite ni rechargement de mise à jour pendant une partie (indicateur « partie en cours »). Le mode classé exige le réseau au début et à la fin, avec un message clair hors ligne. Le mode Entraînement fonctionne hors ligne.
- **Visuels originaux**. Armes : « Lance-Pop » (pistolet), « Pétard Mouillé » (fusil à pompe), « Rafaleuse 3000 » (mitraillette), « Lunette à Like » (fusil de précision). Objets : « Patch de Lol » (soin), « Gilet Cringe » (armure). Aucun nom ni image d'un autre jeu.
- **Textes** : dans les 7 langues, avec le vocabulaire imposé.

---

## 13. Impacts sur l'existant

Inventaire du code actuel (lecture seule, 2026-10-24). Chaque ligne indique ce qui change et dans quelle phase.

### 13.1 Ancien code de bataille (à supprimer, question n° 6)
| Élément | Constat | Proposition |
|---|---|---|
| `src/lib/battle/` (`engine.ts`, `rules.ts`, `bot.ts`, `decks.ts`, 16 tests) | Arène à tours façon « tours et couloirs », 20 ticks/s, rejeu et empreinte. **Pas entièrement en nombres entiers** : nombres décimaux dans la séparation des unités et dans le générateur, multiplications décimales à la création des unités. | Supprimé en phase 1. On reprend ses **bonnes idées** dans `src/lib/br/`, sans aucun nombre décimal : rejeu de commandes enregistrées, empreinte FNV-1a, test « bot contre bot enregistré puis rejoué », racine carrée entière. |
| `src/components/battle/` (`BattleArena.tsx`, `draw.ts`) | Canvas 2D et interface React ; boucle à pas fixe de 50 ms avec interpolation, une bonne base d'idée pour la phase 3. | Supprimé ; la boucle est réécrite pour le nouveau moteur. |
| Page `/bataille` | Aucun lien n'y mène. **Ses textes n'existent plus** dans les 7 langues (l'espace de traduction `battle` est absent) : elle s'affiche avec des clés brutes. Elle utilise le générateur des illustrations, réservé aux visuels. | Supprimée, remplacée par `/partie` (phase 3). |
| `README.md` (lignes 134, 243-245) | Mentionne `/bataille` et une vue d'aperçu qui n'existe pas. | Mis à jour en phase 7. |

### 13.2 Base de données
| Élément | Constat | Proposition (nouvelle migration, phase 4) |
|---|---|---|
| Tables `battles`, `battle_secrets`, `battle_actions`, `battle_turns` | Pour l'ancien modèle à deux joueurs ; RLS et politiques Realtime des sujets `battle:<id>` ; fonctions `is_battle_participant` et `is_battle_topic_participant`. | Supprimées avec leurs fonctions et politiques, après vérification qu'elles sont vides. |
| `matchmaking_queue`, `decks` | File d'attente et decks de l'ancien modèle. `decks` est encore mise à jour par la suppression d'une carte (`admin-ops.ts`, lignes 209-210). | Supprimées ; ces deux lignes sont retirées de `applyCardDelete`. |
| `card_usage_daily`, vues `card_rankings` et `player_rankings`, fonction `refresh_rankings()` | Jamais lues par l'application, seulement par les tests pgTAP. | `card_usage_daily` et `card_rankings` sont remplacées par `br_character_stats`. `player_rankings` est supprimée : le classement lit déjà `profiles.trophies`. |
| Énumérations `battle_mode`, `battle_status`, `battle_side`, `end_reason` | Liées aux tables ci-dessus. | Supprimées avec elles. |
| `profiles.wins`, `losses`, `draws`, `ranked_games` | **Jamais remplies** par le code (toujours 0). | Remplacées par `br_player_stats`, puis supprimées (phase 5). |
| `trophy_history.reason` | Valeurs autorisées : `start`, `win`, `loss`, `draw`, `admin`. | Ajout de `battle` et `abandon`. |
| `challenge_type` | Valeurs de bataille présentes, mais aucun défi ne les utilise. | Nouvelles valeurs (`play_ranked`, `top_10`, `eliminations`, `top_1`, `play_with_friend`) dans une migration séparée ; défis insérés ensuite. |
| Tests pgTAP (`rls.test.sql`, `account.test.sql`) | Testent la visibilité des batailles, les sujets Realtime et le sort d'une bataille à la suppression d'un compte. | Réécrits pour les nouvelles tables : RLS, insertion des tranches, suppression de compte. |

### 13.3 Configuration et règles
| Élément | Constat | Proposition |
|---|---|---|
| `GAME_CONFIG` : `TEAM_SIZE`, `MAX_DECKS`, `TURN_SECONDS`, `RECONNECT_SECONDS`, `BOT_OFFER_SECONDS`, `MAX_TURNS`, `AFK_TIMEOUTS_BEFORE_LOSS`, `TROPHIES.WIN/LOSS/DRAW/MATCH_WINDOW_*`, `MEME_MONEY.WIN_REWARD`, `RANKING` | Ancien modèle ; la plupart ne sont lus nulle part. | Remplacés par une section `BATTLE_ROYALE` validée par Zod et testée : participants, ticks, zone, armes, compression κ, difficulté des bots, tables de trophées et de MemeMoney, plafond, abandon. |
| `src/config/ranks.ts` : `BattleResult`, `applyBattleResult`, `newRankRewards` | Utilisés seulement par leurs tests. | `applyPlacement(trophées, place, éliminations)`, et récompenses de rang données à la fin d'une partie classée (phase 4). Rangs et récompenses inchangés. |
| Défis (`src/lib/server/challenges.ts`) | `progressChallenge(joueur, type, quantité)` est déjà générique. | Appelé par `/api/battle/submit` et à la fin d'une partie entre amis. |

### 13.4 Interface
| Élément | Constat | Proposition (phase 5) |
|---|---|---|
| Accueil, page **Batailles** (`PlayerFeatures.tsx`, BattlesSlide) | « Bientôt », rang, trophées, prochaine récompense, deux cartes face à face. | Personnage choisi (bulle), « Jouer en classé », « Entraînement », « Avec des amis » (salle, invitations), dernières parties, défi de bataille. |
| **Profil** (`ProfileView.tsx`, `getPublicProfile` dans `players.ts`) | Victoires, nuls, défaites, ratio, et séries calculées à partir de `battles`. | Parties jouées, Top 1, Top 10, éliminations, meilleure place, place moyenne, personnage favori. Le graphique des trophées est conservé, avec son texte « change à chaque bataille » adapté. |
| **Infos** → Trophées, Rangs, MemeMoney (`TrophiesPanel`, `RanksPanel`, `MemeMoneyPanel`) | Victoire +25, défaite −25, nul 0 ; « +1 MemeMoney par victoire ». | Tables par place, réduction par rang, abandon, plafond quotidien, tout lu dans la configuration. |
| **Infos → Carte** (`CardGuidePanel`) | Exemple de dégâts et textes du tour par tour (la vitesse « agit en premier », coût d'énergie). | Statistiques en bataille (§6) : PV, armure, vitesse, dégâts, zone de touche, capacité et recharge, passif ; nouvel exemple chiffré. |
| **Classement** | Joueurs par trophées seulement ; aucun « taux de victoire » de carte n'est affiché aujourd'hui. | Proposition : un onglet « Personnages » (taux de Top 1, place moyenne, popularité = taux d'utilisation) à partir de `br_character_stats`. |
| **Collection**, carte agrandie | Boutons Évoluer et Vendre. | Volet « En bataille » et bouton « Choisir pour les batailles » (§6.5). |
| **Vitrine visiteur** (`FeatureShowcase.tsx`, scène de bataille) | « Équipe de 3 cartes, 30 secondes par tour », et « taux de victoire » dans le texte de la collection. | Nouvelle présentation du battle royale, dans les 7 langues. |
| **Tableau de bord** (`admin/page.tsx`, `admin.ts`) | « Victoires / Nuls / Défaites » ; configuration WIN/LOSS. | Statistiques de bataille ; configuration du battle royale en lecture ; parties signalées (rejeu). |
| Aperçu `/apercu` | Fausses données victoires, nuls, défaites et séries. | Mis à jour avec les nouvelles statistiques. |
| **Notifications** (`getBadges`) | Aucune pour les batailles. | `battleInvites` : invitations reçues (point rouge sur l'Accueil et la page Batailles). |
| **PWA** | Manifest `orientation: "portrait"` ; service worker sans activation automatique ; **aucune invite de mise à jour** n'existe encore, donc aucun rechargement forcé. | Manifest en `"any"` (§12). Quand l'invite de mise à jour sera ajoutée, elle sera masquée pendant une partie. |
| **Realtime** | Jamais utilisé par l'application : il ne reste que des politiques SQL pour d'anciens sujets. | Première utilisation, pour les salles d'amis (phase 6), avec de nouvelles politiques `salle:<id>`. |
| Pages légales | Rien sur les fantômes. | Mention du pseudo et du personnage dans les parties des autres (question n° 7). |

---

## 14. Risques et points d'attention
| N° | Risque | Parade proposée |
|---|---|---|
| R1 | **Vercel Hobby interdit l'usage commercial**, et ses 4 h de CPU par mois ne suffisent pas au rejeu. | Passer en **Pro** avant d'ouvrir les achats et le mode classé (question n° 5). |
| R2 | ~~Pooler Supabase en **mode session** : nombre de clients limité ; beaucoup d'instances Vercel pourraient l'épuiser.~~ | **Traité le 2026-10-24** : le risque s'était réalisé (pages plantées). Retour au mode transaction, avec des requêtes isolées envoyées une à une et les transactions sur des connexions à part ; test de charge réussi (CLAUDE.md §6, DECISIONS.md). |
| R3 | Performances sur téléphone modeste (100 participants plus le rendu). | Budget par tick testé, IA décalée, rendu groupé. Si besoin, nombre de participants réduit au lancement (question n° 4). |
| R4 | Triche par programme qui joue à la place du joueur. | Limites honnêtes (§5.5) : statistiques signalées et modération humaine. |
| R5 | Écart de puissance entre raretés (jeu « payant pour gagner »). | Compression κ, bornes testées par le banc d'essai, bonus d'évolution réduit (§6.3). |
| R6 | Confidentialité : pseudos de vrais joueurs dans les parties des autres. | Transparence, mention dans les pages légales, réglage de refus (question n° 7). |
| R7 | iPhone : pas de verrouillage d'orientation, plein écran limité. | Message « Tourne ton téléphone » ; l'application installée donne le meilleur résultat. |

---

## 15. Phases (rappel ; chaque phase se termine par la checklist §13 de CLAUDE.md)
| Phase | Livrables | Critère de fin |
|---|---|---|
| 1. Moteur | `src/lib/br/` : état, carte, zone, armes, butin, personnages, commandes, rejeu ; tests d'abord | Déterminisme prouvé (300 parties) ; rejeu mesuré ; budget par tick tenu |
| 2. Bots | IA complète, `npm run bots:tournament` | Tous les seuils du §7.7 tenus |
| 3. Jouabilité | Rendu PixiJS (essai puis choix définitif), contrôles, interface, écran de fin, mode Entraînement | Partie complète jouable sur téléphone et ordinateur |
| 4. Classé | Migrations, tickets, adversaires, tranches, rejeu serveur, économie, rangs, défis, historique ; risque R2 traité | Tests de route, rejeu serveur réel, partie de test de bout en bout |
| 5. Intégration | Page Batailles, fiche personnage, Profil, Classement, Infos, notifications, 7 langues | Pages affichées et vérifiées dans un vrai navigateur |
| 6. Amis | Salles, invitations, WebRTC, TURN, modes B et C, déconnexions | Partie à plusieurs appareils réels, y compris en 4G |
| 7. Finitions | Performances sur téléphone modeste, audit de sécurité des nouvelles routes, équilibrage final, README et guides | Seuils tenus sur appareil réel ; audit sans faille ouverte |

---

## 16. Questions à trancher avant la phase 1

**Demandées par le cahier des charges**
1. **Récompenses des parties entre amis** : proposition « ni trophées ni MemeMoney, seulement le défi du jour avec un ami » (§9.6). D'accord ?
2. **Abandon** : élimination à la place du moment, −5 trophées en plus et aucune MemeMoney (§5.4). D'accord, ou une autre pénalité ?
3. **Écart maximal entre raretés** : godlevel au plus 1,3 fois plus de Top 1 qu'une commune, ★★★ au plus 1,15 fois, bonus d'évolution réduit de moitié en bataille (§6.3). D'accord, ou plus serré ?
4. **Nombre de participants au lancement** : proposition 100, réglable, ramené à 60 si le budget par tick n'est pas tenu sur téléphone en phase 3. D'accord ?

**Également bloquantes**

5. **Hébergement** : sur quels plans es-tu aujourd'hui (Vercel Hobby ou Pro, Supabase Free ou Pro) ? Le mode classé et les achats exigent Vercel Pro (usage commercial, CPU du rejeu), et Supabase Pro est conseillé (pas de mise en pause, plus de connexions).
6. **Ancien code de bataille** : d'accord pour supprimer le code et la page `/bataille`, ainsi que les tables, vues, fonctions et énumérations de l'ancien modèle (liste au §13.2), par une nouvelle migration ? Cela inclut les colonnes victoires, nuls et défaites des profils, jamais remplies.
7. **Fantômes de vrais joueurs** : d'accord pour le texte de transparence, la mention dans les pages légales et un réglage de refus activé par défaut (§5.3) ?
8. **Rythme de MemeMoney** : environ 4 à 6 MemeMoney par heure de bataille, plafond de 15 par jour (§8.3). D'accord, ou plus généreux ?

**Non bloquante** (proposition par défaut si tu ne dis rien)

9. **Maîtrise cosmétique** par personnage (§6.4) et **mode Entraînement** hors ligne (§9.7) : oui par défaut.
