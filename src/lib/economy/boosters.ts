/**
 * Boosters : composition, probabilités publiées et tirage.
 * Tout est calculé depuis GAME_CONFIG.BOOSTERS : changer la config change les
 * probabilités affichées ET le tirage, sans risque de décalage.
 */
import { GAME_CONFIG } from "@/config/game.config";
import { RARITIES, type Rarity } from "@/config/rarities";

export const BOOSTER_KINDS = ["daily", "special", "very_special"] as const;
export type BoosterKind = (typeof BOOSTER_KINDS)[number];

type BoosterConfig = (typeof GAME_CONFIG.BOOSTERS)[BoosterKind];

/** Probabilité (0 à 1) d'avoir au moins une carte de chaque rareté dans un booster. */
export function boosterOdds(kind: BoosterKind, config = GAME_CONFIG.BOOSTERS[kind]): Record<Rarity, number> {
  const g = config.godlevelChance / 100;
  const up = config.flex.upgradeChance / 100;
  const odds = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;
  for (const r of Object.keys(config.fixed) as Rarity[]) odds[r] = 1;
  // Une Godlevel remplace une commune : s'il n'y a qu'une commune, elle peut disparaître.
  if (config.fixed.commune === 1) odds.commune = 1 - g;
  odds[config.flex.usual] = Math.max(odds[config.flex.usual], 1 - up);
  odds[config.flex.upgrade] = Math.max(odds[config.flex.upgrade], up);
  odds.godlevel = Math.max(odds.godlevel, g);
  return odds;
}

/**
 * Pour la page Raretés : chance d'obtenir au moins une carte de cette rareté,
 * dans le booster le plus accessible qui peut la contenir.
 */
export function bestOddsFor(rarity: Rarity): { kind: BoosterKind; chance: number } {
  for (const kind of BOOSTER_KINDS) {
    const chance = boosterOdds(kind)[rarity];
    if (chance > 0) return { kind, chance };
  }
  return { kind: "daily", chance: 0 };
}

/** Nombre total de cartes de chaque rareté, emplacement au choix compris, pour un tirage donné. */
export function composition(config: BoosterConfig, upgraded: boolean, godlevel: boolean): Rarity[] {
  const cards: Rarity[] = [];
  for (const r of RARITIES) for (let i = 0; i < (config.fixed[r] ?? 0); i++) cards.push(r);
  cards.push(upgraded ? config.flex.upgrade : config.flex.usual);
  if (godlevel) cards[cards.indexOf("commune")] = "godlevel";
  return cards;
}

export interface DrawResult {
  /** Raretés des cartes, de la plus courante à la plus rare (ordre de révélation). */
  rarities: Rarity[];
  upgraded: boolean;
  godlevel: boolean;
  pityTriggered: boolean;
}

/**
 * Tire les raretés d'un booster. `random` renvoie un nombre dans [0, 1[ : le
 * serveur fournit un générateur cryptographique, les tests un générateur fixé.
 * `boostersWithoutUpgrade` : boosters journaliers ouverts d'affilée sans la rareté supérieure.
 */
export function drawBoosterRarities(kind: BoosterKind, random: () => number, boostersWithoutUpgrade = 0): DrawResult {
  const config = GAME_CONFIG.BOOSTERS[kind];
  const pityTriggered = kind === "daily" && boostersWithoutUpgrade + 1 >= GAME_CONFIG.PITY_THRESHOLD;
  const upgraded = pityTriggered || random() < config.flex.upgradeChance / 100;
  const godlevel = random() < config.godlevelChance / 100;
  const rarities = composition(config, upgraded, godlevel).sort((a, b) => RARITIES.indexOf(a) - RARITIES.indexOf(b));
  return { rarities, upgraded, godlevel, pityTriggered };
}
