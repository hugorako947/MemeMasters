/**
 * Budget de statistiques par rareté (conception, section 7) :
 *   PV/2 + ATK + DEF + VIT/2 = 160 × multiplicateur de la rareté
 * Commune 160, rare 168, épique 176, légendaire 184, godlevel 208 (inchangés lors du passage à 5 raretés).
 */
import type { Rarity } from "@/config/rarities";

export const STAT_BUDGET_BASE = 160;
/** Multiplicateur du budget de chaque rareté. */
export const STAT_BUDGET_FACTOR: Record<Rarity, number> = { commune: 1, rare: 1.05, epique: 1.1, legendaire: 1.15, godlevel: 1.3 };
/** Écart toléré autour du budget (±3 %). */
export const STAT_BUDGET_TOLERANCE = 0.03;

export interface StatLine {
  hp: number;
  atk: number;
  def: number;
  spd: number;
}

export function statIndex({ hp, atk, def, spd }: StatLine): number {
  return hp / 2 + atk + def + spd / 2;
}

export function statBudget(rarity: Rarity): number {
  return STAT_BUDGET_BASE * STAT_BUDGET_FACTOR[rarity];
}

export interface BudgetCheck {
  index: number;
  budget: number;
  /** Écart relatif, ex. 0,031 pour +3,1 %. */
  deviation: number;
  withinTolerance: boolean;
}

export function checkBudget(stats: StatLine, rarity: Rarity): BudgetCheck {
  const index = statIndex(stats);
  const budget = statBudget(rarity);
  const deviation = (index - budget) / budget;
  return { index, budget, deviation, withinTolerance: Math.abs(deviation) <= STAT_BUDGET_TOLERANCE + 1e-9 };
}
