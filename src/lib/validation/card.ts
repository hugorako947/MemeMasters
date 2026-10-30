/**
 * Schémas des cartes. Les colonnes jsonb de `public.cards` (attaques et
 * capacité défensive) sont validées ici, côté serveur, avant toute écriture.
 */
import { z } from "zod";
import { RARITIES } from "@/config/rarities";

export const STAT_KEYS = ["atk", "def", "spd"] as const;
export type StatKey = (typeof STAT_KEYS)[number];

/**
 * Catalogue fermé des effets d'attaque spéciale (voir conception, section 7).
 *
 * L'admin choisit l'effet et peut régler, dans des bornes, son **intensité** (`percent`/`chance`/`hits`)
 * et sa **durée** (`seconds`). Les champs de durée et l'option « toutes les stats » sont **optionnels** :
 * une carte qui ne les précise pas garde le comportement par défaut (valeurs de `GAME_CONFIG.BATTLE_ROYALE.ABILITY`),
 * ce qui rend tout rétrocompatible (aucune migration). En bataille, l'intensité reste comprimée par κ
 * (une capacité de godlevel ne vaut guère plus que celle d'une commune ; voir `character.ts`).
 */
export const specialEffectSchema = z.discriminatedUnion("kind", [
  /** Sprint : +percent % de vitesse pendant seconds s (valeurs par défaut si absentes). */
  z.object({ kind: z.literal("none"), percent: z.number().int().min(10).max(60).optional(), seconds: z.number().int().min(2).max(8).optional() }),
  /** Brûlure : percent % des PV max par seconde, pendant seconds s (ou turns tours, hérité). */
  z.object({
    kind: z.literal("dot"),
    percent: z.number().int().min(1).max(30),
    turns: z.number().int().min(1).max(3).optional(),
    seconds: z.number().int().min(2).max(10).optional(),
  }),
  /** Étourdissement : la prochaine balle immobilise la cible pendant seconds s (ou selon chance, hérité). */
  z.object({ kind: z.literal("stun"), chance: z.number().int().min(1).max(60), seconds: z.number().int().min(1).max(3).optional() }),
  /** Affaiblissement : baisse de percent % d'une stat (ou de toutes avec `all`) pendant seconds s. */
  z.object({
    kind: z.literal("debuff"),
    stat: z.enum(STAT_KEYS).optional(),
    all: z.boolean().optional(),
    stages: z.literal(1).optional(),
    percent: z.number().int().min(10).max(50).optional(),
    seconds: z.number().int().min(2).max(8).optional(),
  }),
  /** Boost : hausse de percent % d'une stat (ou de toutes avec `all`) sur soi pendant seconds s. */
  z.object({
    kind: z.literal("buff"),
    stat: z.enum(STAT_KEYS).optional(),
    all: z.boolean().optional(),
    stages: z.literal(1).optional(),
    percent: z.number().int().min(10).max(50).optional(),
    seconds: z.number().int().min(2).max(8).optional(),
  }),
  /** Perce-défense : ignore percent % de la défense pendant seconds s. */
  z.object({ kind: z.literal("pierce"), percent: z.number().int().min(10).max(80), seconds: z.number().int().min(2).max(8).optional() }),
  /** Vol de vie : soigne percent % des dégâts infligés pendant seconds s. */
  z.object({ kind: z.literal("drain"), percent: z.number().int().min(10).max(60), seconds: z.number().int().min(2).max(6).optional() }),
  /** Multi-coup : N coups à un % de la puissance chacun. */
  z.object({ kind: z.literal("multi"), hits: z.number().int().min(2).max(4), percent: z.number().int().min(25).max(60) }),
]);
export type SpecialEffect = z.infer<typeof specialEffectSchema>;

export const defenseEffectSchema = z.discriminatedUnion("kind", [
  /** Renvoi : % des dégâts bloqués renvoyés à l'attaquant. */
  z.object({ kind: z.literal("reflect"), percent: z.number().int().min(10).max(50) }),
  /** Esquive : chance d'annuler l'attaque. */
  z.object({ kind: z.literal("dodge"), chance: z.number().int().min(5).max(40) }),
  /** Soin : % des PV max rendus. */
  z.object({ kind: z.literal("heal"), percent: z.number().int().min(5).max(20) }),
  /** Recharge : énergie supplémentaire. */
  z.object({ kind: z.literal("recharge"), amount: z.literal(1) }),
  /** Immunité : annule les effets négatifs reçus ce tour. */
  z.object({ kind: z.literal("cleanse") }),
]);
export type DefenseEffect = z.infer<typeof defenseEffectSchema>;

const moveName = z.string().trim().min(1).max(32);

export const normalAttackSchema = z.object({
  name: moveName,
  power: z.number().int().min(25).max(35),
});

export const specialAttackSchema = z.object({
  name: moveName,
  power: z.number().int().min(50).max(90),
  energyCost: z.number().int().min(2).max(4),
  effect: specialEffectSchema,
});

export const defenseAbilitySchema = z.object({
  name: moveName,
  effect: defenseEffectSchema,
});

export const cardStatsSchema = z.object({
  hp: z.number().int().min(60).max(140),
  atk: z.number().int().min(20).max(65),
  def: z.number().int().min(20).max(65),
  spd: z.number().int().min(10).max(100),
});

/** Carte telle que manipulée par l'application (champs en camelCase). */
export const cardSchema = cardStatsSchema.extend({
  id: z.string().uuid(),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(60),
  name: z.string().trim().min(1).max(40),
  description: z.string().max(280),
  rarity: z.enum(RARITIES),
  normalAttack: normalAttackSchema,
  specialAttack: specialAttackSchema,
  defenseAbility: defenseAbilitySchema,
  artSeed: z.number().int().nonnegative(),
  imageUrl: z.string().url().nullable(),
});

export type Card = z.infer<typeof cardSchema>;
