import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "@/config/game.config";
import { circleHitsSolid, generateMap, ITEM, lineOfSight, placeLoot, placeSpawns, reachableMask, segmentWallHit, TILE, tileAt, type GameMap } from "./map";
import { createStreams } from "./rng";
import { resolveRules, SUB } from "./rules";

const RULES = resolveRules(GAME_CONFIG.BATTLE_ROYALE);
const MAX_RADIUS = 22 * SUB;

function build(seed: number) {
  const rng = createStreams(seed, 4);
  const map = generateMap(RULES, rng);
  return { map, rng };
}

function emptyMap(size: number): GameMap {
  return { size, tileSub: RULES.map.tileSub, tiles: new Uint8Array(size * size), buildings: new Int32Array(0) };
}

describe("carte générée par la graine", () => {
  it("même graine → même carte ; autre graine → autre carte", () => {
    expect(build(42).map.tiles).toEqual(build(42).map.tiles);
    expect(build(42).map.tiles).not.toEqual(build(43).map.tiles);
  });

  it("bordure d'eau, bâtiments, caisses, buissons ; toute case praticable est accessible", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { map } = build(seed);
      const n = map.size;
      const B = RULES.map.border;
      for (let i = 0; i < n; i++) {
        for (const [x, y] of [[i, 0], [i, n - 1], [0, i], [n - 1, i]]) expect(map.tiles[y * n + x]).toBe(TILE.water);
      }
      expect(map.tiles[B * n + B - 1]).toBe(TILE.water);
      const count = (t: number) => map.tiles.reduce((s, v) => s + (v === t ? 1 : 0), 0);
      expect(count(TILE.wall)).toBeGreaterThan(200);
      expect(count(TILE.crate)).toBeGreaterThan(50);
      expect(count(TILE.bush)).toBeGreaterThan(40);
      const buildings = map.buildings.length / 4;
      expect(buildings).toBeGreaterThanOrEqual(RULES.map.buildings[0] - 4);
      expect(buildings).toBeLessThanOrEqual(RULES.map.buildings[1]);
      const reach = reachableMask(map);
      for (let i = 0; i < n * n; i++) {
        if (map.tiles[i] === TILE.floor || map.tiles[i] === TILE.bush) expect(reach[i]).toBe(1);
      }
    }
  });

  it("chaque bâtiment a au moins une porte de 2 cases dans son mur", () => {
    const { map } = build(11);
    for (let b = 0; b < map.buildings.length; b += 4) {
      const [x, y, w, h] = [map.buildings[b], map.buildings[b + 1], map.buildings[b + 2], map.buildings[b + 3]];
      let openings = 0;
      for (let i = x; i < x + w; i++) for (const j of [y, y + h - 1]) if (map.tiles[j * map.size + i] !== TILE.wall) openings++;
      for (let j = y + 1; j < y + h - 1; j++) for (const i of [x, x + w - 1]) if (map.tiles[j * map.size + i] !== TILE.wall) openings++;
      expect(openings).toBeGreaterThanOrEqual(2);
    }
  });

  it("points d'apparition : un par participant, libres, bien répartis", () => {
    const { map, rng } = build(21);
    const spawns = placeSpawns(map, RULES, rng, 100, MAX_RADIUS);
    expect(spawns.length).toBe(200);
    let minD2 = Infinity;
    for (let i = 0; i < 100; i++) {
      const [x, y] = [spawns[2 * i], spawns[2 * i + 1]];
      expect(circleHitsSolid(map, x, y, MAX_RADIUS)).toBe(false);
      for (let j = 0; j < i; j++) minD2 = Math.min(minD2, (x - spawns[2 * j]) ** 2 + (y - spawns[2 * j + 1]) ** 2);
    }
    // Au moins 4 cases entre deux joueurs au départ.
    expect(Math.sqrt(minD2)).toBeGreaterThan(4 * RULES.map.tileSub);
  });

  it("butin : 3 objets par participant, tous sur des cases accessibles, une bonne part dans les bâtiments", () => {
    const { map, rng } = build(31);
    const loot = placeLoot(map, RULES, rng, 100);
    expect(loot.length).toBe(300);
    const reach = reachableMask(map);
    let inside = 0;
    for (const item of loot) {
      const t = tileAt(map, item.x, item.y);
      expect(t === TILE.floor || t === TILE.bush).toBe(true);
      expect(reach[Math.floor(item.y / map.tileSub) * map.size + Math.floor(item.x / map.tileSub)]).toBe(1);
      expect([ITEM.weapon, ITEM.ammo, ITEM.heal, ITEM.vest]).toContain(item.kind);
      expect(item.qty).toBeGreaterThan(0);
      for (let b = 0; b < map.buildings.length; b += 4) {
        const tx = Math.floor(item.x / map.tileSub);
        const ty = Math.floor(item.y / map.tileSub);
        if (tx > map.buildings[b] && tx < map.buildings[b] + map.buildings[b + 2] - 1 && ty > map.buildings[b + 1] && ty < map.buildings[b + 1] + map.buildings[b + 3] - 1) inside++;
      }
      if (item.kind === ITEM.weapon) expect(item.sub).not.toBe(RULES.startWeapon);
    }
    expect(inside).toBeGreaterThan(120);
  });

  it("collisions, tirs et ligne de vue : murs et caisses bloquent, l'eau et les buissons non", () => {
    const map = emptyMap(10);
    const ts = map.tileSub;
    map.tiles[5 * 10 + 5] = TILE.wall;
    map.tiles[2 * 10 + 5] = TILE.water;
    map.tiles[8 * 10 + 5] = TILE.bush;
    const c = (t: number) => t * ts + (ts >> 1);
    expect(lineOfSight(map, c(1), c(5), c(9), c(5))).toBe(false);
    expect(lineOfSight(map, c(1), c(2), c(9), c(2))).toBe(true);
    expect(lineOfSight(map, c(1), c(8), c(9), c(8))).toBe(true);
    const hit = segmentWallHit(map, c(1), c(5), c(9), c(5))!;
    // Entrée dans la case du mur à x = 5 × ts : fraction (5 ts − c(1)) / (c(9) − c(1)).
    expect(hit.num * (c(9) - c(1))).toBe((5 * ts - c(1)) * hit.den);
    // Le mur repousse un cercle qui le chevauche ; l'eau aussi (infranchissable), pas le buisson.
    expect(circleHitsSolid(map, 5 * ts - 10, c(5), 20)).toBe(true);
    expect(circleHitsSolid(map, 5 * ts - 30, c(5), 20)).toBe(false);
    expect(circleHitsSolid(map, c(5), c(2), 20)).toBe(true);
    expect(circleHitsSolid(map, c(5), c(8), 20)).toBe(false);
    // En dehors de la carte : infranchissable.
    expect(circleHitsSolid(map, 5, c(4), 20)).toBe(true);
  });
});
