import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "@/config/game.config";
import type { BattleCharacter } from "@/lib/br/character";
import { BTN, packCommand } from "@/lib/br/commands";
import { advance, createMatch } from "@/lib/br/engine";
import { TILE, type GameMap } from "@/lib/br/map";
import { resolveRules, type Rules } from "@/lib/br/rules";
import { createEventTracker, type TickEvents } from "./events";

const BASE = resolveRules(GAME_CONFIG.BATTLE_ROYALE);
const TS = BASE.map.tileSub;
const tile = (t: number) => t * TS + (TS >> 1);

function rules(participants: number): Rules {
  return { ...BASE, participants, aimAssist: 0, weapons: BASE.weapons.map((w) => ({ ...w, spread: 0 })) };
}

function character(): BattleCharacter {
  return {
    stats: { hp: 92, atk: 39, def: 36, spd: 77 },
    maxHp: 140,
    hitRadius: 18,
    damageTakenPercent: 84,
    speed: 300,
    weaponPercent: 100,
    ability: { kind: "sprint", cooldownMs: 15000, durationMs: 2000, permille: 400, effectMs: 0, hits: 0, stat: null },
    passive: { kind: "regen", permille: 0 },
  };
}

const cmd = (aim: number, buttons = 0) => packCommand({ move: 0, aim, buttons });

const N = 64;

/** Deux participants immobiles ; une caisse à droite du premier, un mur au-dessus de lui. */
function setup() {
  const map: GameMap = { size: N, tileSub: TS, tiles: new Uint8Array(N * N), buildings: new Int32Array(0) };
  map.tiles[16 * N + 9] = TILE.crate;
  for (let x = 0; x < N; x++) map.tiles[10 * N + x] = TILE.wall;
  const s = createMatch({ seed: 1, rules: rules(2), characters: [character(), character()], map, spawns: [tile(4), tile(16), tile(26), tile(26)], loot: [] });
  // Le joueur démarre au couteau : on l'équipe d'une arme à feu (emplacement A) pour les tirs.
  s.p.weapon0[0] = s.rules.startWeapon;
  s.p.mag0[0] = s.rules.weapons[s.rules.startWeapon].magazine;
  s.p.ammo[0] = 99;
  s.p.active[0] = 0;
  return { s, tracker: createEventTracker(s) };
}

function collect(run: () => TickEvents, ticks: number): TickEvents {
  const all: TickEvents = { shots: [], swings: [], impacts: [], crates: [] };
  for (let t = 0; t < ticks; t++) {
    const e = run();
    all.shots.push(...e.shots);
    all.swings.push(...e.swings);
    all.impacts.push(...e.impacts);
    all.crates.push(...e.crates);
  }
  return all;
}

describe("événements d'un tick (effets et sons)", () => {
  it("un tir : un seul événement au départ, puis l'impact sur la caisse et la caisse abîmée", () => {
    const { s, tracker } = setup();
    const first = (() => {
      advance(s, [cmd(0, BTN.fire), 0]);
      return tracker.after(s);
    })();
    expect(first.shots).toHaveLength(1);
    expect(first.shots[0]).toMatchObject({ owner: 0, weapon: s.rules.startWeapon });
    expect(first.shots[0].x).toBe(s.p.x[0]);
    const rest = collect(() => {
      advance(s, [0, 0]);
      return tracker.after(s);
    }, 20);
    expect(rest.shots).toHaveLength(0);
    expect(rest.impacts).toHaveLength(1);
    // L'impact est sur le bord gauche de la caisse.
    expect(Math.round(rest.impacts[0].x)).toBe(9 * TS);
    expect(rest.crates).toEqual([{ tile: 16 * N + 9, hp: s.crates[16 * N + 9], x: tile(9), y: tile(16) }]);
    expect(s.crates[16 * N + 9]).toBeLessThan(s.rules.crate.hp);
  });

  it("un tir à bout portant, arrêté dans le tick même : le tir et l'impact sont quand même signalés", () => {
    const { s, tracker } = setup();
    s.p.x[0] = tile(8);
    advance(s, [cmd(0, BTN.fire), 0]);
    const e = tracker.after(s);
    expect(s.shotCount).toBe(0);
    expect(e.shots).toHaveLength(1);
    expect(e.impacts).toHaveLength(1);
    expect(Math.round(e.impacts[0].x)).toBe(9 * TS);
  });

  it("une balle contre un mur donne un impact ; une balle qui va au bout de sa portée n'en donne pas", () => {
    const { s, tracker } = setup();
    // La visée tourne d'au plus un huitième de tour par tick : on se tourne d'abord.
    for (let t = 0; t < 4; t++) advance(s, [cmd(192), 0]);
    tracker.after(s);
    const up = collect(() => {
      advance(s, [cmd(192, BTN.fire), 0]);
      return tracker.after(s);
    }, 1);
    const after = collect(() => {
      advance(s, [cmd(192), 0]);
      return tracker.after(s);
    }, 20);
    expect(up.shots).toHaveLength(1);
    expect(after.impacts).toHaveLength(1);
    expect(Math.round(after.impacts[0].y)).toBe(11 * TS);
    // Vers le bas : rien sur le chemin avant le bout de la portée.
    s.p.fireCd[0] = 0;
    s.p.reload[0] = 0;
    s.p.mag0[0] = 5;
    for (let t = 0; t < 4; t++) advance(s, [cmd(64), 0]);
    tracker.after(s);
    const down = collect(() => {
      advance(s, [cmd(64, BTN.fire), 0]);
      return tracker.after(s);
    }, 1);
    const downAfter = collect(() => {
      advance(s, [cmd(64), 0]);
      return tracker.after(s);
    }, 30);
    expect(down.shots).toHaveLength(1);
    expect(s.shotCount).toBe(0);
    expect(downAfter.impacts).toHaveLength(0);
  });

  it("un coup de couteau, et la caisse brisée (PV 0) est signalée une fois", () => {
    const { s, tracker } = setup();
    s.p.x[0] = tile(8);
    advance(s, [cmd(0, BTN.nextWeapon), 0]);
    tracker.after(s);
    const all = collect(() => {
      advance(s, [s.tick % 2 ? cmd(0, BTN.fire) : cmd(0), 0]);
      return tracker.after(s);
    }, 200);
    expect(all.swings.length).toBeGreaterThan(1);
    expect(all.swings[0]).toEqual({ slot: 0, aim: 0 });
    expect(all.crates.filter((c) => c.hp === 0)).toHaveLength(1);
    expect(s.map.tiles[16 * N + 9]).toBe(TILE.floor);
  });
});
