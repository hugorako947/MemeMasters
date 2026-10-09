/**
 * Règles de la bataille en temps réel (style « arène à tours »).
 * Unités : millièmes de case (une case = 1 000) et ticks (20 par seconde).
 * Tout est en nombres entiers : la simulation donne exactement le même
 * résultat sur tous les appareils et sur le serveur.
 */
import type { Rarity } from "@/config/rarities";

export const TICK_RATE = 20;
export const ticks = (seconds: number) => Math.round(seconds * TICK_RATE);

export const ARENA = {
  W: 18_000,
  H: 32_000,
  /** La rivière sépare les deux camps ; on la traverse par deux ponts. */
  RIVER_TOP: 15_000,
  RIVER_BOTTOM: 17_000,
  BRIDGES: [3_500, 14_500] as const,
  BRIDGE_HALF: 1_500,
};

export const RULES = {
  MATCH_TICKS: ticks(180), // 3 minutes
  DOUBLE_ENERGY_AT: ticks(120), // dernière minute : énergie ×2
  OVERTIME_TICKS: ticks(60), // prolongation : la première couronne gagne
  DEPLOY_DELAY: ticks(1), // une carte posée apparaît après 1 seconde
  ENERGY_MAX: 10_000,
  ENERGY_START: 5_000,
  ENERGY_REGEN: 18, // ≈ 1 point toutes les 2,8 s
  HAND_SIZE: 4,
  DECK_SIZE: 8,
  SIGHT: 5_500, // distance à laquelle une unité repère un ennemi
  UNIT_RADIUS: 450,
} as const;

/** Coût en énergie selon la rareté. */
export const COST: Record<Rarity, number> = {
  commune: 2,
  rare: 3,
  epique: 4,
  legendaire: 5,
  brainrot: 6,
  superbrainrot: 7,
  godlevel: 8,
};

export const TOWERS = {
  princess: { hp: 2_600, damage: 70, hitTicks: ticks(0.8), range: 7_000, radius: 1_100 },
  king: { hp: 4_000, damage: 80, hitTicks: ticks(1), range: 7_000, radius: 1_400 },
} as const;
