/**
 * Budget de statistiques par rareté (conception, section 7) :
 *   PV/2 + ATK + DEF + VIT/2 = 160 × (1 + 0,05 × rang)
 * Le rang va de 0 (commune, budget 160) à 6 (godlevel, budget 208).
 */
import { rarityTier, type Rarity } from "@/config/rarities";

export const STAT_BUDGET_BASE = 160;
export const STAT_BUDGET_STEP = 0.05;
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
  return STAT_BUDGET_BASE * (1 + STAT_BUDGET_STEP * rarityTier(rarity));
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
