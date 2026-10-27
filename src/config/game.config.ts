/**
 * Configuration du jeu : SOURCE UNIQUE pour le nom, les taux, les limites et
 * les règles d'équilibrage. Modifier une valeur ici suffit ; tout le code
 * (serveur, client, page /taux) lit ce fichier.
 *
 * La configuration est validée au chargement : une erreur (taux dont la somme
 * n'est pas 100 %, valeur négative…) fait échouer le démarrage et les tests,
 * au lieu de produire un jeu bancal en production.
 */
import { z } from "zod";
import { RARITIES, rarityTier as rarityTierOf, type Rarity } from "./rarities";

const rarityRecord = <T extends z.ZodType>(schema: T) =>
  z.object(Object.fromEntries(RARITIES.map((r) => [r, schema])) as Record<Rarity, T>);

const percent = z.number().min(0).max(100);
const positiveInt = z.number().int().positive();
const nonNegativeInt = z.number().int().nonnegative();

const boosterSchema = z.object({
  /** Cartes garanties, par rareté. */
  fixed: z.partialRecord(z.enum(RARITIES), z.number().int().positive()),
  /** Emplacement au choix : rareté habituelle, rareté plus forte et sa chance (en %). */
  flex: z.object({
    usual: z.enum(RARITIES),
    upgrade: z.enum(RARITIES),
    upgradeChance: percent,
  }),
  /** Chance (en %) qu'une Godlevel remplace une commune dans ce booster. */
  godlevelChance: percent,
});

const range = (min: number, max: number) => z.tuple([z.number().int().min(min).max(max), z.number().int().min(min).max(max)]).refine(([a, b]) => a <= b, "Intervalle [min, max] attendu.");
/** Munitions universelles depuis 3A (2026-10-27) : un seul stock pour toutes les armes à feu. */
const ammoKind = z.enum(["none", "ammo"]);
/**
 * Les armes à feu du battle royale, dans cet ordre (l'ordre sert d'identifiant dans le moteur). Les 4 premières
 * (de base) puis leurs versions supérieures (loot plus rare), ajoutées en 3A (2026-10-27). Le couteau est à part (KNIFE).
 */
export const BR_WEAPONS = ["pop", "petard", "rafaleuse", "lunette", "pop2", "petard2", "rafaleuse2", "lunette2"] as const;
export type BrWeaponId = (typeof BR_WEAPONS)[number];

const brWeaponSchema = z.object({
  /** Dégâts d'une balle (avant l'ATQ du tireur, l'armure et le gilet de la cible). */
  damage: positiveInt,
  /** Balles par tir (le fusil à pompe tire plusieurs plombs). */
  pellets: z.number().int().min(1).max(12),
  /** Temps entre deux tirs, en millisecondes. */
  fireIntervalMs: positiveInt,
  magazine: positiveInt,
  reloadMs: positiveInt,
  /** Dispersion de chaque balle : ± pas d'angle (un tour = 256 pas). */
  spreadSteps: z.number().int().min(0).max(32),
  /** Vitesse des balles (unités par seconde) et portée (unités). */
  speed: positiveInt,
  range: positiveInt,
  /** Munitions utilisées ; « none » = réserve illimitée (arme de départ). */
  ammo: ammoKind,
});

/** Tranches de récompense selon la place : [place maximale (en % des participants), valeur]. */
const placeBands = z
  .array(z.tuple([z.number().int().min(1).max(100), z.number().int().min(-100).max(100)]))
  .min(1)
  .refine((bands) => bands[0][0] === 1 && bands.every((b, i) => i === 0 || b[0] > bands[i - 1][0]), "Tranches croissantes, la première pour la place 1.");

const battleRoyaleSchema = z.object({
  /** Version de ces réglages, enregistrée avec chaque partie (un rejeu utilise les réglages de la partie). */
  CONFIG_VERSION: positiveInt,
  PARTICIPANTS: z.number().int().min(2).max(100),
  /** Calculs du moteur par seconde. */
  TICK_RATE: z.number().int().min(10).max(60),
  /** Durée maximale d'une partie, en secondes (filet de sécurité : la zone finit toujours avant). */
  MAX_DURATION_S: positiveInt,
  /** Carte générée par la graine. 1 unité = 16 sous-unités du moteur. */
  MAP: z.object({
    TILES: z.number().int().min(24).max(256),
    TILE_UNITS: z.number().int().min(8).max(64),
    /** Bande d'eau infranchissable tout autour. */
    BORDER_TILES: z.number().int().min(1).max(8),
    LAKES: range(0, 20),
    LAKE_RADIUS_TILES: range(1, 20),
    BUILDINGS: range(0, 80),
    BUILDING_SIZE_TILES: range(5, 20),
    CRATES: nonNegativeInt,
    BUSH_CLUSTERS: nonNegativeInt,
    BUSH_CLUSTER_SIZE: range(1, 30),
  }),
  /** Champ de vision, le même pour tous (fixé par le moteur, pas par la taille de l'écran), en unités. */
  VIEW: z.object({ HALF_WIDTH: positiveInt, HALF_HEIGHT: positiveInt, BUSH_REVEAL: nonNegativeInt }),
  CONTROLS: z.object({
    /** Rotation maximale de la visée par calcul (pas d'angle), la même pour tous, bots compris. */
    AIM_TURN_PER_TICK: z.number().int().min(1).max(128),
    /** Aide à la visée : la balle part vers la cible visible la plus proche si elle est à ± N pas de la visée. */
    AIM_ASSIST_STEPS: z.number().int().min(0).max(16),
    /** Délai avant de pouvoir tirer après un changement d'arme, en millisecondes. */
    WEAPON_SWITCH_MS: nonNegativeInt,
  }),
  /** La Zone : attente, rétrécissement vers un rayon en % du précédent, dégâts par seconde hors zone. */
  ZONE: z.object({
    PHASES: z
      .array(z.object({ waitS: nonNegativeInt, shrinkS: positiveInt, radiusPercent: z.number().int().min(0).max(95), dps: positiveInt }))
      .min(1)
      .max(12),
  }),
  CHARACTER: z.object({
    /** Statistiques moyennes d'une commune : la compression rapproche chaque statistique de cette valeur. */
    /**
     * Valeurs de référence (moyenne des communes) vers lesquelles la compression κ rapproche les statistiques,
     * la puissance de l'attaque spéciale et l'intensité des passifs (soin, esquive, renvoi).
     */
    REFERENCE: z.object({ hp: positiveInt, atk: positiveInt, def: positiveInt, spd: positiveInt, power: positiveInt, heal: positiveInt, dodge: positiveInt, reflect: positiveInt }),
    /** κ en % : 50 = l'écart à la référence est divisé par deux (raretés plus proches). */
    COMPRESSION_PERCENT: z.number().int().min(0).max(100),
    /** Part du bonus d'évolution (★ +3 %, ★★ +6 %, ★★★ +10 %) appliquée en bataille, en %. */
    EVOLUTION_FACTOR_PERCENT: z.number().int().min(0).max(100),
  }),
  /** Capacité active (attaque spéciale de la carte) : recharge, intensité × puissance / référence. */
  ABILITY: z.object({
    COOLDOWN_BASE_MS: positiveInt,
    COOLDOWN_PER_ENERGY_MS: nonNegativeInt,
    POWER_REFERENCE: positiveInt,
    SPRINT_PERCENT: positiveInt,
    SPRINT_MS: positiveInt,
    /** Étourdissement et affaiblissement : la prochaine balle dans ce délai porte l'effet. */
    ARMED_MS: positiveInt,
    STUN_BASE_MS: positiveInt,
    /** Durée d'étourdissement ajoutée par point de « chance » de la carte. */
    STUN_MS_PER_CHANCE: nonNegativeInt,
    DRAIN_MS: positiveInt,
    PIERCE_MS: positiveInt,
    BUFF_PERCENT: positiveInt,
    BUFF_MS: positiveInt,
    DEBUFF_PERCENT: positiveInt,
    DEBUFF_MS: positiveInt,
    MULTI_SPREAD_STEPS: z.number().int().min(0).max(32),
    /** Projectile de brûlure (effet « dot ») : dégâts à l'impact, vitesse et portée. */
    BURN_SHOT_DAMAGE: nonNegativeInt,
    BURN_SHOT_SPEED: positiveInt,
    BURN_SHOT_RANGE: positiveInt,
  }),
  /** Passif (capacité défensive de la carte). */
  PASSIVE: z.object({
    REGEN_DELAY_MS: positiveInt,
    /** La régénération s'arrête à ce pourcentage des PV max (100 : jusqu'au maximum). */
    REGEN_CAP_PERCENT: z.number().int().min(1).max(100),
    DODGE_DIVISOR: positiveInt,
    REFLECT_DIVISOR: positiveInt,
    CLEANSE_PERCENT: z.number().int().min(0).max(100),
    RECHARGE_PERCENT: z.number().int().min(0).max(90),
  }),
  WEAPONS: z.object(Object.fromEntries(BR_WEAPONS.map((w) => [w, brWeaponSchema])) as Record<BrWeaponId, typeof brWeaponSchema>),
  STARTING_WEAPON: z.enum(BR_WEAPONS),
  /** Couteau de combat : toujours porté (troisième arme), frappe ce qui est devant soi, sans munitions. */
  KNIFE: z.object({
    DAMAGE: positiveInt,
    INTERVAL_MS: positiveInt,
    /** Portée, en unités, depuis le bord du personnage. */
    RANGE: positiveInt,
    /** Demi-ouverture de l'arc frappé, en pas d'angle (un tour = 256). */
    ARC_STEPS: z.number().int().min(1).max(128),
  }),
  /** Caisses destructibles : résistance, et l'objet qu'elles lâchent une fois brisées. */
  CRATE: z.object({
    HP: positiveInt,
    LOOT_WEIGHTS: z.object({ heal: nonNegativeInt, ammo: nonNegativeInt, vest: nonNegativeInt, weapon: nonNegativeInt, speed: nonNegativeInt, scope: nonNegativeInt, range: nonNegativeInt }),
    /** Lunettes : grossissement du champ de vision et poids de chacune. */
    SCOPES: z.array(z.object({ zoom: z.number().int().min(2).max(32), weight: positiveInt })).min(1),
    /** Boisson énergisante : vitesse en plus (%) et durée. */
    SPEED_BOOST_PERCENT: z.number().int().min(1).max(100),
    SPEED_BOOST_MS: positiveInt,
    /** Booster de portée (3A) : portée de tir en plus (%) et durée. */
    RANGE_BOOST_PERCENT: z.number().int().min(1).max(100),
    RANGE_BOOST_MS: positiveInt,
  }),
  ITEMS: z.object({
    /** Trousse de soins : PV rendus aussitôt au ramassage. */
    HEAL_HP: positiveInt,
    /** Gilet pare-balles : points de protection, consommés avant les PV. */
    VEST_SHIELD: positiveInt,
    /** Munitions universelles (3A) : réserve maximale et contenu d'une boîte, partagés par toutes les armes à feu. */
    AMMO_MAX: positiveInt,
    AMMO_BOX: positiveInt,
    /** Distance de ramassage, en unités. */
    PICKUP_RANGE: positiveInt,
  }),
  /** Butin posé sur la carte : les mêmes chances pour tout le monde (la rareté du personnage n'y change rien). */
  LOOT: z.object({
    PER_PARTICIPANT: z.number().int().min(0).max(10),
    IN_BUILDINGS_PERCENT: z.number().int().min(0).max(100),
    WEIGHTS: z.object({ weapon: nonNegativeInt, ammo: nonNegativeInt, heal: nonNegativeInt, vest: nonNegativeInt }),
    /** Poids de chaque arme ramassable (toutes depuis 3A : plus de gun de départ). 0 = jamais trouvée au sol. */
    WEAPON_WEIGHTS: z.object(Object.fromEntries(BR_WEAPONS.map((w) => [w, nonNegativeInt])) as Record<BrWeaponId, typeof nonNegativeInt>),
  }),
  /** Récompenses d'une partie classée selon la place finale (tranches en % si le nombre de participants change). */
  ECONOMY: z.object({
    TROPHIES_BY_PLACE: placeBands,
    /** Trophées par élimination, plafonnés, et seulement pour une place dans la première part du classement (en %). */
    KILL_TROPHY: nonNegativeInt,
    KILL_TROPHY_CAP: nonNegativeInt,
    KILL_BONUS_MAX_PLACE_PERCENT: z.number().int().min(1).max(100),
    /** Par rang atteint (0 à 9) : gains réduits et pertes augmentées de ces %. */
    RANK_GAIN_REDUCTION_PERCENT: z.number().int().min(0).max(10),
    RANK_LOSS_INCREASE_PERCENT: z.number().int().min(0).max(30),
    /** Abandon : élimination à la place du moment, ces trophées en moins, et aucune MemeMoney. */
    ABANDON_TROPHY_PENALTY: nonNegativeInt,
    MEME_MONEY_BY_PLACE: placeBands,
    /** MemeMoney gagnée en bataille au plus par jour (fuseau du joueur). */
    MEME_MONEY_DAILY_CAP: nonNegativeInt,
  }),
  /**
   * Bots (conception §7) : ils font partie du moteur et jouent avec les mêmes commandes et les mêmes règles qu'un joueur.
   * Difficulté : niveau = min(MAX_LEVEL, trophées du joueur / TROPHIES_PER_LEVEL) ; chaque réglage en paire
   * [niveau 0, niveau maximal] est interpolé entre ces deux valeurs.
   */
  BOTS: z.object({
    /** Décisions par seconde de chaque bot (les bots sont répartis sur les calculs successifs). */
    THINK_PER_SECOND: z.number().int().min(1).max(20),
    /** Ouïe : tirs entendus dans ce rayon (unités), avec une position approximative. */
    HEARING_RANGE: positiveInt,
    /** Mémoire de la dernière position connue d'un ennemi, en millisecondes. */
    MEMORY_MS: positiveInt,
    /** Recherche de chemin : nœuds explorés au plus par recherche, et recherches au plus par calcul (tous bots confondus). */
    PATH_MAX_NODES: positiveInt,
    PATHS_PER_TICK: positiveInt,
    /** Anti-blocage : un bot qui avance de moins de STUCK_UNITS en STUCK_MS change de direction, puis recalcule son chemin. */
    STUCK_MS: positiveInt,
    STUCK_UNITS: positiveInt,
    TROPHIES_PER_LEVEL: positiveInt,
    MAX_LEVEL: z.number().int().min(1).max(20),
    REACTION_MS: z.tuple([positiveInt, positiveInt]),
    /** Erreur de visée : ± pas d'angle (un tour = 256 pas). */
    AIM_ERROR_STEPS: z.tuple([z.number().int().min(0).max(64), z.number().int().min(0).max(64)]),
    /** Anticipation du déplacement de la cible, en %. */
    LEAD_PERCENT: z.tuple([z.number().int().min(0).max(100), z.number().int().min(0).max(100)]),
    /** Bruit des scores de décision (sur 1 000) : plus il est fort, moins les choix sont bons. */
    DECISION_NOISE: z.tuple([z.number().int().min(0).max(1000), z.number().int().min(0).max(1000)]),
    /** Chance de faire des pas de côté pendant un combat, en %. */
    STRAFE_PERCENT: z.tuple([z.number().int().min(0).max(100), z.number().int().min(0).max(100)]),
    /** Variation du niveau de chaque bot, en niveaux (±), tirée à la création de la partie. */
    PERSONALITY_LEVEL_SPREAD: z.number().int().min(0).max(5),
  }),
  /**
   * Mode Entraînement (hors ligne, sans récompense) : 99 bots « BOT » portant des cartes du jeu. Difficulté choisie
   * par le joueur : Facile (bots débutants), Normal (niveau selon ses trophées, comme en partie classée),
   * Difficile (HARD_BONUS_LEVELS niveaux au-dessus).
   */
  TRAINING: z.object({ HARD_BONUS_LEVELS: z.number().int().min(1).max(10) }),
});

const gameConfigSchema = z
  .object({
    /** Nom du jeu affiché partout (titre, manifest PWA, e-mails). */
    GAME_NAME: z.string().min(1).max(30),
    /** Nom court pour l'icône sur l'écran d'accueil (12 caractères max). */
    GAME_SHORT_NAME: z.string().min(1).max(12),
    GAME_TAGLINE: z.string().min(1).max(120),

    /**
     * Doublons : améliorations cosmétiques (aucun effet en combat) et revente.
     * Les prix de revente sont en centièmes de MemeMoney ; les fractions sont
     * conservées d'une vente à l'autre.
     */
    DUPLICATES: z.object({
      /** Exemplaires à utiliser pour chaque évolution (★, ★★, ★★★, Divine), selon la rareté. */
      UPGRADES: z.record(z.enum(RARITIES), z.tuple([positiveInt, positiveInt, positiveInt, positiveInt])),
      /** Bonus de statistiques (PV, attaque, défense, vitesse), en %, aux niveaux 0 (normale), ★, ★★, ★★★ et Divine. */
      STAT_BONUS_PERCENT: z.tuple([z.literal(0), nonNegativeInt, nonNegativeInt, nonNegativeInt, nonNegativeInt]),
      SELL_CENTS: z.record(z.enum(RARITIES), positiveInt),
    }),
    BOOSTER_SIZE: z.number().int().min(1).max(10),
    /**
     * Composition des trois boosters. Chaque booster a des cartes fixes, plus un
     * emplacement « au choix » : la rareté habituelle, ou (plus rarement) la
     * rareté supérieure. Une Godlevel peut remplacer une commune, avec une
     * chance très faible, dans tous les boosters.
     */
    BOOSTERS: z.object({
      daily: boosterSchema,
      special: boosterSchema,
      very_special: boosterSchema,
    }),
    /** Booster journalier : la rareté supérieure de l'emplacement au choix est garantie au N-ième booster sans l'avoir eue. */
    PITY_THRESHOLD: z.number().int().min(2),

    DAILY_FREE_BOOSTERS: nonNegativeInt,
    DAILY_CHALLENGES: z.number().int().min(0).max(10),
    CHALLENGE_REWARD_BOOSTERS: nonNegativeInt,
    /** Délai minimal entre deux changements de fuseau (évite d'obtenir des boosters en plus). */
    TIMEZONE_CHANGE_COOLDOWN_DAYS: nonNegativeInt,

    /** Poussière gagnée en recyclant un exemplaire en trop. */
    DUST_VALUES: rarityRecord(positiveInt),
    /** Coût de fabrication = valeur de recyclage × ce multiplicateur. */
    CRAFT_MULTIPLIER: positiveInt,

    TEAM_SIZE: z.number().int().min(1).max(6),
    MAX_DECKS: z.number().int().min(1).max(20),
    TURN_SECONDS: positiveInt,
    RECONNECT_SECONDS: positiveInt,
    BOT_OFFER_SECONDS: positiveInt,
    MAX_TURNS: positiveInt,
    AFK_TIMEOUTS_BEFORE_LOSS: positiveInt,

    /** Trophées : gagnés ou perdus en bataille classée ; un rang tous les TROPHIES_PER_RANK. */
    TROPHIES: z.object({
      WIN: nonNegativeInt,
      LOSS: nonNegativeInt,
      DRAW: nonNegativeInt,
      PER_RANK: positiveInt,
      /** Matchmaking : écart de trophées accepté au départ, élargi à intervalles réguliers. */
      MATCH_WINDOW_START: positiveInt,
      MATCH_WINDOW_STEP: positiveInt,
      MATCH_WINDOW_STEP_SECONDS: positiveInt,
      /** Classement « autour de moi » : joueurs à ± ce nombre de trophées. */
      LEADERBOARD_AROUND: positiveInt,
    }),

    /** MemeMoney : monnaie du jeu. Prix en MemeMoney. */
    MEME_MONEY: z.object({
      WIN_REWARD: nonNegativeInt,
      EXTRA_DAILY_BOOSTER_PRICE: positiveInt,
      SPECIAL_BOOSTER_PRICE: positiveInt,
      VERY_SPECIAL_BOOSTER_PRICE: positiveInt,
    }),

    /** Classement : doit rester aligné avec la migration 20261006000400_classements.sql. */
    RANKING: z.object({
      POPULARITY_LIKES_WEIGHT: z.number().min(0).max(1),
      POPULARITY_USAGE_WEIGHT: z.number().min(0).max(1),
      WIN_RATE_PRIOR_WINS: nonNegativeInt,
      WIN_RATE_PRIOR_GAMES: nonNegativeInt,
      USAGE_WINDOW_DAYS: positiveInt,
    }),

    /** Achats (phase 5). Prix en centimes d'euro, TTC. */
    PURCHASES: z.object({
      MIN_AGE: z.number().int().min(13),
      CURRENCY: z.string().length(3),
      MONTHLY_SPEND_CAP_CENTS: nonNegativeInt,
      CAP_RAISE_DELAY_DAYS: nonNegativeInt,
      /** Codes pays ISO 3166-1 alpha-2 où la boutique est désactivée. */
      BLOCKED_COUNTRIES: z.array(z.string().regex(/^[A-Z]{2}$/)),
      /** Packs de MemeMoney achetables en argent réel (phase 5). */
      PRODUCTS: z
        .array(
          z.object({
            code: z.string().regex(/^[a-z0-9_]+$/),
            /** MemeMoney de base, et bonus offert en plus. */
            memeMoney: positiveInt,
            bonus: nonNegativeInt,
            /** Prix de référence, en centimes d'euro (prix locaux : src/config/shop.ts). */
            priceCents: positiveInt,
            tag: z.enum(["popular", "best_value"]).nullable(),
          }),
        )
        .min(1),
    }),

    /** Âge minimum pour créer un compte (attestation par case à cocher). null = aucun minimum. */
    MIN_ACCOUNT_AGE: z.number().int().min(1).nullable(),

    /** Battle royale (conception validée : docs/BATTLE_ROYALE_CONCEPTION.md). Moteur : src/lib/br/. */
    BATTLE_ROYALE: battleRoyaleSchema,
  })
  .superRefine((cfg, ctx) => {
    const br = cfg.BATTLE_ROYALE;
    const tickMs = 1000 / br.TICK_RATE;
    for (const id of BR_WEAPONS) {
      const w = br.WEAPONS[id];
      if (w.fireIntervalMs < tickMs || w.reloadMs < tickMs) {
        ctx.addIssue({ code: "custom", path: ["BATTLE_ROYALE", "WEAPONS", id], message: "Durées plus courtes qu'un calcul du moteur." });
      }
    }
    if (br.ECONOMY.TROPHIES_BY_PLACE.at(-1)![0] !== 100) {
      ctx.addIssue({ code: "custom", path: ["BATTLE_ROYALE", "ECONOMY", "TROPHIES_BY_PLACE"], message: "La dernière tranche doit aller jusqu'à 100 %." });
    }
    if (br.ECONOMY.MEME_MONEY_BY_PLACE.some(([, mm]) => mm < 0)) {
      ctx.addIssue({ code: "custom", path: ["BATTLE_ROYALE", "ECONOMY", "MEME_MONEY_BY_PLACE"], message: "Pas de MemeMoney négative." });
    }
    if (br.ZONE.PHASES.at(-1)!.radiusPercent !== 0) {
      ctx.addIssue({ code: "custom", path: ["BATTLE_ROYALE", "ZONE", "PHASES"], message: "La dernière phase referme la zone (rayon 0 %) : la partie finit toujours." });
    }
    // Positions en sous-unités (×16) : la carte doit tenir largement dans un entier 32 bits.
    if (br.MAP.TILES * br.MAP.TILE_UNITS * 16 > 2 ** 20) {
      ctx.addIssue({ code: "custom", path: ["BATTLE_ROYALE", "MAP"], message: "Carte trop grande." });
    }
    for (const [kind, booster] of Object.entries(cfg.BOOSTERS)) {
      const fixed = Object.values(booster.fixed).reduce((n, c) => n + (c ?? 0), 0);
      if (fixed + 1 !== cfg.BOOSTER_SIZE) {
        ctx.addIssue({ code: "custom", path: ["BOOSTERS", kind], message: `${fixed} cartes fixes + 1 au choix ≠ ${cfg.BOOSTER_SIZE}.` });
      }
      if (booster.godlevelChance > 0 && !booster.fixed.commune) {
        ctx.addIssue({ code: "custom", path: ["BOOSTERS", kind], message: "La Godlevel remplace une commune : il en faut au moins une." });
      }
      if (rarityTierOf(booster.flex.upgrade) <= rarityTierOf(booster.flex.usual)) {
        ctx.addIssue({ code: "custom", path: ["BOOSTERS", kind, "flex"], message: "La rareté supérieure doit être plus rare que l'habituelle." });
      }
    }
    const w = cfg.RANKING.POPULARITY_LIKES_WEIGHT + cfg.RANKING.POPULARITY_USAGE_WEIGHT;
    if (Math.abs(w - 1) > 1e-9) {
      ctx.addIssue({ code: "custom", path: ["RANKING"], message: "Les poids de popularité doivent faire 1." });
    }
  });

export type GameConfig = z.infer<typeof gameConfigSchema>;

export const GAME_CONFIG: GameConfig = gameConfigSchema.parse({
  GAME_NAME: "Battle Meme",
  GAME_SHORT_NAME: "Battle Meme",
  GAME_TAGLINE: "Ouvre des boosters, complète ta collection et affronte des joueurs du monde entier.",

  DUPLICATES: {
    // ★, puis ★★, ★★★ et enfin Divine (MAX) : exemplaires à utiliser pour chaque évolution (choix du propriétaire,
    // 2026-10-26). Plus la carte est rare, moins il en faut (on en obtient beaucoup moins).
    UPGRADES: {
      commune: [5, 10, 15, 20],
      rare: [4, 8, 12, 16],
      epique: [3, 6, 9, 12],
      legendaire: [2, 4, 6, 8],
      godlevel: [1, 2, 3, 4],
    },
    // Volontairement modeste : une carte évoluée reste battable par la même carte sans évolution. Divine : +10 %, comme
    // l'ancienne dernière évolution (l'équilibre du Battle Royale ne change pas).
    STAT_BONUS_PERCENT: [0, 3, 6, 8, 10],
    // 0,1 MemeMoney par commune, 0,25 par rare, 0,5 par épique, 3 par légendaire, 60 par godlevel.
    // Toutes les raretés se revendent jusqu'au dernier exemplaire en trop (le premier reste toujours),
    // sans aucune limite quotidienne (choix du propriétaire, 2026-10-27).
    SELL_CENTS: { commune: 10, rare: 25, epique: 50, legendaire: 300, godlevel: 6000 },
  },
  BOOSTER_SIZE: 10,
  BOOSTERS: {
    // 5 communes, 3 rares, 1 épique + 1 épique (85 %) ou 1 légendaire (15 %).
    daily: {
      fixed: { commune: 5, rare: 3, epique: 1 },
      flex: { usual: "epique", upgrade: "legendaire", upgradeChance: 15 },
      godlevelChance: 0.05,
    },
    // Super Booster : 3 communes, 3 rares, 2 épiques, 1 légendaire + 1 épique (60 %) ou 1 légendaire (40 %).
    special: {
      fixed: { commune: 3, rare: 3, epique: 2, legendaire: 1 },
      flex: { usual: "epique", upgrade: "legendaire", upgradeChance: 40 },
      godlevelChance: 0.5,
    },
    // Ultra Booster : 2 communes, 2 rares, 2 épiques, 3 légendaires + 1 légendaire (97 %) ou 1 godlevel (3 %).
    very_special: {
      fixed: { commune: 2, rare: 2, epique: 2, legendaire: 3 },
      flex: { usual: "legendaire", upgrade: "godlevel", upgradeChance: 3 },
      godlevelChance: 0.5,
    },
  },
  PITY_THRESHOLD: 10,

  DAILY_FREE_BOOSTERS: 3,
  DAILY_CHALLENGES: 3,
  CHALLENGE_REWARD_BOOSTERS: 1,
  TIMEZONE_CHANGE_COOLDOWN_DAYS: 30,

  DUST_VALUES: {
    commune: 5,
    rare: 10,
    epique: 25,
    legendaire: 100,
    godlevel: 1500,
  },
  CRAFT_MULTIPLIER: 4,

  TEAM_SIZE: 3,
  MAX_DECKS: 5,
  TURN_SECONDS: 30,
  RECONNECT_SECONDS: 60,
  BOT_OFFER_SECONDS: 20,
  MAX_TURNS: 30,
  AFK_TIMEOUTS_BEFORE_LOSS: 3,

  TROPHIES: {
    WIN: 25,
    LOSS: 25,
    DRAW: 0,
    PER_RANK: 1000,
    MATCH_WINDOW_START: 150,
    MATCH_WINDOW_STEP: 100,
    MATCH_WINDOW_STEP_SECONDS: 5,
    LEADERBOARD_AROUND: 250,
  },

  MEME_MONEY: {
    WIN_REWARD: 1,
    EXTRA_DAILY_BOOSTER_PRICE: 20,
    SPECIAL_BOOSTER_PRICE: 40,
    VERY_SPECIAL_BOOSTER_PRICE: 80,
  },

  RANKING: {
    POPULARITY_LIKES_WEIGHT: 0.6,
    POPULARITY_USAGE_WEIGHT: 0.4,
    WIN_RATE_PRIOR_WINS: 10,
    WIN_RATE_PRIOR_GAMES: 20,
    USAGE_WINDOW_DAYS: 30,
  },

  PURCHASES: {
    MIN_AGE: 18,
    CURRENCY: "eur",
    MONTHLY_SPEND_CAP_CENTS: 5000,
    CAP_RAISE_DELAY_DAYS: 7,
    BLOCKED_COUNTRIES: ["BE"],
    // 20 MemeMoney = 1 booster en plus. Plus le pack est gros, plus le bonus l'est.
    // ⚠️ Stripe n'accepte pas de paiement par carte sous 0,50 € : le pack à 0,25 € ne pourra
    // pas être vendu seul en phase 5 (voir DECISIONS.md).
    PRODUCTS: [
      { code: "mm_20", memeMoney: 20, bonus: 0, priceCents: 25, tag: null },
      { code: "mm_100", memeMoney: 100, bonus: 10, priceCents: 100, tag: "popular" },
      { code: "mm_200", memeMoney: 200, bonus: 40, priceCents: 200, tag: null },
      { code: "mm_500", memeMoney: 500, bonus: 150, priceCents: 500, tag: "best_value" },
    ],
  },

  MIN_ACCOUNT_AGE: 18,

  // Battle royale : valeurs de la conception validée (2026-10-24), équilibrées par les tournois de bots (phase 2, 2026-10-25 :
  // les 8 seuils de la conception tenus, voir DECISIONS.md). Toute modification : relancer npm run bots:tournament.
  BATTLE_ROYALE: {
    CONFIG_VERSION: 5,
    // 50 participants (décision du propriétaire, 2026-10-26) : plus de calcul et de mémoire pour les graphismes.
    PARTICIPANTS: 50,
    TICK_RATE: 20,
    MAX_DURATION_S: 540,
    // 124 × 124 tuiles pour 50 participants : la même place par participant qu'avec 176 × 176 pour 100 (phase 2).
    // Bâtiments, caisses, buissons et lacs gardent la même densité.
    MAP: {
      TILES: 124,
      TILE_UNITS: 32,
      BORDER_TILES: 2,
      LAKES: [3, 5],
      LAKE_RADIUS_TILES: [3, 7],
      BUILDINGS: [17, 24],
      BUILDING_SIZE_TILES: [6, 11],
      CRATES: 113,
      BUSH_CLUSTERS: 24,
      BUSH_CLUSTER_SIZE: [3, 8],
    },
    VIEW: { HALF_WIDTH: 450, HALF_HEIGHT: 250, BUSH_REVEAL: 64 },
    CONTROLS: { AIM_TURN_PER_TICK: 32, AIM_ASSIST_STEPS: 8, WEAPON_SWITCH_MS: 250 },
    // 6 phases : 7 min de zone (conception : 6 min 30 à 7 min 30), puis la zone fermée achève la partie.
    ZONE: {
      PHASES: [
        { waitS: 75, shrinkS: 50, radiusPercent: 65, dps: 1 },
        { waitS: 56, shrinkS: 44, radiusPercent: 60, dps: 2 },
        { waitS: 50, shrinkS: 38, radiusPercent: 55, dps: 4 },
        { waitS: 44, shrinkS: 31, radiusPercent: 50, dps: 6 },
        { waitS: 38, shrinkS: 31, radiusPercent: 40, dps: 10 },
        { waitS: 31, shrinkS: 38, radiusPercent: 0, dps: 15 },
      ],
    },
    CHARACTER: {
      // Moyenne des 12 communes du jeu de départ.
      REFERENCE: { hp: 92, atk: 39, def: 36, spd: 77, power: 55, heal: 11, dodge: 17, reflect: 17 },
      // Compression κ (statistiques, puissance de la capacité, intensité du passif) et part du bonus d'évolution comptée en
      // bataille : au-delà, une godlevel ou une ★★★ gagnait trop souvent (seuils ×1,3 et ×1,15 de la conception).
      COMPRESSION_PERCENT: 12,
      EVOLUTION_FACTOR_PERCENT: 15,
    },
    ABILITY: {
      COOLDOWN_BASE_MS: 6000,
      COOLDOWN_PER_ENERGY_MS: 3000,
      POWER_REFERENCE: 70,
      SPRINT_PERCENT: 40,
      SPRINT_MS: 2000,
      ARMED_MS: 3000,
      STUN_BASE_MS: 900,
      STUN_MS_PER_CHANCE: 10,
      DRAIN_MS: 2500,
      PIERCE_MS: 4000,
      BUFF_PERCENT: 20,
      BUFF_MS: 5000,
      DEBUFF_PERCENT: 25,
      DEBUFF_MS: 4000,
      MULTI_SPREAD_STEPS: 4,
      BURN_SHOT_DAMAGE: 10,
      BURN_SHOT_SPEED: 1400,
      BURN_SHOT_RANGE: 700,
    },
    // Régénération : un filet de sécurité (jusqu'à 8 % des PV max, après 12 s sans être touché). Plus forte, elle écrasait
    // les autres passifs (tournois de bots : 3 % de Top 1 contre 0,3 %), car on enchaîne les combats sans se soigner.
    PASSIVE: { REGEN_DELAY_MS: 12000, REGEN_CAP_PERCENT: 8, DODGE_DIVISOR: 3, REFLECT_DIVISOR: 1, CLEANSE_PERCENT: 50, RECHARGE_PERCENT: 55 },
    // 3A : plus d'arme à feu de départ (le couteau, KNIFE, est en main au début). Toutes les armes se ramassent et
    // partagent les mêmes munitions. Les 4 de base, puis leurs versions supérieures (loot plus rare, dégâts validés par
    // le propriétaire le 2026-10-27). Portées étendues et chargeurs élargis en 3A.
    WEAPONS: {
      pop: { damage: 8, pellets: 1, fireIntervalMs: 400, magazine: 15, reloadMs: 1500, spreadSteps: 2, speed: 1600, range: 850, ammo: "ammo" },
      petard: { damage: 6, pellets: 6, fireIntervalMs: 900, magazine: 7, reloadMs: 2500, spreadSteps: 10, speed: 1300, range: 450, ammo: "ammo" },
      rafaleuse: { damage: 5, pellets: 1, fireIntervalMs: 100, magazine: 40, reloadMs: 2000, spreadSteps: 5, speed: 1700, range: 750, ammo: "ammo" },
      lunette: { damage: 42, pellets: 1, fireIntervalMs: 1500, magazine: 5, reloadMs: 3000, spreadSteps: 0, speed: 2800, range: 1600, ammo: "ammo" },
      // Pistolet avancé, super fusil à pompe, méga-mitraillette, fusil de précision lourd.
      pop2: { damage: 12, pellets: 1, fireIntervalMs: 320, magazine: 18, reloadMs: 1300, spreadSteps: 1, speed: 1800, range: 950, ammo: "ammo" },
      petard2: { damage: 10, pellets: 8, fireIntervalMs: 800, magazine: 7, reloadMs: 2200, spreadSteps: 8, speed: 1400, range: 520, ammo: "ammo" },
      rafaleuse2: { damage: 10, pellets: 1, fireIntervalMs: 90, magazine: 38, reloadMs: 1800, spreadSteps: 4, speed: 1800, range: 700, ammo: "ammo" },
      lunette2: { damage: 60, pellets: 1, fireIntervalMs: 1400, magazine: 6, reloadMs: 2800, spreadSteps: 0, speed: 3000, range: 1800, ammo: "ammo" },
    },
    // Arme de repli des capacités (Rafale / projectile de brûlure tirés en tenant le couteau) : jamais équipée au départ.
    STARTING_WEAPON: "pop",
    KNIFE: { DAMAGE: 20, INTERVAL_MS: 500, RANGE: 50, ARC_STEPS: 32 },
    // Caisses : 40 de résistance ; butin validé par le propriétaire le 2026-10-26.
    CRATE: {
      HP: 40,
      LOOT_WEIGHTS: { heal: 28, ammo: 24, vest: 14, weapon: 12, speed: 9, scope: 7, range: 6 },
      SCOPES: [
        { zoom: 2, weight: 60 },
        { zoom: 4, weight: 40 },
      ],
      SPEED_BOOST_PERCENT: 20,
      SPEED_BOOST_MS: 15000,
      RANGE_BOOST_PERCENT: 35,
      RANGE_BOOST_MS: 20000,
    },
    ITEMS: {
      HEAL_HP: 40,
      VEST_SHIELD: 50,
      AMMO_MAX: 140,
      AMMO_BOX: 40,
      PICKUP_RANGE: 48,
    },
    LOOT: {
      PER_PARTICIPANT: 3,
      IN_BUILDINGS_PERCENT: 60,
      WEIGHTS: { weapon: 26, ammo: 32, heal: 24, vest: 18 },
      // Armes de base fréquentes, versions supérieures rares.
      WEAPON_WEIGHTS: { pop: 36, petard: 32, rafaleuse: 34, lunette: 22, pop2: 10, petard2: 9, rafaleuse2: 9, lunette2: 7 },
    },
    ECONOMY: {
      // Pour 100 participants : Top 1 +40, 2–3 +30, 4–5 +24, 6–10 +18, 11–20 +12, 21–30 +6, 31–40 +2, 41–50 0, 51–70 −4, 71–90 −8, 91–100 −12.
      TROPHIES_BY_PLACE: [
        [1, 40],
        [3, 30],
        [5, 24],
        [10, 18],
        [20, 12],
        [30, 6],
        [40, 2],
        [50, 0],
        [70, -4],
        [90, -8],
        [100, -12],
      ],
      KILL_TROPHY: 1,
      KILL_TROPHY_CAP: 5,
      KILL_BONUS_MAX_PLACE_PERCENT: 50,
      RANK_GAIN_REDUCTION_PERCENT: 5,
      RANK_LOSS_INCREASE_PERCENT: 10,
      ABANDON_TROPHY_PENALTY: 5,
      // Top 1 : 5 ; Top 2–5 : 3 ; Top 6–10 : 2 ; Top 11–25 : 1 ; au-delà : rien.
      MEME_MONEY_BY_PLACE: [
        [1, 5],
        [5, 3],
        [10, 2],
        [25, 1],
      ],
      MEME_MONEY_DAILY_CAP: 15,
    },
    BOTS: {
      THINK_PER_SECOND: 4,
      HEARING_RANGE: 1200,
      MEMORY_MS: 5000,
      PATH_MAX_NODES: 2000,
      PATHS_PER_TICK: 6,
      STUCK_MS: 1000,
      STUCK_UNITS: 16,
      // Niveau 0 (débutant) → niveau 10 (Immortel, 6 000 trophées et plus).
      TROPHIES_PER_LEVEL: 600,
      MAX_LEVEL: 10,
      REACTION_MS: [650, 170],
      AIM_ERROR_STEPS: [16, 3],
      LEAD_PERCENT: [0, 90],
      DECISION_NOISE: [250, 30],
      STRAFE_PERCENT: [0, 80],
      PERSONALITY_LEVEL_SPREAD: 1,
    },
    TRAINING: { HARD_BONUS_LEVELS: 3 },
  },
});

export { gameConfigSchema };
