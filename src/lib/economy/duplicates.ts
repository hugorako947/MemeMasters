/**
 * Doublons : améliorations (Dorée, Divine) et revente contre de la MemeMoney.
 * Fonctions pures, utilisées par le serveur (qui décide) et par l'interface
 * (qui affiche un aperçu). Les montants sont en centièmes de MemeMoney.
 */
import { GAME_CONFIG } from "@/config/game.config";
import { isAtLeast, RARITIES, type Rarity } from "@/config/rarities";

export const VARIANTS = ["normal", "gold", "divine"] as const;
export type Variant = (typeof VARIANTS)[number];

/** Prochaine amélioration possible et son coût en doublons, ou null si la carte est déjà Divine. */
export function nextUpgrade(variant: Variant, config = GAME_CONFIG.DUPLICATES): { to: Variant; cost: number } | null {
  if (variant === "normal") return { to: "gold", cost: config.UPGRADES.gold };
  if (variant === "gold") return { to: "divine", cost: config.UPGRADES.divine };
  return null;
}

/** Doublons = exemplaires au-delà du premier. */
export function duplicatesOf(quantity: number): number {
  return Math.max(0, quantity - 1);
}

export function canUpgrade(quantity: number, variant: Variant): boolean {
  const next = nextUpgrade(variant);
  return next !== null && duplicatesOf(quantity) >= next.cost;
}

/**
 * Nombre maximum d'exemplaires revendables : tous, jusqu'au dernier, quelle
 * que soit la rareté. Seule exception : une carte Dorée ou Divine garde
 * toujours son dernier exemplaire (sinon son amélioration serait perdue).
 */
export function maxSellable(quantity: number, variant: Variant): number {
  if (quantity <= 0) return 0;
  return variant === "normal" ? quantity : duplicatesOf(quantity);
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
  variant: Variant;
}

/**
 * « Revendre tous mes doublons » : uniquement des doublons (un exemplaire est
 * toujours gardé), des raretés les plus courantes aux plus rares. Les
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
