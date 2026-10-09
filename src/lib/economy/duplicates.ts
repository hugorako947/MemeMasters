/**
 * Exemplaires en trop : améliorations (Dorée ★, Dorée ★★, Divine ★★★) et
 * revente contre de la MemeMoney.
 * Fonctions pures, utilisées par le serveur (qui décide) et par l'interface
 * (qui affiche un aperçu). Les montants sont en centièmes de MemeMoney.
 */
import { GAME_CONFIG } from "@/config/game.config";
import { isAtLeast, RARITIES, type Rarity } from "@/config/rarities";

/** Niveau d'amélioration : 0 normale, 1 Dorée ★, 2 Dorée ★★, 3 Divine ★★★. */
export const LEVELS = [0, 1, 2, 3] as const;
export type Level = (typeof LEVELS)[number];
export const MAX_LEVEL: Level = 3;

/** Apparence correspondant au niveau : dorée (★, ★★) ou divine (★★★). */
export function lookOf(level: Level): "normal" | "gold" | "divine" {
  return level === 0 ? "normal" : level === MAX_LEVEL ? "divine" : "gold";
}

/** Prochain niveau et son coût en exemplaires, ou null si la carte est déjà Divine ★★★. */
export function nextUpgrade(rarity: Rarity, level: Level, config = GAME_CONFIG.DUPLICATES): { to: Level; cost: number } | null {
  if (level >= MAX_LEVEL) return null;
  return { to: (level + 1) as Level, cost: config.UPGRADES[rarity][level as 0 | 1 | 2] };
}

/** Statistiques augmentées par l'amélioration (arrondies, jamais en dessous de la carte de base). */
export function boostedStats<T extends { hp: number; atk: number; def: number; spd: number }>(card: T, level: Level, config = GAME_CONFIG.DUPLICATES): T {
  const pct = config.STAT_BONUS_PERCENT[level];
  if (!pct) return card;
  const up = (v: number) => Math.round((v * (100 + pct)) / 100);
  return { ...card, hp: up(card.hp), atk: up(card.atk), def: up(card.def), spd: up(card.spd) };
}

/** Exemplaires en trop = exemplaires au-delà du premier. */
export function duplicatesOf(quantity: number): number {
  return Math.max(0, quantity - 1);
}

export function canUpgrade(rarity: Rarity, quantity: number, level: Level): boolean {
  const next = nextUpgrade(rarity, level);
  return next !== null && duplicatesOf(quantity) >= next.cost;
}

/**
 * Exemplaires revendables : les exemplaires en trop. Le premier exemplaire
 * reste toujours dans la collection (le but est de collectionner toutes les
 * cartes), quelle que soit la rareté ou l'amélioration.
 */
export function maxSellable(quantity: number): number {
  return duplicatesOf(quantity);
}

/**
 * Revente d'une carte en un geste : tous ses exemplaires en trop, dans la
 * limite du plafond du jour pour les communes, rares et épiques.
 */
export function sellAllDuplicates(rarity: Rarity, quantity: number, remainingCents: number): { count: number; cents: number; limited: boolean } {
  const dups = maxSellable(quantity);
  const price = GAME_CONFIG.DUPLICATES.SELL_CENTS[rarity];
  const count = countsTowardCap(rarity) ? Math.min(dups, Math.floor(remainingCents / price)) : dups;
  return { count, cents: count * price, limited: count < dups };
}

export function sellValueCents(rarity: Rarity, count: number, config = GAME_CONFIG.DUPLICATES): number {
  return config.SELL_CENTS[rarity] * Math.max(0, count);
}

/** Les reventes de communes, rares et épiques comptent dans le plafond du jour ; pas celles des cartes plus rares. */
export function countsTowardCap(rarity: Rarity, config = GAME_CONFIG.DUPLICATES): boolean {
  return !isAtLeast(rarity, config.CAP_EXEMPT_FROM);
}

/** Ajoute des centièmes au report du portefeuille : MemeMoney entière créditée, et reste conservé. */
export function creditCents(carryCents: number, gainedCents: number): { memeMoney: number; carryCents: number } {
  const total = carryCents + gainedCents;
  return { memeMoney: Math.floor(total / 100), carryCents: total % 100 };
}

export interface BulkItem {
  cardId: string;
  rarity: Rarity;
  quantity: number;
}

/**
 * « Revendre mes exemplaires en trop » : un exemplaire de chaque carte est
 * toujours gardé ; des raretés les plus courantes aux plus rares. Les
 * communes, rares et épiques s'arrêtent au plafond du jour.
 */
export function planBulkSale(
  items: BulkItem[],
  remainingCents: number,
): { lines: Array<{ cardId: string; count: number }>; cents: number; cappedCents: number } {
  const sorted = [...items].sort((a, b) => RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity));
  const lines: Array<{ cardId: string; count: number }> = [];
  let cents = 0;
  let cappedCents = 0;
  for (const item of sorted) {
    const price = GAME_CONFIG.DUPLICATES.SELL_CENTS[item.rarity];
    const capped = countsTowardCap(item.rarity);
    const affordable = capped ? Math.floor((remainingCents - cappedCents) / price) : Number.POSITIVE_INFINITY;
    const count = Math.min(duplicatesOf(item.quantity), affordable);
    if (count > 0) {
      lines.push({ cardId: item.cardId, count });
      cents += count * price;
      if (capped) cappedCents += count * price;
    }
  }
  return { lines, cents, cappedCents };
}
