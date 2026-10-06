/**
 * Les 8 raretés, de la plus commune à la plus rare.
 * L'ordre de ce tableau est la référence pour tous les tris et comparaisons ;
 * il doit rester identique à l'enum SQL `public.rarity`.
 */
export const RARITIES = [
  "commune",
  "rare",
  "epique",
  "mystique",
  "legendaire",
  "omniversal",
  "superbrainrot",
  "godlevel",
] as const;

export type Rarity = (typeof RARITIES)[number];

/** Rang de 0 (commune) à 7 (godlevel). */
export function rarityTier(rarity: Rarity): number {
  return RARITIES.indexOf(rarity);
}

/** Vrai si `rarity` est au moins aussi rare que `min`. */
export function isAtLeast(rarity: Rarity, min: Rarity): boolean {
  return rarityTier(rarity) >= rarityTier(min);
}

export function isRarity(value: unknown): value is Rarity {
  return typeof value === "string" && (RARITIES as readonly string[]).includes(value);
}

/**
 * Symbole affiché à côté du nom de la rareté : la rareté n'est jamais
 * portée par la seule couleur (accessibilité).
 */
export const RARITY_GLYPH: Record<Rarity, string> = {
  commune: "●",
  rare: "◆",
  epique: "▲",
  mystique: "✦",
  legendaire: "★",
  omniversal: "✺",
  superbrainrot: "⌘",
  godlevel: "♛",
};
