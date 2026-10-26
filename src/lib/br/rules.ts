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
/** Couteau de combat : toujours porté, troisième arme en main (après le projectile de brûlure dans rules.weapons). */
export const KNIFE = BR_WEAPONS.length + 1;

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
  /** Armes à feu (indices de BR_WEAPONS), projectile de brûlure (BURN_SHOT), couteau (KNIFE : pas de projectile ni de munitions, `range` depuis le bord du personnage). */
  weapons: WeaponRule[];
  startWeapon: number;
  /** Couteau : demi-ouverture de l'arc frappé, en pas d'angle. */
  knifeArc: number;
  /** Caisses : résistance ; poids du butin (soin, munitions, gilet, arme, boisson, lunette) ; lunettes ; boisson énergisante. */
  crate: { hp: number; lootWeights: number[]; scopes: Array<{ zoom: number; weight: number }>; boostPermille: number; boostTicks: number };
  multiSpread: number;
  regenDelayTicks: number;
  /** La régénération s'arrête à ce pourcentage des PV max. */
  regenCapPercent: number;
  items: {
    healHp: number;
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
  bots: BotRules;
}

/** Réglages des bots. Les paires [niveau 0, niveau maximal] sont interpolées selon le niveau du bot (en dixièmes). */
export interface BotRules {
  thinkTicks: number;
  /** Rayon de l'ouïe, en sous-unités. */
  hearing: number;
  memoryTicks: number;
  pathMaxNodes: number;
  pathsPerTick: number;
  stuckTicks: number;
  /** Distance minimale à parcourir pendant stuckTicks, en sous-unités. */
  stuckDistance: number;
  trophiesPerLevel: number;
  /** Niveau maximal, en dixièmes de niveau. */
  maxLevel: number;
  reactionMs: readonly [number, number];
  aimError: readonly [number, number];
  leadPermille: readonly [number, number];
  noise: readonly [number, number];
  strafePermille: readonly [number, number];
  /** Variation du niveau de chaque bot, en dixièmes (±). */
  levelSpread: number;
  /** Statistiques de référence (commune moyenne) : la personnalité d'un bot se lit par rapport à elles. */
  reference: { hp: number; atk: number; def: number; spd: number };
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
  const B = br.BOTS;
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
      // Couteau : un coup au corps à corps à chaque intervalle, sans projectile ni munitions.
      { damage: br.KNIFE.DAMAGE, pellets: 0, fireTicks: ticks(br.KNIFE.INTERVAL_MS), magazine: 0, reloadTicks: 0, spread: 0, speed: 0, range: br.KNIFE.RANGE * SUB, ammo: 0 },
    ],
    startWeapon: BR_WEAPONS.indexOf(br.STARTING_WEAPON),
    knifeArc: br.KNIFE.ARC_STEPS,
    crate: {
      hp: br.CRATE.HP,
      lootWeights: [br.CRATE.LOOT_WEIGHTS.heal, br.CRATE.LOOT_WEIGHTS.ammo, br.CRATE.LOOT_WEIGHTS.vest, br.CRATE.LOOT_WEIGHTS.weapon, br.CRATE.LOOT_WEIGHTS.speed, br.CRATE.LOOT_WEIGHTS.scope],
      scopes: br.CRATE.SCOPES.map((c) => ({ zoom: c.zoom, weight: c.weight })),
      boostPermille: br.CRATE.SPEED_BOOST_PERCENT * 10,
      boostTicks: ticks(br.CRATE.SPEED_BOOST_MS),
    },
    multiSpread: A.MULTI_SPREAD_STEPS,
    regenDelayTicks: ticks(br.PASSIVE.REGEN_DELAY_MS),
    regenCapPercent: br.PASSIVE.REGEN_CAP_PERCENT,
    items: {
      healHp: I.HEAL_HP,
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
    bots: {
      thinkTicks: Math.max(1, idiv(rate, B.THINK_PER_SECOND)),
      hearing: B.HEARING_RANGE * SUB,
      memoryTicks: ticks(B.MEMORY_MS),
      pathMaxNodes: B.PATH_MAX_NODES,
      pathsPerTick: B.PATHS_PER_TICK,
      stuckTicks: ticks(B.STUCK_MS),
      stuckDistance: B.STUCK_UNITS * SUB,
      trophiesPerLevel: B.TROPHIES_PER_LEVEL,
      maxLevel: B.MAX_LEVEL * 10,
      reactionMs: B.REACTION_MS,
      aimError: B.AIM_ERROR_STEPS,
      leadPermille: [B.LEAD_PERCENT[0] * 10, B.LEAD_PERCENT[1] * 10],
      noise: B.DECISION_NOISE,
      strafePermille: [B.STRAFE_PERCENT[0] * 10, B.STRAFE_PERCENT[1] * 10],
      levelSpread: B.PERSONALITY_LEVEL_SPREAD * 10,
      reference: { ...br.CHARACTER.REFERENCE },
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
