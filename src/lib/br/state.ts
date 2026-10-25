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
  "fireCd",
  /** Ticks restants avant la fin du rechargement (0 = aucun). */
  "reload",
  "abilityCd",
  /** Ticks restants de l'effet de la capacité (sprint, vol de vie, perce-armure, boost) ou de la fenêtre « prochaine balle ». */
  "abilityLeft",
  "stun",
  "burnLeft",
  /** PV perdus par seconde de brûlure, et qui l'a infligée. */
  "burnDps",
  "burnFrom",
  /** Dernier tick où le participant a été touché (régénération), et par qui (−1 : personne). */
  "lastHit",
  "lastHitBy",
  /** Dernier tick où le participant a tiré (ouïe des bots). */
  "lastShot",
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

/** Mémoire et réglages de chaque bot (un entier par participant ; inutilisés pour un emplacement piloté par des commandes). */
export const BOT_FIELDS = [
  /** Niveau en dixièmes, après la variation personnelle ; −1 : emplacement piloté par des commandes (joueur). */
  "level",
  /** Personnalité (voir bot.ts) et traits : envie d'attaquer (‰), seuil de PV pour se soigner ou fuir (‰ des PV max), distance de combat (‰ de la normale). */
  "persona",
  "aggro",
  "caution",
  "rangeMod",
  /** Difficulté : réaction (ticks), erreur de visée (pas), anticipation (‰), bruit des décisions, pas de côté (‰). */
  "react",
  "aimErr",
  "lead",
  "noise",
  "strafe",
  /** Décision en cours, ennemi visé (−1 : aucun), objet visé (−1 : aucun), point visé. */
  "action",
  "target",
  "item",
  "goalX",
  "goalY",
  /** Chemin : nombre de points, prochain point, but du chemin, calcul demandé. */
  "pathLen",
  "pathIdx",
  "pathGX",
  "pathGY",
  /** Chemin à calculer : 0 non, 1 oui, 2 en priorité (bot coincé). */
  "needPath",
  /** Combat : tick où la cible est apparue (réaction), dernier tick où elle était visible, sa position à ce moment, erreur de visée en cours, pas de côté. */
  "seenTick",
  "visTick",
  "tgtX",
  "tgtY",
  "aimOff",
  "strafeDir",
  "strafeUntil",
  /** Anti-blocage : position et tick de référence, direction de secours et sa fin. */
  "anchorX",
  "anchorY",
  "anchorTick",
  "unstickDir",
  "unstickUntil",
  /** Dernier tir entendu (position approximative) et dernière menace (d'où venaient les balles reçues). */
  "heardX",
  "heardY",
  "heardTick",
  "threatX",
  "threatY",
  "threatTick",
  /** Bâtiment visé pour explorer (−1 : aucun). */
  "building",
  /** Dernière commande produite (lecture seule : banc d'essai, débogage). */
  "cmd",
] as const;
export type BotField = (typeof BOT_FIELDS)[number];

/** Ennemis mémorisés par bot : emplacement (−1 : case libre), x, y, tick où il a été vu, PV et gilet vus (barre de vie). */
export const BOT_MEMORY = 4;
export const BOT_MEMORY_FIELDS = 5;
/** Points de chemin gardés par bot (au-delà, le chemin est recalculé en route). */
export const BOT_PATH = 32;

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
  /** Bots : nombre (fixé à la création), mémoire par bot, ennemis mémorisés, chemins, compteurs communs (recherche de chemin suivante). */
  readonly botCount: number;
  b: Record<BotField, Int32Array>;
  bmem: Int32Array;
  bpath: Int32Array;
  bmisc: Int32Array;
}

/** Arme en main (indice dans rules.weapons). */
export function weaponInHand(s: MatchState, i: number): number {
  return s.p.active[i] === 1 && s.p.weapon1[i] >= 0 ? s.p.weapon1[i] : s.rules.startWeapon;
}

/**
 * L'objet k peut-il être ramassé par i ? Un soin (PV pleins), un gilet (protection pleine) ou des munitions
 * (réserve pleine) inutiles restent au sol, et ne gênent pas le ramassage d'un autre objet.
 */
export function canTake(s: MatchState, i: number, k: number): boolean {
  const I = s.it;
  const items = s.rules.items;
  switch (I.kind[k]) {
    case ITEM.weapon:
      return true;
    case ITEM.ammo:
      return s.m.ammo[4 * i + I.sub[k]] < items.ammoMax[I.sub[k]];
    case ITEM.heal:
      return s.p.hp[i] < s.fighters[i].maxHp;
    case ITEM.vest:
      return s.p.shield[i] < items.vestShield;
  }
  return false;
}

export const SHOT_CAPACITY = 4096;

function table<K extends string>(keys: readonly K[], size: number): Record<K, Int32Array> {
  return Object.fromEntries(keys.map((k) => [k, new Int32Array(size)])) as Record<K, Int32Array>;
}

export function allocateState(rules: Rules, map: GameMap, characters: readonly BattleCharacter[], rng: Uint32Array, loot: readonly LootItem[], botCount = 0): MatchState {
  const n = characters.length;
  const b = table(BOT_FIELDS, n);
  b.level.fill(-1);
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
    botCount,
    b,
    bmem: new Int32Array(BOT_MEMORY_FIELDS * BOT_MEMORY * n).fill(-1),
    bpath: new Int32Array(BOT_PATH * n),
    bmisc: new Int32Array(2),
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
    b: cloneTable(s.b),
    bmem: s.bmem.slice(),
    bpath: s.bpath.slice(),
    bmisc: s.bmisc.slice(),
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
  for (const k of BOT_FIELDS) all(s.b[k]);
  all(s.bmem);
  all(s.bpath);
  all(s.bmisc);
  const hex = (v: number) => (v >>> 0).toString(16).padStart(8, "0");
  return hex(h1) + hex(h2);
}
