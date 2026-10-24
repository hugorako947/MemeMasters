/**
 * État d'une partie : uniquement des entiers, rangés dans des tableaux typés, sans
 * référence partagée modifiable. La carte, les règles et les personnages (constantes)
 * sont partagés entre les copies et ne sont jamais modifiés.
 */
import type { BattleCharacter } from "./character";
import { ITEM, type GameMap, type LootItem } from "./map";
import { fighterFor, type Fighter, type Rules } from "./rules";

/** Champs d'un participant (un entier par participant, sauf mention). */
export const PARTICIPANT_FIELDS = [
  "alive",
  "x",
  "y",
  /** Angle de visée actuel (0…255). */
  "aim",
  "hp",
  /** Protection du gilet, consommée avant les PV. */
  "shield",
  /** Arme ramassée (indice), −1 si aucune ; l'arme de départ est toujours là. */
  "weapon1",
  /** Arme en main : 0 = arme de départ, 1 = arme ramassée. */
  "active",
  "mag0",
  "mag1",
  "heals",
  "fireCd",
  /** Ticks restants avant la fin du rechargement (0 = aucun). */
  "reload",
  /** Ticks restants avant la fin du soin (0 = aucun). */
  "healing",
  "abilityCd",
  /** Ticks restants de l'effet de la capacité (sprint, vol de vie, perce-armure, boost) ou de la fenêtre « prochaine balle ». */
  "abilityLeft",
  "stun",
  "burnLeft",
  /** PV perdus par seconde de brûlure, et qui l'a infligée. */
  "burnDps",
  "burnFrom",
  /** Dernier tick où le participant a été touché (régénération). */
  "lastHit",
  "prevButtons",
  /** Résultats : place (0 = encore en vie), éliminations, dégâts infligés, éliminé par (−1 zone, −2 personne), tick. */
  "place",
  "kills",
  "damage",
  "killedBy",
  "deathTick",
] as const;
export type ParticipantField = (typeof PARTICIPANT_FIELDS)[number];

/** Champs à plusieurs valeurs par participant : munitions (4 types), affaiblissements (ATQ, DÉF, VIT). */
export const MULTI_FIELDS = { ammo: 4, debuffLeft: 3, debuffPermille: 3 } as const;
export type MultiField = keyof typeof MULTI_FIELDS;

/** Projectiles, dans l'ordre de création. */
export const SHOT_FIELDS = [
  "id",
  "x",
  "y",
  "vx",
  "vy",
  /** Longueur d'un pas (sous-unités par tick) et portée restante. */
  "speed",
  "left",
  "damage",
  "owner",
  "weapon",
  "stunTicks",
  "burnPermille",
  "burnTicks",
  "debuffStat",
  "debuffPermille",
  "debuffTicks",
  "pierce",
  "drain",
] as const;
export type ShotField = (typeof SHOT_FIELDS)[number];

export const ITEM_FIELDS = ["kind", "sub", "qty", "x", "y"] as const;
export type ItemField = (typeof ITEM_FIELDS)[number];

/** Zone : phase, étape (0 attente, 1 rétrécissement, 2 fermée), ticks dans l'étape, cercle actuel, de départ et visé. */
export const Z = { phase: 0, stage: 1, t: 2, cx: 3, cy: 4, r: 5, fx: 6, fy: 7, fr: 8, tx: 9, ty: 10, tr: 11 } as const;

/** Compteurs : prochain numéro de projectile, munitions tirées par type (1…3), soins utilisés, gilets utilisés. */
export const C = { nextShot: 0, firedLight: 1, firedShell: 2, firedHeavy: 3, usedHeals: 4, usedVests: 5 } as const;

/** Raisons d'élimination du journal (après les indices d'armes 0…4). */
export const KILL_BURN = 5;
export const KILL_ZONE = 6;
export const KILL_REFLECT = 7;

export interface MatchState {
  readonly rules: Rules;
  readonly map: GameMap;
  readonly fighters: readonly Fighter[];
  readonly n: number;
  tick: number;
  aliveCount: number;
  finished: boolean;
  rng: Uint32Array;
  p: Record<ParticipantField, Int32Array>;
  m: Record<MultiField, Int32Array>;
  shotCount: number;
  s: Record<ShotField, Int32Array>;
  itemCount: number;
  it: Record<ItemField, Int32Array>;
  zone: Int32Array;
  counters: Int32Array;
  /** Journal des éliminations : tick, auteur (−1 zone), victime, arme ou cause ; 4 entiers par entrée. */
  logCount: number;
  log: Int32Array;
}

export const SHOT_CAPACITY = 4096;

function table<K extends string>(keys: readonly K[], size: number): Record<K, Int32Array> {
  return Object.fromEntries(keys.map((k) => [k, new Int32Array(size)])) as Record<K, Int32Array>;
}

export function allocateState(rules: Rules, map: GameMap, characters: readonly BattleCharacter[], rng: Uint32Array, loot: readonly LootItem[]): MatchState {
  const n = characters.length;
  const itemCapacity = loot.length + 6 * n;
  const it = table(ITEM_FIELDS, itemCapacity);
  loot.forEach((item, k) => {
    it.kind[k] = item.kind === ITEM.none ? ITEM.none : item.kind;
    it.sub[k] = item.sub;
    it.qty[k] = item.qty;
    it.x[k] = item.x;
    it.y[k] = item.y;
  });
  return {
    rules,
    map,
    fighters: characters.map((c) => fighterFor(c, rules)),
    n,
    tick: 0,
    aliveCount: n,
    finished: false,
    rng,
    p: table(PARTICIPANT_FIELDS, n),
    m: { ammo: new Int32Array(4 * n), debuffLeft: new Int32Array(3 * n), debuffPermille: new Int32Array(3 * n) },
    shotCount: 0,
    s: table(SHOT_FIELDS, SHOT_CAPACITY),
    itemCount: loot.length,
    it,
    zone: new Int32Array(12),
    counters: new Int32Array(6),
    logCount: 0,
    log: new Int32Array(4 * n),
  };
}

function cloneTable<K extends string>(t: Record<K, Int32Array>): Record<K, Int32Array> {
  return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, (v as Int32Array).slice()])) as Record<K, Int32Array>;
}

/** Copie indépendante de l'état (la carte, les règles et les personnages restent partagés : ils ne changent jamais). */
export function cloneState(s: MatchState): MatchState {
  return {
    ...s,
    rng: s.rng.slice(),
    p: cloneTable(s.p),
    m: cloneTable(s.m),
    s: cloneTable(s.s),
    it: cloneTable(s.it),
    zone: s.zone.slice(),
    counters: s.counters.slice(),
    log: s.log.slice(),
  };
}

/** Empreinte de l'état (FNV-1a 32 bits, deux variantes : 64 bits en hexadécimal). Deux états identiques ont la même empreinte. */
export function stateHash(s: MatchState): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ 0x5bd1e995;
  const mix = (v: number) => {
    for (let k = 0; k < 4; k++) {
      const byte = (v >>> (8 * k)) & 255;
      h1 = Math.imul(h1 ^ byte, 16777619);
      h2 = Math.imul(h2 ^ byte, 16777619) ^ (h2 >>> 13);
    }
  };
  const all = (a: ArrayLike<number>, len = a.length) => {
    mix(len);
    for (let i = 0; i < len; i++) mix(a[i]);
  };
  mix(s.tick);
  mix(s.aliveCount);
  mix(s.finished ? 1 : 0);
  all(s.rng);
  for (const k of PARTICIPANT_FIELDS) all(s.p[k]);
  for (const k of Object.keys(MULTI_FIELDS) as MultiField[]) all(s.m[k]);
  for (const k of SHOT_FIELDS) all(s.s[k], s.shotCount);
  for (const k of ITEM_FIELDS) all(s.it[k], s.itemCount);
  all(s.zone);
  all(s.counters);
  all(s.log, 4 * s.logCount);
  const hex = (v: number) => (v >>> 0).toString(16).padStart(8, "0");
  return hex(h1) + hex(h2);
}
