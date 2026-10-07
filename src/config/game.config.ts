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
import { RARITIES, type Rarity } from "./rarities";

const rarityRecord = <T extends z.ZodType>(schema: T) =>
  z.object(Object.fromEntries(RARITIES.map((r) => [r, schema])) as Record<Rarity, T>);

const percent = z.number().min(0).max(100);
const positiveInt = z.number().int().positive();
const nonNegativeInt = z.number().int().nonnegative();

const gameConfigSchema = z
  .object({
    /** Nom du jeu affiché partout (titre, manifest PWA, e-mails). */
    GAME_NAME: z.string().min(1).max(30),
    /** Nom court pour l'icône sur l'écran d'accueil (12 caractères max). */
    GAME_SHORT_NAME: z.string().min(1).max(12),
    GAME_TAGLINE: z.string().min(1).max(120),

    /** Taux de drop par emplacement de booster, en pourcentage. Somme = 100. */
    DROP_RATES: rarityRecord(percent),
    BOOSTER_SIZE: z.number().int().min(1).max(10),
    /** Le dernier emplacement de chaque booster est au moins de cette rareté. */
    GUARANTEED_MIN_RARITY: z.enum(RARITIES),
    /** Une légendaire ou mieux est garantie au plus tard au N-ième booster sans en avoir eu. */
    PITY_THRESHOLD: z.number().int().min(2),
    PITY_MIN_RARITY: z.enum(RARITIES),

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
            memeMoney: positiveInt,
            priceCents: positiveInt,
          }),
        )
        .min(1),
    }),

    /** Âge minimum pour créer un compte (attestation par case à cocher). null = aucun minimum. */
    MIN_ACCOUNT_AGE: z.number().int().min(1).nullable(),

  })
  .superRefine((cfg, ctx) => {
    const total = RARITIES.reduce((sum, r) => sum + cfg.DROP_RATES[r], 0);
    if (Math.abs(total - 100) > 1e-9) {
      ctx.addIssue({ code: "custom", path: ["DROP_RATES"], message: `La somme des taux doit faire 100 % (actuellement ${total} %).` });
    }
    const w = cfg.RANKING.POPULARITY_LIKES_WEIGHT + cfg.RANKING.POPULARITY_USAGE_WEIGHT;
    if (Math.abs(w - 1) > 1e-9) {
      ctx.addIssue({ code: "custom", path: ["RANKING"], message: "Les poids de popularité doivent faire 1." });
    }
    for (const r of RARITIES) {
      if (cfg.DROP_RATES[r] === 0) {
        ctx.addIssue({ code: "custom", path: ["DROP_RATES", r], message: `Le taux de « ${r} » ne peut pas être nul.` });
      }
    }
  });

export type GameConfig = z.infer<typeof gameConfigSchema>;

export const GAME_CONFIG: GameConfig = gameConfigSchema.parse({
  GAME_NAME: "MemeMasters",
  GAME_SHORT_NAME: "MemeMasters",
  GAME_TAGLINE: "Ouvre des boosters, complète ta collection et affronte des joueurs du monde entier.",

  DROP_RATES: {
    commune: 55,
    rare: 25,
    epique: 12,
    mystique: 5,
    legendaire: 2,
    omniversal: 0.7,
    superbrainrot: 0.25,
    godlevel: 0.05,
  },
  BOOSTER_SIZE: 10,
  GUARANTEED_MIN_RARITY: "rare",
  PITY_THRESHOLD: 10,
  PITY_MIN_RARITY: "legendaire",

  DAILY_FREE_BOOSTERS: 3,
  DAILY_CHALLENGES: 3,
  CHALLENGE_REWARD_BOOSTERS: 1,
  TIMEZONE_CHANGE_COOLDOWN_DAYS: 30,

  DUST_VALUES: {
    commune: 5,
    rare: 10,
    epique: 25,
    mystique: 50,
    legendaire: 100,
    omniversal: 250,
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
    // Prix provisoires : 20 MemeMoney ≈ 1 booster supplémentaire.
    PRODUCTS: [
      { code: "mm_20", memeMoney: 20, priceCents: 99 },
      { code: "mm_110", memeMoney: 110, priceCents: 499 },
      { code: "mm_240", memeMoney: 240, priceCents: 999 },
    ],
  },

  MIN_ACCOUNT_AGE: 18,

});

export { gameConfigSchema };
