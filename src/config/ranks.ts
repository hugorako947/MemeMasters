/**
 * Les 10 rangs, dans l'ordre. On monte d'un rang tous les
 * GAME_CONFIG.TROPHIES.PER_RANK trophées (1 000 par défaut) ; Immortel n'a
 * pas de plafond. Atteindre un rang pour la première fois rapporte une
 * récompense, de plus en plus généreuse.
 */
import { GAME_CONFIG } from "./game.config";

export const RANKS = [
  "bronze",
  "argent",
  "fer",
  "or",
  "platine",
  "diamant",
  "maitre",
  "grand_maitre",
  "super_grand_maitre",
  "immortel",
] as const;

export type Rank = (typeof RANKS)[number];

export interface RankReward {
  boosters: number;
  memeMoney: number;
}

/** Récompense pour la première fois qu'un rang est atteint (bronze : rang de départ). */
export const RANK_REWARDS: Record<Rank, RankReward> = {
  bronze: { boosters: 0, memeMoney: 0 },
  argent: { boosters: 3, memeMoney: 10 },
  fer: { boosters: 3, memeMoney: 15 },
  or: { boosters: 4, memeMoney: 20 },
  platine: { boosters: 4, memeMoney: 30 },
  diamant: { boosters: 5, memeMoney: 40 },
  maitre: { boosters: 5, memeMoney: 60 },
  grand_maitre: { boosters: 6, memeMoney: 80 },
  super_grand_maitre: { boosters: 7, memeMoney: 100 },
  immortel: { boosters: 10, memeMoney: 150 },
};

/** Couleurs des insignes de rang (écusson). */
export const RANK_COLORS: Record<Rank, { fill: string; ink: string }> = {
  bronze: { fill: "#cd7f32", ink: "#3b1f08" },
  argent: { fill: "#c9ced8", ink: "#1a1238" },
  fer: { fill: "#6b7280", ink: "#ffffff" },
  or: { fill: "#f5b400", ink: "#1a1238" },
  platine: { fill: "#7fd6d0", ink: "#1a1238" },
  diamant: { fill: "#5fb8ff", ink: "#1a1238" },
  maitre: { fill: "#8b3dff", ink: "#ffffff" },
  grand_maitre: { fill: "#ff3d7f", ink: "#ffffff" },
  super_grand_maitre: { fill: "#ff5a36", ink: "#ffffff" },
  immortel: { fill: "#1a1238", ink: "#ffd23f" },
};

const PER_RANK = GAME_CONFIG.TROPHIES.PER_RANK;

/** Indice du rang (0 = bronze … 9 = immortel) pour un nombre de trophées. */
export function rankIndex(trophies: number): number {
  return Math.min(RANKS.length - 1, Math.max(0, Math.floor(trophies / PER_RANK)));
}

export function rankFor(trophies: number): Rank {
  return RANKS[rankIndex(trophies)];
}

/** Progression vers le rang suivant (null au rang maximal). */
export function progressToNextRank(trophies: number): { current: number; needed: number; next: Rank } | null {
  const index = rankIndex(trophies);
  if (index === RANKS.length - 1) return null;
  return { current: trophies - index * PER_RANK, needed: PER_RANK, next: RANKS[index + 1] };
}

export type BattleResult = "win" | "loss" | "draw";

/** Nouveau total de trophées après une bataille classée (jamais sous 0). */
export function applyBattleResult(trophies: number, result: BattleResult): number {
  const { WIN, LOSS, DRAW } = GAME_CONFIG.TROPHIES;
  const delta = result === "win" ? WIN : result === "loss" ? -LOSS : DRAW;
  return Math.max(0, trophies + delta);
}

/**
 * Récompenses dues en atteignant `newTrophies`, sachant que le joueur avait
 * déjà atteint le rang `highestRank`. Chaque rang ne récompense qu'une fois.
 */
export function newRankRewards(highestRank: number, newTrophies: number): { ranks: Rank[]; total: RankReward } {
  const reached = rankIndex(newTrophies);
  const ranks = RANKS.slice(highestRank + 1, reached + 1);
  const total = ranks.reduce(
    (acc, r) => ({ boosters: acc.boosters + RANK_REWARDS[r].boosters, memeMoney: acc.memeMoney + RANK_REWARDS[r].memeMoney }),
    { boosters: 0, memeMoney: 0 },
  );
  return { ranks: [...ranks], total };
}
