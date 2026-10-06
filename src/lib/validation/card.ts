/**
 * Schémas des cartes. Les colonnes jsonb de `public.cards` (attaques et
 * capacité défensive) sont validées ici, côté serveur, avant toute écriture.
 */
import { z } from "zod";
import { RARITIES } from "@/config/rarities";
import { VIBES } from "@/config/vibes";

export const STAT_KEYS = ["atk", "def", "spd"] as const;
export type StatKey = (typeof STAT_KEYS)[number];

/** Catalogue fermé des effets d'attaque spéciale (voir conception, section 7). */
export const specialEffectSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  /** Malaise : % des PV max de la cible pendant N tours. */
  z.object({ kind: z.literal("dot"), percent: z.number().int().min(1).max(15), turns: z.number().int().min(1).max(3) }),
  /** Bug : chance que la cible perde son action si elle est plus lente. */
  z.object({ kind: z.literal("stun"), chance: z.number().int().min(1).max(50) }),
  /** Ratio : baisse d'un palier d'une stat de la cible. */
  z.object({ kind: z.literal("debuff"), stat: z.enum(STAT_KEYS), stages: z.literal(1) }),
  /** Hype : hausse d'un palier d'une stat sur soi. */
  z.object({ kind: z.literal("buff"), stat: z.enum(STAT_KEYS), stages: z.literal(1) }),
  /** Perce-défense : ignore un % de la défense. */
  z.object({ kind: z.literal("pierce"), percent: z.number().int().min(10).max(60) }),
  /** Vol de vie : soigne un % des dégâts infligés. */
  z.object({ kind: z.literal("drain"), percent: z.number().int().min(10).max(60) }),
  /** Multi-coup : N coups à un % de la puissance chacun. */
  z.object({ kind: z.literal("multi"), hits: z.number().int().min(2).max(3), percent: z.number().int().min(25).max(60) }),
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
  vibe: z.enum(VIBES),
  normalAttack: normalAttackSchema,
  specialAttack: specialAttackSchema,
  defenseAbility: defenseAbilitySchema,
  artSeed: z.number().int().nonnegative(),
  imageUrl: z.string().url().nullable(),
});

export type Card = z.infer<typeof cardSchema>;
