/**
 * Exemplaires en trop : évolutions (★, ★★, ★★★, puis Divine) et
 * revente contre de la MemeMoney.
 * Fonctions pures, utilisées par le serveur (qui décide) et par l'interface
 * (qui affiche un aperçu). Les montants sont en centièmes de MemeMoney.
 */
import { GAME_CONFIG } from "@/config/game.config";
import { RARITIES, type Rarity } from "@/config/rarities";

/** Niveau d'évolution : 0 normale, 1 à 3 étoiles, 4 Divine (le maximum, « MAX »). */
export const LEVELS = [0, 1, 2, 3, 4] as const;
export type Level = (typeof LEVELS)[number];
export const MAX_LEVEL: Level = 4;

/**
 * Apparence correspondant au niveau : la carte garde la couleur de sa rareté (seules ses étoiles montrent l'évolution),
 * sauf en Divine, où elle devient argentée (son bandeau de rareté garde sa couleur).
 */
export function lookOf(level: Level): "normal" | "divine" {
  return level === MAX_LEVEL ? "divine" : "normal";
}

/** Prochain niveau et son coût en exemplaires, ou null si la carte est déjà Divine. */
export function nextUpgrade(rarity: Rarity, level: Level, config = GAME_CONFIG.DUPLICATES): { to: Level; cost: number } | null {
  if (level >= MAX_LEVEL) return null;
  return { to: (level + 1) as Level, cost: config.UPGRADES[rarity][level as 0 | 1 | 2 | 3] };
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

/** Revente d'une carte en un geste : tous ses exemplaires en trop (aucune limite quotidienne). */
export function sellAllDuplicates(rarity: Rarity, quantity: number): { count: number; cents: number } {
  const count = maxSellable(quantity);
  return { count, cents: count * GAME_CONFIG.DUPLICATES.SELL_CENTS[rarity] };
}

export function sellValueCents(rarity: Rarity, count: number, config = GAME_CONFIG.DUPLICATES): number {
  return config.SELL_CENTS[rarity] * Math.max(0, count);
}

/** Ajoute des centièmes au report du portefeuille : MemeMoney entière créditée, et reste conservé. */
export function creditCents(carryCents: number, gainedCents: number): { memeMoney: number; carryCents: number } {
  const total = carryCents + gainedCents;
  return { memeMoney: Math.floor(total / 100), carryCents: total % 100 };
}

export interface UpgradeItem {
  cardId: string;
  rarity: Rarity;
  quantity: number;
  level: Level;
}

/**
 * « Tout faire évoluer » : chaque carte monte, dans l'ordre, d'autant d'évolutions que ses exemplaires en trop le
 * permettent (le premier exemplaire reste toujours). `used` : exemplaires utilisés ; `evolutions` : évolutions faites.
 */
export function planBulkUpgrade(
  items: UpgradeItem[],
  config = GAME_CONFIG.DUPLICATES,
): { lines: Array<{ cardId: string; from: Level; to: Level; used: number }>; evolutions: number; used: number } {
  const lines: Array<{ cardId: string; from: Level; to: Level; used: number }> = [];
  let evolutions = 0;
  let used = 0;
  for (const item of items) {
    let level = item.level;
    let left = duplicatesOf(item.quantity);
    let spent = 0;
    for (let next = nextUpgrade(item.rarity, level, config); next && left >= next.cost; next = nextUpgrade(item.rarity, level, config)) {
      left -= next.cost;
      spent += next.cost;
      level = next.to;
    }
    if (level === item.level) continue;
    lines.push({ cardId: item.cardId, from: item.level, to: level, used: spent });
    evolutions += level - item.level;
    used += spent;
  }
  return { lines, evolutions, used };
}

export interface BulkItem {
  cardId: string;
  rarity: Rarity;
  quantity: number;
}

/**
 * « Revendre mes exemplaires en trop » : un exemplaire de chaque carte est
 * toujours gardé ; des raretés les plus courantes aux plus rares, sans aucune
 * limite quotidienne.
 */
export function planBulkSale(items: BulkItem[]): { lines: Array<{ cardId: string; count: number }>; cents: number } {
  const sorted = [...items].sort((a, b) => RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity));
  const lines: Array<{ cardId: string; count: number }> = [];
  let cents = 0;
  for (const item of sorted) {
    const count = duplicatesOf(item.quantity);
    if (count > 0) {
      lines.push({ cardId: item.cardId, count });
      cents += count * GAME_CONFIG.DUPLICATES.SELL_CENTS[item.rarity];
    }
  }
  return { lines, cents };
}
