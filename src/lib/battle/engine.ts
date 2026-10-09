/**
 * Moteur de bataille en temps réel : fonction pure et déterministe.
 *   createBattle(graine, decks)  → état initial
 *   deploy(état, camp, emplacement, x, y) → pose une carte (énergie, zone, délai)
 *   step(état)                   → avance d'un tick (1/20 s)
 * Le même enchaînement d'entrées donne toujours le même résultat : le
 * serveur peut rejouer une partie pour en vérifier le vainqueur.
 */
import { matchup } from "@/config/vibes";
import type { Card } from "@/lib/validation/card";
import { ARENA, COST, RULES, TOWERS } from "./rules";

export type Side = "a" | "b";
export const other = (s: Side): Side => (s === "a" ? "b" : "a");

export interface UnitTemplate {
  cardId: string;
  name: string;
  rarity: Card["rarity"];
  vibe: Card["vibe"];
  artSeed: number;
  cost: number;
  hp: number;
  damage: number;
  def: number;
  hitTicks: number;
  range: number;
  speed: number;
  targets: "all" | "buildings";
  splash: number;
  specialMult: number; // en centièmes
  special: Card["specialAttack"]["effect"];
}

export interface Unit {
  id: number;
  side: Side;
  cardId: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  cooldown: number;
  hits: number;
  stunned: number;
  targetId: number | null;
}

export interface Tower {
  id: number;
  side: Side;
  kind: "princess" | "king";
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  cooldown: number;
  active: boolean;
  targetId: number | null;
}

export interface SideState {
  energy: number;
  hand: string[];
  next: string;
  queue: string[];
  crowns: number;
}

export interface PendingDeploy {
  tick: number;
  side: Side;
  cardId: string;
  x: number;
  y: number;
}

export type BattleEvent =
  | { type: "hit"; from: number; to: number; damage: number; special: boolean; ranged: boolean }
  | { type: "spawn"; id: number }
  | { type: "death"; id: number; x: number; y: number }
  | { type: "tower_down"; id: number };

export interface BattleResult {
  winner: Side | null;
  crowns: Record<Side, number>;
  reason: "king" | "time" | "overtime" | "tiebreak" | "draw";
}

export interface BattleState {
  tick: number;
  rng: number;
  phase: "playing" | "overtime" | "ended";
  templates: Record<string, UnitTemplate>;
  sides: Record<Side, SideState>;
  towers: Tower[];
  units: Unit[];
  pending: PendingDeploy[];
  nextId: number;
  events: BattleEvent[];
  result: BattleResult | null;
}

// ---------------------------------------------------------------- outils entiers

/** Racine carrée entière exacte (indépendante des approximations du navigateur). */
export function isqrt(n: number): number {
  if (n <= 0) return 0;
  let x = Math.floor(Math.sqrt(n));
  while (x * x > n) x--;
  while ((x + 1) * (x + 1) <= n) x++;
  return x;
}
const dist2 = (ax: number, ay: number, bx: number, by: number) => (ax - bx) ** 2 + (ay - by) ** 2;

/** Générateur pseudo-aléatoire 32 bits (état entier stocké dans la partie). */
function nextRandom(state: BattleState): number {
  let t = (state.rng = (state.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- cartes → unités

/** Caractéristiques d'une unité, dérivées de la carte (rareté, vibe, statistiques). */
export function unitTemplate(card: Card): UnitTemplate {
  const cost = COST[card.rarity];
  const scale = (cost + 1) / 3; // une carte plus chère est plus puissante
  let hp = card.hp * 6 * scale;
  let damage = card.atk * 1.6 * scale;
  let speed = (500 + card.spd * 10) / 20; // millièmes de case par tick
  let range = 700;
  let targets: UnitTemplate["targets"] = "all";
  let splash = 0;
  // Chaque vibe a un style de combat.
  switch (card.vibe) {
    case "wholesome": // tank : vise uniquement les tours
      targets = "buildings";
      hp *= 1.3;
      damage *= 0.8;
      break;
    case "rage": // cogneur au corps à corps
      damage *= 1.15;
      break;
    case "chaos": // rapide
      speed *= 1.15;
      break;
    case "cringe": // dégâts de zone
      splash = 1_200;
      damage *= 0.8;
      break;
    case "ironique": // tire de loin
      range = 5_000;
      hp *= 0.85;
      break;
    case "absurde": // tire à moyenne distance
      range = 4_000;
      hp *= 0.9;
      break;
  }
  const normal = Math.max(1, card.normalAttack.power);
  return {
    cardId: card.id,
    name: card.name,
    rarity: card.rarity,
    vibe: card.vibe,
    artSeed: card.artSeed,
    cost,
    hp: Math.round(hp),
    damage: Math.round(damage),
    def: card.def,
    hitTicks: 22,
    range,
    speed: Math.round(speed),
    targets,
    splash,
    specialMult: Math.min(250, Math.max(120, Math.round((card.specialAttack.power * 100) / normal))),
    special: card.specialAttack.effect,
  };
}

// ---------------------------------------------------------------- création

function makeTowers(): Tower[] {
  const t = (id: number, side: Side, kind: Tower["kind"], x: number, yBottom: number): Tower => {
    const spec = TOWERS[kind];
    return { id, side, kind, x, y: side === "a" ? yBottom : ARENA.H - yBottom, hp: spec.hp, maxHp: spec.hp, cooldown: 0, active: kind === "princess", targetId: null };
  };
  return [
    t(1, "a", "princess", 3_500, 25_500),
    t(2, "a", "princess", 14_500, 25_500),
    t(3, "a", "king", 9_000, 29_000),
    t(4, "b", "princess", 3_500, 25_500),
    t(5, "b", "princess", 14_500, 25_500),
    t(6, "b", "king", 9_000, 29_000),
  ];
}

export function createBattle(seed: number, decks: Record<Side, Card[]>): BattleState {
  const state: BattleState = {
    tick: 0,
    rng: seed | 0,
    phase: "playing",
    templates: {},
    sides: {} as Record<Side, SideState>,
    towers: makeTowers(),
    units: [],
    pending: [],
    nextId: 7,
    events: [],
    result: null,
  };
  for (const side of ["a", "b"] as const) {
    const ids = decks[side].slice(0, RULES.DECK_SIZE).map((c) => {
      state.templates[c.id] = unitTemplate(c);
      return c.id;
    });
    // Mélange de Fisher-Yates avec le générateur de la partie.
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(nextRandom(state) * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    state.sides[side] = {
      energy: RULES.ENERGY_START,
      hand: ids.slice(0, RULES.HAND_SIZE),
      next: ids[RULES.HAND_SIZE] ?? ids[0],
      queue: ids.slice(RULES.HAND_SIZE + 1),
      crowns: 0,
    };
  }
  return state;
}

// ---------------------------------------------------------------- pose d'une carte

export function canDeployAt(state: BattleState, side: Side, x: number, y: number): boolean {
  if (x < 500 || x > ARENA.W - 500) return false;
  const own = side === "a" ? y >= ARENA.RIVER_BOTTOM + 500 && y <= ARENA.H - 500 : y <= ARENA.RIVER_TOP - 500 && y >= 500;
  if (own) return true;
  // Une tour adverse détruite ouvre la moitié de son couloir, jusqu'à 4 cases au-delà de la rivière.
  const lane = x < ARENA.W / 2 ? 0 : 1;
  const enemyPrincess = state.towers.find((t) => t.side === other(side) && t.kind === "princess" && (t.x < ARENA.W / 2 ? 0 : 1) === lane);
  if (enemyPrincess && enemyPrincess.hp > 0) return false;
  return side === "a" ? y >= ARENA.RIVER_TOP - 4_000 && y < ARENA.RIVER_TOP : y <= ARENA.RIVER_BOTTOM + 4_000 && y > ARENA.RIVER_BOTTOM;
}

export type DeployResult = { ok: true } | { ok: false; reason: "ended" | "slot" | "energy" | "zone" };

export function deploy(state: BattleState, side: Side, slot: number, x: number, y: number): DeployResult {
  if (state.phase === "ended") return { ok: false, reason: "ended" };
  const s = state.sides[side];
  const cardId = s.hand[slot];
  if (!cardId) return { ok: false, reason: "slot" };
  const cost = state.templates[cardId].cost * 1_000;
  if (s.energy < cost) return { ok: false, reason: "energy" };
  if (!canDeployAt(state, side, x, y)) return { ok: false, reason: "zone" };
  s.energy -= cost;
  s.queue.push(cardId);
  s.hand[slot] = s.next;
  s.next = s.queue.shift()!;
  state.pending.push({ tick: state.tick + RULES.DEPLOY_DELAY, side, cardId, x: Math.round(x), y: Math.round(y) });
  return { ok: true };
}

// ---------------------------------------------------------------- simulation

const enemyTowerFor = (state: BattleState, unit: Unit, alive: Set<number>): Tower => {
  const lane = unit.x < ARENA.W / 2 ? 0 : 1;
  const enemies = state.towers.filter((t) => t.side !== unit.side && alive.has(t.id));
  const princess = enemies.find((t) => t.kind === "princess" && (t.x < ARENA.W / 2 ? 0 : 1) === lane);
  return princess ?? enemies.find((t) => t.kind === "king") ?? enemies[0];
};

function applyDamage(state: BattleState, attacker: { side: Side; vibe?: Card["vibe"] }, target: Unit | Tower, raw: number, pierce = 0) {
  let damage = raw;
  if ("cardId" in target) {
    const tpl = state.templates[target.cardId];
    const def = Math.round((tpl.def * (100 - pierce)) / 100);
    damage = Math.round((damage * 100) / (100 + def));
    if (attacker.vibe) {
      const m = matchup(attacker.vibe, tpl.vibe);
      if (m === "advantage") damage = Math.round(damage * 1.25);
      if (m === "weakness") damage = Math.round(damage * 0.8);
    }
  }
  target.hp -= Math.max(1, damage);
  return Math.max(1, damage);
}

function unitAttack(state: BattleState, unit: Unit, target: Unit | Tower, aliveIds: Set<number>) {
  const tpl = state.templates[unit.cardId];
  unit.hits++;
  const special = unit.hits % 4 === 0;
  let raw = special ? Math.round((tpl.damage * tpl.specialMult) / 100) : tpl.damage;
  let pierce = 0;
  if (special) {
    const e = tpl.special;
    if (e.kind === "multi") raw = Math.round((tpl.damage * e.hits * e.percent) / 100);
    if (e.kind === "pierce") pierce = e.percent;
  }
  const targets: Array<Unit | Tower> = [target];
  if (tpl.splash > 0) {
    for (const u of state.units) {
      if (u !== target && u.side !== unit.side && aliveIds.has(u.id) && dist2(u.x, u.y, target.x, target.y) <= tpl.splash ** 2) targets.push(u);
    }
  }
  for (const t of targets) {
    const dealt = applyDamage(state, { side: unit.side, vibe: tpl.vibe }, t, raw, pierce);
    state.events.push({ type: "hit", from: unit.id, to: t.id, damage: dealt, special, ranged: tpl.range > 1_500 });
    if (special && tpl.special.kind === "drain") unit.hp = Math.min(unit.maxHp, unit.hp + Math.round((dealt * tpl.special.percent) / 100));
  }
  if (special) {
    const e = tpl.special;
    if (e.kind === "buff") unit.hp = Math.min(unit.maxHp, unit.hp + Math.round(unit.maxHp / 10));
    if (e.kind === "stun" && "cardId" in target && nextRandom(state) * 100 < e.chance) target.stunned = 20;
  }
}

/** Point de passage : traverser la rivière par le pont le plus proche avant de foncer sur la cible. */
function waypoint(unit: Unit, tx: number, ty: number): [number, number] {
  const mustCross =
    (unit.side === "a" && unit.y > ARENA.RIVER_TOP && ty < ARENA.RIVER_TOP) ||
    (unit.side === "b" && unit.y < ARENA.RIVER_BOTTOM && ty > ARENA.RIVER_BOTTOM);
  if (!mustCross) return [tx, ty];
  const bridge = Math.abs(unit.x - ARENA.BRIDGES[0]) <= Math.abs(unit.x - ARENA.BRIDGES[1]) ? ARENA.BRIDGES[0] : ARENA.BRIDGES[1];
  if (Math.abs(unit.x - bridge) > 600) return [bridge, unit.side === "a" ? ARENA.RIVER_BOTTOM + 300 : ARENA.RIVER_TOP - 300];
  return [bridge, unit.side === "a" ? ARENA.RIVER_TOP - 400 : ARENA.RIVER_BOTTOM + 400];
}

function moveToward(unit: Unit, tx: number, ty: number, speed: number) {
  const dx = tx - unit.x;
  const dy = ty - unit.y;
  const d = isqrt(dx * dx + dy * dy);
  if (d <= speed) {
    unit.x = tx;
    unit.y = ty;
  } else {
    unit.x += Math.trunc((dx * speed) / d);
    unit.y += Math.trunc((dy * speed) / d);
  }
}

const radiusOf = (t: Unit | Tower) => ("cardId" in t ? RULES.UNIT_RADIUS : TOWERS[t.kind].radius);

export function step(state: BattleState): BattleState {
  if (state.phase === "ended") return state;
  state.events = [];

  // 1. Les cartes posées il y a une seconde apparaissent.
  const due = state.pending.filter((p) => p.tick <= state.tick);
  state.pending = state.pending.filter((p) => p.tick > state.tick);
  for (const p of due) {
    const tpl = state.templates[p.cardId];
    const unit: Unit = { id: state.nextId++, side: p.side, cardId: p.cardId, x: p.x, y: p.y, hp: tpl.hp, maxHp: tpl.hp, cooldown: 0, hits: 0, stunned: 0, targetId: null };
    state.units.push(unit);
    state.events.push({ type: "spawn", id: unit.id });
  }

  // 2. Énergie (doublée pendant la dernière minute et la prolongation).
  const regen = state.tick >= RULES.DOUBLE_ENERGY_AT ? RULES.ENERGY_REGEN * 2 : RULES.ENERGY_REGEN;
  for (const side of ["a", "b"] as const) state.sides[side].energy = Math.min(RULES.ENERGY_MAX, state.sides[side].energy + regen);

  // Actions simultanées : tout ce qui est vivant au début du tick agit et peut être visé,
  // même s'il tombe pendant ce tick (sinon le camp dont les unités sont créées en premier
  // frapperait toujours le premier). Les morts sont retirés à la fin du tick.
  const aliveUnits = new Set(state.units.filter((u) => u.hp > 0).map((u) => u.id));
  const aliveTowers = new Set(state.towers.filter((t) => t.hp > 0).map((t) => t.id));

  // 3. Les tours tirent sur l'unité ennemie la plus proche à portée.
  for (const tower of state.towers) {
    if (!aliveTowers.has(tower.id)) continue;
    if (tower.kind === "king" && !tower.active) {
      const princessDown = state.towers.some((t) => t.side === tower.side && t.kind === "princess" && t.hp <= 0);
      if (tower.hp < tower.maxHp || princessDown) tower.active = true;
      else continue;
    }
    const spec = TOWERS[tower.kind];
    let best: Unit | null = null;
    let bestD = spec.range ** 2;
    for (const u of state.units) {
      if (u.side === tower.side || !aliveUnits.has(u.id)) continue;
      const d = dist2(u.x, u.y, tower.x, tower.y);
      if (d <= bestD) [best, bestD] = [u, d];
    }
    tower.targetId = best?.id ?? null;
    if (tower.cooldown > 0) tower.cooldown--;
    if (best && tower.cooldown <= 0) {
      const dealt = applyDamage(state, { side: tower.side }, best, spec.damage);
      state.events.push({ type: "hit", from: tower.id, to: best.id, damage: dealt, special: false, ranged: true });
      tower.cooldown = spec.hitTicks;
    }
  }

  // 4. Les unités choisissent une cible, avancent ou frappent.
  for (const unit of state.units) {
    if (!aliveUnits.has(unit.id)) continue;
    if (unit.stunned > 0) {
      unit.stunned--;
      continue;
    }
    const tpl = state.templates[unit.cardId];
    let target: Unit | Tower | null = null;
    if (tpl.targets === "all") {
      let bestD = RULES.SIGHT ** 2;
      for (const u of state.units) {
        if (u.side === unit.side || !aliveUnits.has(u.id)) continue;
        const d = dist2(u.x, u.y, unit.x, unit.y);
        if (d <= bestD) [target, bestD] = [u, d];
      }
    }
    target ??= enemyTowerFor(state, unit, aliveTowers);
    if (!target) continue;
    unit.targetId = target.id;
    const reach = tpl.range + RULES.UNIT_RADIUS + radiusOf(target);
    if (unit.cooldown > 0) unit.cooldown--;
    if (dist2(unit.x, unit.y, target.x, target.y) <= reach ** 2) {
      if (unit.cooldown <= 0) {
        unitAttack(state, unit, target, aliveUnits);
        unit.cooldown = tpl.hitTicks;
      }
    } else {
      const [wx, wy] = waypoint(unit, target.x, target.y);
      moveToward(unit, wx, wy, tpl.speed);
    }
  }

  // 5. Les unités ne se superposent pas.
  const alive = state.units.filter((u) => u.hp > 0);
  const min = RULES.UNIT_RADIUS * 2;
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i];
      const b = alive[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      const d = isqrt(d2);
      const push = Math.trunc((min - d) / 2) + 1;
      const [nx, ny] = d === 0 ? [(a.id + b.id) % 2 === 0 ? 1 : -1, 0] : [dx / d, dy / d];
      a.x -= Math.trunc(nx * push);
      a.y -= Math.trunc(ny * push);
      b.x += Math.trunc(nx * push);
      b.y += Math.trunc(ny * push);
    }
  }
  for (const u of alive) {
    u.x = Math.max(300, Math.min(ARENA.W - 300, u.x));
    u.y = Math.max(300, Math.min(ARENA.H - 300, u.y));
  }

  // 6. Morts, tours détruites et couronnes.
  for (const u of state.units) if (u.hp <= 0) state.events.push({ type: "death", id: u.id, x: u.x, y: u.y });
  state.units = state.units.filter((u) => u.hp > 0);
  for (const t of state.towers) {
    if (t.hp <= 0 && t.maxHp > 0) {
      t.hp = 0;
      t.maxHp = 0; // marque « déjà comptée »
      state.events.push({ type: "tower_down", id: t.id });
      const winner = state.sides[other(t.side)];
      if (t.kind === "king") {
        winner.crowns = 3;
        return end(state, other(t.side), "king");
      }
      winner.crowns = Math.min(3, winner.crowns + 1);
    }
  }

  // 7. Fin du temps, prolongation, départage.
  state.tick++;
  const { a, b } = state.sides;
  if (state.phase === "overtime" && a.crowns !== b.crowns) return end(state, a.crowns > b.crowns ? "a" : "b", "overtime");
  if (state.tick === RULES.MATCH_TICKS) {
    if (a.crowns !== b.crowns) return end(state, a.crowns > b.crowns ? "a" : "b", "time");
    state.phase = "overtime";
  }
  if (state.tick >= RULES.MATCH_TICKS + RULES.OVERTIME_TICKS) {
    // Départage : le camp dont la tour la plus abîmée tient le mieux.
    const weakest = (side: Side) => Math.min(...state.towers.filter((t) => t.side === side).map((t) => (t.maxHp > 0 ? Math.round((t.hp * 1000) / t.maxHp) : 0)));
    const wa = weakest("a");
    const wb = weakest("b");
    return wa === wb ? end(state, null, "draw") : end(state, wa > wb ? "a" : "b", "tiebreak");
  }
  return state;
}

function end(state: BattleState, winner: Side | null, reason: BattleResult["reason"]): BattleState {
  state.phase = "ended";
  state.result = { winner, crowns: { a: state.sides.a.crowns, b: state.sides.b.crowns }, reason };
  return state;
}

/** Empreinte de l'état (sans les événements d'affichage), pour vérifier que deux simulations sont identiques. */
export function fingerprint(state: BattleState): string {
  const json = JSON.stringify(state, (key, value) => (key === "events" || key === "templates" ? undefined : value));
  let h = 2166136261;
  for (let i = 0; i < json.length; i++) h = Math.imul(h ^ json.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
}

export interface RecordedInput {
  tick: number;
  side: Side;
  slot: number;
  x: number;
  y: number;
}

/** Rejoue une partie à partir de sa graine et de ses entrées (vérification côté serveur). */
export function replay(seed: number, decks: Record<Side, Card[]>, inputs: RecordedInput[], maxTicks = RULES.MATCH_TICKS + RULES.OVERTIME_TICKS + 1): BattleState {
  const state = createBattle(seed, decks);
  const byTick = new Map<number, RecordedInput[]>();
  for (const i of inputs) byTick.set(i.tick, [...(byTick.get(i.tick) ?? []), i]);
  while (state.phase !== "ended" && state.tick < maxTicks) {
    for (const i of byTick.get(state.tick) ?? []) deploy(state, i.side, i.slot, i.x, i.y);
    step(state);
  }
  return state;
}
