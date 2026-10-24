/**
 * Récompenses d'une partie classée du battle royale, selon la place finale
 * (conception validée, §8). Logique pure : le serveur l'appliquera après avoir
 * rejoué et vérifié la partie (phase 4) ; les pages d'Infos l'utilisent pour
 * afficher les tableaux.
 *
 * - Trophées par tranche de place (en % du nombre de participants), bonus par
 *   élimination (plafonné, seulement dans la première moitié du classement).
 * - Selon le rang du joueur : gains réduits et pertes augmentées, pour que chacun
 *   se stabilise près de son vrai niveau. Jamais sous 0 trophée.
 * - MemeMoney par tranche de place, avec un plafond quotidien.
 * - Abandon : élimination à la place du moment, pénalité de trophées, aucune MemeMoney.
 */
import type { GameConfig } from "@/config/game.config";
import { rankIndex } from "@/config/ranks";

export type BattleEconomy = GameConfig["BATTLE_ROYALE"]["ECONOMY"];

export interface PlacementInput {
  /** Place finale : 1 = vainqueur. */
  place: number;
  participants: number;
  kills: number;
  /** Trophées du joueur avant la partie (le rang en dépend). */
  trophies: number;
  /** MemeMoney déjà gagnée en bataille aujourd'hui (plafond quotidien). */
  memeMoneyEarnedToday?: number;
}

export interface BattleReward {
  /** Variation réellement appliquée (le total ne descend jamais sous 0). */
  trophyDelta: number;
  trophiesAfter: number;
  memeMoney: number;
}

/** Place ramenée sur une échelle de 100 participants ; la 1re place reste la 1re. */
export function scaledPlace(place: number, participants: number): number {
  if (place <= 1) return 1;
  return Math.min(100, Math.max(2, Math.ceil((place * 100) / participants)));
}

function bandValue(bands: BattleEconomy["TROPHIES_BY_PLACE"], scaled: number): number {
  for (const [maxPlace, value] of bands) if (scaled <= maxPlace) return value;
  return 0;
}

/** Arrondi au plus proche de v × percent / 100, sur la valeur absolue (les demis vont vers l'extérieur). */
function scaleRounded(v: number, percent: number): number {
  const magnitude = Math.floor((Math.abs(v) * percent + 50) / 100);
  return v < 0 ? -magnitude : magnitude;
}

/** Trophées gagnés ou perdus pour une place, avant le plancher à 0. */
export function trophiesForPlace(input: PlacementInput, eco: BattleEconomy): { base: number; killBonus: number; rank: number; delta: number } {
  const scaled = scaledPlace(input.place, input.participants);
  const base = bandValue(eco.TROPHIES_BY_PLACE, scaled);
  const killBonus = scaled <= eco.KILL_BONUS_MAX_PLACE_PERCENT ? Math.min(eco.KILL_TROPHY_CAP, input.kills * eco.KILL_TROPHY) : 0;
  const rank = rankIndex(input.trophies);
  const raw = base + killBonus;
  const delta = raw >= 0 ? scaleRounded(raw, 100 - eco.RANK_GAIN_REDUCTION_PERCENT * rank) : scaleRounded(raw, 100 + eco.RANK_LOSS_INCREASE_PERCENT * rank);
  return { base, killBonus, rank, delta };
}

/** MemeMoney pour une place (avant plafond quotidien). */
export function memeMoneyForPlace(place: number, participants: number, eco: BattleEconomy): number {
  return bandValue(eco.MEME_MONEY_BY_PLACE, scaledPlace(place, participants));
}

function finish(trophies: number, delta: number, memeMoney: number): BattleReward {
  const trophiesAfter = Math.max(0, trophies + delta);
  return { trophyDelta: trophiesAfter - trophies, trophiesAfter, memeMoney };
}

/** Récompense d'une partie classée terminée normalement. */
export function battleReward(input: PlacementInput, eco: BattleEconomy): BattleReward {
  const { delta } = trophiesForPlace(input, eco);
  const room = Math.max(0, eco.MEME_MONEY_DAILY_CAP - (input.memeMoneyEarnedToday ?? 0));
  return finish(input.trophies, delta, Math.min(room, memeMoneyForPlace(input.place, input.participants, eco)));
}

/** Partie abandonnée (bouton Quitter, onglet fermé, plus de nouvelles du joueur). */
export function abandonReward(input: PlacementInput, eco: BattleEconomy): BattleReward {
  const { delta } = trophiesForPlace(input, eco);
  return finish(input.trophies, delta - eco.ABANDON_TROPHY_PENALTY, 0);
}
