/**
 * Une carte devient un personnage du battle royale (conception validée, §6).
 *
 * 1. Compression : chaque statistique est rapprochée de la commune moyenne
 *    (stat = référence + κ × (stat − référence)) ; l'écart entre raretés est borné.
 * 2. Évolution : le bonus de la carte (★ +3 %, ★★ +6 %, ★★★ +10 %) s'applique à moitié.
 * 3. Formules (entiers) :
 *    - PV : 100 + (PV − 60) × 5/4 ; zone de touche (inconvénient) : 14 + (PV − 60)/10 unités ;
 *    - DÉF → armure : dégâts reçus × 200 / (200 + DÉF) ;
 *    - VIT → vitesse : 200 + 2 × VIT unités par seconde ;
 *    - ATQ → dégâts des armes : 90 + (ATQ − 20) × 20/45 %.
 * 4. L'attaque spéciale devient une capacité active avec recharge ; la défense devient un passif.
 */
import type { GameConfig } from "@/config/game.config";
import type { Card } from "@/lib/validation/card";
import { clamp, idiv } from "./fixed";

export type BrConfig = GameConfig["BATTLE_ROYALE"];
export type CharacterCard = Pick<Card, "hp" | "atk" | "def" | "spd" | "specialAttack" | "defenseAbility">;
export type EvolutionLevel = 0 | 1 | 2 | 3 | 4;

export const ABILITY_KINDS = ["sprint", "stun", "drain", "multi", "burn", "pierce", "buff", "debuff"] as const;
export type AbilityKind = (typeof ABILITY_KINDS)[number];
export const PASSIVE_KINDS = ["regen", "dodge", "reflect", "cleanse", "recharge"] as const;
export type PassiveKind = (typeof PASSIVE_KINDS)[number];
export const BOOST_STATS = ["atk", "def", "spd"] as const;
export type BoostStat = (typeof BOOST_STATS)[number];
/** Boost/affaiblissement visant toutes les statistiques à la fois (encodé après les stats dans le moteur). */
export const ALL_STATS = BOOST_STATS.length;

export interface BattleAbility {
  kind: AbilityKind;
  cooldownMs: number;
  /** Durée de l'effet sur soi (sprint, vol de vie, perce-armure, boost) ou délai pour toucher (étourdissement, affaiblissement), en ms. */
  durationMs: number;
  /**
   * Intensité en ‰ : bonus de vitesse (sprint), part des dégâts rendue en PV (vol de vie), dégâts de chaque balle
   * de la rafale, PV max brûlés par seconde, armure ignorée, hausse (boost) ou baisse (affaiblissement) de la statistique.
   */
  permille: number;
  /** Durée de l'effet sur la cible touchée (étourdissement, brûlure, affaiblissement), en ms. */
  effectMs: number;
  /** Rafale : nombre de balles. */
  hits: number;
  /** Boost ou affaiblissement : statistique visée, « all » pour toutes les statistiques, ou aucune. */
  stat: BoostStat | "all" | null;
}

export interface BattlePassive {
  kind: PassiveKind;
  /**
   * En ‰ : PV max rendus par seconde (régénération), chance d'esquiver une balle, part des dégâts renvoyée,
   * part de la durée des effets négatifs retirée (immunité), part de la recharge retirée (recharge).
   */
  permille: number;
}

export interface BattleCharacter {
  /** Statistiques après compression et évolution. */
  stats: { hp: number; atk: number; def: number; spd: number };
  maxHp: number;
  /** Rayon de la zone de touche, en unités. */
  hitRadius: number;
  /** Dégâts reçus en % (effet de l'armure), pour l'affichage ; le moteur calcule avec stats.def. */
  damageTakenPercent: number;
  /** Vitesse de déplacement, en unités par seconde. */
  speed: number;
  /** Multiplicateur des dégâts des armes, en %. */
  weaponPercent: number;
  ability: BattleAbility;
  passive: BattlePassive;
}

/** PV, armure, vitesse et dégâts à partir des statistiques (après compression et évolution). */
export function maxHpFor(hp: number): number {
  return 100 + idiv((hp - 60) * 5, 4);
}
export function hitRadiusFor(hp: number): number {
  return 14 + idiv(hp - 60, 10);
}
/** Vitesse en unités par seconde : 130 + 1,3 × VIT (143 à 260 ; réduite de 35 % le 2026-10-26, choix du propriétaire). */
export function speedFor(spd: number): number {
  return 130 + idiv(13 * spd, 10);
}
export function weaponPercentFor(atk: number): number {
  return 90 + idiv((atk - 20) * 20, 45);
}
/** Dégâts reçus × 200 / (200 + DÉF) : le multiplicateur en ‰. */
export function damageTakenPermille(def: number): number {
  return idiv(200_000, 200 + def);
}

/**
 * Dégâts d'une balle, pour l'affichage (pages d'Infos, fiche personnage) : au départ (arme × ATQ),
 * puis à l'arrivée sur une cible (armure). Mêmes formules que le moteur, sans boost ni affaiblissement.
 */
export function bulletDamage(weaponDamage: number, weaponPercent: number, targetDef: number): { shot: number; hit: number } {
  const shot = Math.max(1, idiv(weaponDamage * weaponPercent * 1000, 100_000));
  return { shot, hit: Math.max(1, idiv(shot * 200, 200 + targetDef)) };
}

function compress(stat: number, reference: number, kappa: number): number {
  return reference + idiv((stat - reference) * kappa, 100);
}

function evolve(stat: number, bonusPercent: number, factorPercent: number): number {
  return stat + idiv(stat * bonusPercent * factorPercent, 10_000);
}

/**
 * Personnage de bataille d'une carte, à un niveau d'évolution donné.
 * `statBonus` : GAME_CONFIG.DUPLICATES.STAT_BONUS_PERCENT (normale 0, ★ +3, ★★ +6, ★★★ +8, Divine +10 %).
 */
export function battleCharacter(card: CharacterCard, level: EvolutionLevel, br: BrConfig, statBonus: readonly number[]): BattleCharacter {
  const { REFERENCE, COMPRESSION_PERCENT: kappa, EVOLUTION_FACTOR_PERCENT: factor } = br.CHARACTER;
  const bonus = statBonus[level] ?? 0;
  const stat = (value: number, ref: number, lo: number, hi: number) => clamp(evolve(compress(value, ref, kappa), bonus, factor), lo, hi);
  const stats = {
    hp: stat(card.hp, REFERENCE.hp, 60, 140),
    atk: stat(card.atk, REFERENCE.atk, 20, 65),
    def: stat(card.def, REFERENCE.def, 20, 65),
    spd: stat(card.spd, REFERENCE.spd, 10, 100),
  };
  const passive = passiveOf(card.defenseAbility.effect, br, kappa);
  return {
    stats,
    maxHp: maxHpFor(stats.hp),
    hitRadius: hitRadiusFor(stats.hp),
    damageTakenPercent: idiv(damageTakenPermille(stats.def), 10),
    speed: speedFor(stats.spd),
    weaponPercent: weaponPercentFor(stats.atk),
    ability: abilityOf(card.specialAttack, passive, br, kappa),
    passive,
  };
}

function abilityOf(special: CharacterCard["specialAttack"], passive: BattlePassive, br: BrConfig, kappa: number): BattleAbility {
  const A = br.ABILITY;
  // La puissance est comprimée comme les statistiques : une capacité de godlevel ne vaut guère plus que celle d'une commune.
  const intensity = idiv(compress(special.power, br.CHARACTER.REFERENCE.power, kappa) * 1000, A.POWER_REFERENCE);
  const scaled = (permille: number) => idiv(permille * intensity, 1000);
  let cooldownMs = A.COOLDOWN_BASE_MS + A.COOLDOWN_PER_ENERGY_MS * special.energyCost;
  if (passive.kind === "recharge") cooldownMs = idiv(cooldownMs * (1000 - passive.permille), 1000);
  const base: Omit<BattleAbility, "kind"> = { cooldownMs, durationMs: 0, permille: 0, effectMs: 0, hits: 0, stat: null };
  const e = special.effect;
  // Durée réglée par l'admin (en secondes), sinon la valeur par défaut fournie (en ms). L'intensité (permille)
  // reste comprimée par la puissance (κ) ; la durée est prise telle quelle (ce que l'admin a choisi).
  const durMs = (fallback: number) => (e as { seconds?: number }).seconds != null ? (e as { seconds: number }).seconds * 1000 : fallback;
  // Boost/affaiblissement : une stat précise, ou « toutes » (par défaut une stat si rien n'est précisé).
  const boostStat = (x: { stat?: BoostStat; all?: boolean }): BoostStat | "all" => (x.all ? "all" : (x.stat ?? "atk"));
  switch (e.kind) {
    case "none":
      return { ...base, kind: "sprint", durationMs: durMs(A.SPRINT_MS), permille: scaled((e.percent ?? A.SPRINT_PERCENT) * 10) };
    case "stun":
      // Durée de l'étourdissement : secondes réglées (brutes), sinon dérivée de la chance (comprimée, hérité).
      return { ...base, kind: "stun", durationMs: A.ARMED_MS, effectMs: e.seconds != null ? e.seconds * 1000 : scaled(A.STUN_BASE_MS + e.chance * A.STUN_MS_PER_CHANCE) };
    case "drain":
      return { ...base, kind: "drain", durationMs: durMs(A.DRAIN_MS), permille: scaled(e.percent * 10) };
    case "multi":
      return { ...base, kind: "multi", hits: e.hits, permille: scaled(e.percent * 10) };
    case "dot":
      // Brûlure : durée en secondes réglées, sinon en tours (hérité, défaut 2 tours).
      return { ...base, kind: "burn", permille: scaled(e.percent * 10), effectMs: e.seconds != null ? e.seconds * 1000 : (e.turns ?? 2) * 1000 };
    case "pierce":
      return { ...base, kind: "pierce", durationMs: durMs(A.PIERCE_MS), permille: Math.min(1000, scaled(e.percent * 10)) };
    case "buff":
      return { ...base, kind: "buff", stat: boostStat(e), durationMs: durMs(A.BUFF_MS), permille: scaled((e.percent ?? A.BUFF_PERCENT) * 10) };
    case "debuff":
      return { ...base, kind: "debuff", stat: boostStat(e), durationMs: A.ARMED_MS, effectMs: durMs(A.DEBUFF_MS), permille: Math.min(900, scaled((e.percent ?? A.DEBUFF_PERCENT) * 10)) };
  }
}

/** Passif ; son intensité (soin, esquive, renvoi) est comprimée vers celle des communes, comme les statistiques. */
function passiveOf(effect: CharacterCard["defenseAbility"]["effect"], br: BrConfig, kappa: number): BattlePassive {
  const P = br.PASSIVE;
  const R = br.CHARACTER.REFERENCE;
  switch (effect.kind) {
    case "heal":
      // percent / 10 % des PV max par seconde = percent ‰.
      return { kind: "regen", permille: compress(effect.percent, R.heal, kappa) };
    case "dodge":
      return { kind: "dodge", permille: idiv(compress(effect.chance, R.dodge, kappa) * 10, P.DODGE_DIVISOR) };
    case "reflect":
      return { kind: "reflect", permille: idiv(compress(effect.percent, R.reflect, kappa) * 10, P.REFLECT_DIVISOR) };
    case "cleanse":
      return { kind: "cleanse", permille: P.CLEANSE_PERCENT * 10 };
    case "recharge":
      return { kind: "recharge", permille: P.RECHARGE_PERCENT * 10 };
  }
}
