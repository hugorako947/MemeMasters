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
      UPGRADES: z.object({ gold: positiveInt, divine: positiveInt }),
      SELL_CENTS: z.record(z.enum(RARITIES), positiveInt),
      /** À partir de cette rareté, la revente n'entre pas dans le plafond quotidien. */
      CAP_EXEMPT_FROM: z.enum(RARITIES),
      DAILY_SELL_CAP: positiveInt,
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

  })
  .superRefine((cfg, ctx) => {
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
  GAME_NAME: "MemeMasters",
  GAME_SHORT_NAME: "MemeMasters",
  GAME_TAGLINE: "Ouvre des boosters, complète ta collection et affronte des joueurs du monde entier.",

  DUPLICATES: {
    // Dorée : 5 doublons ; Divine : 10 doublons de plus (sur une carte dorée).
    UPGRADES: { gold: 5, divine: 10 },
    // 0,1 MemeMoney par commune, 0,25 par rare, 0,5 par épique, puis 3 / 10 / 25 / 60.
    SELL_CENTS: { commune: 10, rare: 25, epique: 50, legendaire: 300, brainrot: 1000, superbrainrot: 2500, godlevel: 6000 },
    // Toutes les raretés se revendent jusqu'au dernier exemplaire (sauf une carte Dorée ou Divine).
    CAP_EXEMPT_FROM: "legendaire",
    // MemeMoney maximum gagnée chaque jour (fuseau du joueur) en revendant des communes,
    // rares et épiques. Les doublons de Légendaire et au-dessus, rares par nature, n'y sont pas soumis.
    DAILY_SELL_CAP: 20,
  },
  BOOSTER_SIZE: 10,
  BOOSTERS: {
    // 5 communes, 3 rares, 1 épique + 1 épique (85 %) ou 1 légendaire (15 %).
    daily: {
      fixed: { commune: 5, rare: 3, epique: 1 },
      flex: { usual: "epique", upgrade: "legendaire", upgradeChance: 15 },
      godlevelChance: 0.05,
    },
    // 3 communes, 3 rares, 2 épiques, 1 légendaire + 1 légendaire (88 %) ou 1 brainrot (12 %).
    special: {
      fixed: { commune: 3, rare: 3, epique: 2, legendaire: 1 },
      flex: { usual: "legendaire", upgrade: "brainrot", upgradeChance: 12 },
      godlevelChance: 0.1,
    },
    // 2 communes, 2 rares, 2 épiques, 2 légendaires, 1 brainrot + 1 brainrot (90 %) ou 1 superbrainrot (10 %).
    very_special: {
      fixed: { commune: 2, rare: 2, epique: 2, legendaire: 2, brainrot: 1 },
      flex: { usual: "brainrot", upgrade: "superbrainrot", upgradeChance: 10 },
      godlevelChance: 0.25,
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
    brainrot: 250,
    superbrainrot: 600,
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

});

export { gameConfigSchema };
