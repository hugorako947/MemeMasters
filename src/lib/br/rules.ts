/**
 * Règles du moteur, tirées de GAME_CONFIG.BATTLE_ROYALE et converties une fois pour
 * toutes en ticks (durées) et en sous-unités (distances, vitesses) : le moteur ne
 * manipule ensuite que des entiers. 1 unité = 16 sous-unités.
 */
import { BR_WEAPONS } from "@/config/game.config";
import type { BattleCharacter, BrConfig } from "./character";
import { ABILITY_KINDS, BOOST_STATS, PASSIVE_KINDS } from "./character";
import { idiv } from "./fixed";

/** Sous-unités par unité de carte. */
export const SUB = 16;
/** Munitions : 0 = aucune (réserve illimitée), puis légères, cartouches, lourdes. */
export const AMMO_KINDS = ["none", "light", "shell", "heavy"] as const;
/** Arme spéciale « projectile de brûlure » (capacité), après les 4 armes. */
export const BURN_SHOT = BR_WEAPONS.length;

export interface WeaponRule {
  damage: number;
  pellets: number;
  fireTicks: number;
  magazine: number;
  reloadTicks: number;
  spread: number;
  /** Sous-unités parcourues par tick, et portée en sous-unités. */
  speed: number;
  range: number;
  /** Indice dans AMMO_KINDS. */
  ammo: number;
}

export interface ZonePhaseRule {
  waitTicks: number;
  shrinkTicks: number;
  radiusPercent: number;
  dps: number;
}

export interface Rules {
  configVersion: number;
  participants: number;
  tickRate: number;
  maxTicks: number;
  map: {
    tiles: number;
    tileSub: number;
    sizeSub: number;
    border: number;
    lakes: readonly [number, number];
    lakeRadius: readonly [number, number];
    buildings: readonly [number, number];
    buildingSize: readonly [number, number];
    crates: number;
    bushClusters: number;
    bushClusterSize: readonly [number, number];
  };
  view: { halfWidth: number; halfHeight: number; bushReveal: number };
  aimTurn: number;
  aimAssist: number;
  switchTicks: number;
  zone: ZonePhaseRule[];
  weapons: WeaponRule[];
  startWeapon: number;
  multiSpread: number;
  regenDelayTicks: number;
  items: {
    healHp: number;
    healTicks: number;
    healsMax: number;
    healSlowPercent: number;
    vestShield: number;
    /** Indexés comme AMMO_KINDS (la case 0 est inutilisée). */
    ammoMax: number[];
    ammoBox: number[];
    pickupRange: number;
  };
  loot: {
    perParticipant: number;
    inBuildingsPercent: number;
    /** Arme, munitions, soin, gilet. */
    weights: number[];
    /** Poids des armes ramassables, indexés comme BR_WEAPONS (l'arme de départ à 0). */
    weaponWeights: number[];
  };
}

/** Millisecondes → ticks, arrondi au plus proche (au moins 1 tick pour une durée non nulle). */
export function msToTicks(ms: number, tickRate: number): number {
  if (ms <= 0) return 0;
  return Math.max(1, idiv(ms * tickRate + 500, 1000));
}

/** Unités par seconde → sous-unités par tick. */
export function speedPerTick(unitsPerSecond: number, tickRate: number): number {
  return idiv(unitsPerSecond * SUB, tickRate);
}

export function resolveRules(br: BrConfig): Rules {
  const rate = br.TICK_RATE;
  const ticks = (ms: number) => msToTicks(ms, rate);
  const tileSub = br.MAP.TILE_UNITS * SUB;
  const weaponRule = (w: BrConfig["WEAPONS"]["pop"]): WeaponRule => ({
    damage: w.damage,
    pellets: w.pellets,
    fireTicks: ticks(w.fireIntervalMs),
    magazine: w.magazine,
    reloadTicks: ticks(w.reloadMs),
    spread: w.spreadSteps,
    speed: speedPerTick(w.speed, rate),
    range: w.range * SUB,
    ammo: AMMO_KINDS.indexOf(w.ammo),
  });
  const A = br.ABILITY;
  const I = br.ITEMS;
  return {
    configVersion: br.CONFIG_VERSION,
    participants: br.PARTICIPANTS,
    tickRate: rate,
    maxTicks: br.MAX_DURATION_S * rate,
    map: {
      tiles: br.MAP.TILES,
      tileSub,
      sizeSub: br.MAP.TILES * tileSub,
      border: br.MAP.BORDER_TILES,
      lakes: br.MAP.LAKES,
      lakeRadius: br.MAP.LAKE_RADIUS_TILES,
      buildings: br.MAP.BUILDINGS,
      buildingSize: br.MAP.BUILDING_SIZE_TILES,
      crates: br.MAP.CRATES,
      bushClusters: br.MAP.BUSH_CLUSTERS,
      bushClusterSize: br.MAP.BUSH_CLUSTER_SIZE,
    },
    view: { halfWidth: br.VIEW.HALF_WIDTH * SUB, halfHeight: br.VIEW.HALF_HEIGHT * SUB, bushReveal: br.VIEW.BUSH_REVEAL * SUB },
    aimTurn: br.CONTROLS.AIM_TURN_PER_TICK,
    aimAssist: br.CONTROLS.AIM_ASSIST_STEPS,
    switchTicks: msToTicks(br.CONTROLS.WEAPON_SWITCH_MS, rate),
    zone: br.ZONE.PHASES.map((p) => ({ waitTicks: p.waitS * rate, shrinkTicks: p.shrinkS * rate, radiusPercent: p.radiusPercent, dps: p.dps })),
    weapons: [
      ...BR_WEAPONS.map((id) => weaponRule(br.WEAPONS[id])),
      // Projectile de brûlure : un seul, sans dispersion, porté par la capacité.
      { damage: A.BURN_SHOT_DAMAGE, pellets: 1, fireTicks: 1, magazine: 1, reloadTicks: 1, spread: 0, speed: speedPerTick(A.BURN_SHOT_SPEED, rate), range: A.BURN_SHOT_RANGE * SUB, ammo: 0 },
    ],
    startWeapon: BR_WEAPONS.indexOf(br.STARTING_WEAPON),
    multiSpread: A.MULTI_SPREAD_STEPS,
    regenDelayTicks: ticks(br.PASSIVE.REGEN_DELAY_MS),
    items: {
      healHp: I.HEAL_HP,
      healTicks: ticks(I.HEAL_MS),
      healsMax: I.HEALS_MAX,
      healSlowPercent: I.HEAL_SLOW_PERCENT,
      vestShield: I.VEST_SHIELD,
      ammoMax: [0, I.AMMO_MAX.light, I.AMMO_MAX.shell, I.AMMO_MAX.heavy],
      ammoBox: [0, I.AMMO_BOX.light, I.AMMO_BOX.shell, I.AMMO_BOX.heavy],
      pickupRange: I.PICKUP_RANGE * SUB,
    },
    loot: {
      perParticipant: br.LOOT.PER_PARTICIPANT,
      inBuildingsPercent: br.LOOT.IN_BUILDINGS_PERCENT,
      weights: [br.LOOT.WEIGHTS.weapon, br.LOOT.WEIGHTS.ammo, br.LOOT.WEIGHTS.heal, br.LOOT.WEIGHTS.vest],
      weaponWeights: BR_WEAPONS.map((id) => (id === br.STARTING_WEAPON ? 0 : (br.LOOT.WEAPON_WEIGHTS as Record<string, number>)[id] ?? 0)),
    },
  };
}

/** Constantes d'un participant pour le moteur (entiers, ticks, sous-unités), tirées de son personnage. */
export interface Fighter {
  maxHp: number;
  radius: number;
  /** Vitesse de base, en sous-unités par tick. */
  speed: number;
  weaponPercent: number;
  def: number;
  /** Indice dans ABILITY_KINDS / PASSIVE_KINDS / BOOST_STATS (−1 : aucune statistique). */
  ability: number;
  abilityCooldown: number;
  abilityDuration: number;
  abilityPermille: number;
  abilityEffectTicks: number;
  abilityHits: number;
  abilityStat: number;
  passive: number;
  passivePermille: number;
}

export function fighterFor(c: BattleCharacter, rules: Rules): Fighter {
  const ticks = (ms: number) => msToTicks(ms, rules.tickRate);
  return {
    maxHp: c.maxHp,
    radius: c.hitRadius * SUB,
    speed: speedPerTick(c.speed, rules.tickRate),
    weaponPercent: c.weaponPercent,
    def: c.stats.def,
    ability: ABILITY_KINDS.indexOf(c.ability.kind),
    abilityCooldown: ticks(c.ability.cooldownMs),
    abilityDuration: ticks(c.ability.durationMs),
    abilityPermille: c.ability.permille,
    abilityEffectTicks: ticks(c.ability.effectMs),
    abilityHits: c.ability.hits,
    abilityStat: c.ability.stat ? BOOST_STATS.indexOf(c.ability.stat) : -1,
    passive: PASSIVE_KINDS.indexOf(c.passive.kind),
    passivePermille: c.passive.permille,
  };
}
