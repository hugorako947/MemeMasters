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
  return { size, tileSub: RULES.map.tileSub, tiles: new Uint8Array(size * size), buildings: new Int32Array(0), buildingTypes: new Int32Array(0) };
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
  }, 60_000);

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

  it("derrière une porte du haut ou du bas, aucun mur (cloison) sur trois cases de large", () => {
    for (const seed of [11, 12, 13, 14, 15, 16, 17, 18]) {
      const { map } = build(seed);
      const at = (i: number, j: number) => map.tiles[j * map.size + i];
      for (let b = 0; b < map.buildings.length; b += 4) {
        const [x, y, w, h] = [map.buildings[b], map.buildings[b + 1], map.buildings[b + 2], map.buildings[b + 3]];
        for (let i = x + 1; i < x + w - 1; i++) {
          for (const [wall, inside] of [[y, y + 1], [y + h - 1, y + h - 2]]) {
            if (at(i, wall) === TILE.wall) continue;
            for (let di = -1; di <= 1; di++) if (i + di > x && i + di < x + w - 1) expect(at(i + di, inside)).not.toBe(TILE.wall);
          }
        }
      }
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
      // Toutes les armes se ramassent depuis 3A (plus de gun de départ exclu du butin).
      if (item.kind === ITEM.weapon) expect(item.sub).toBeGreaterThanOrEqual(0);
    }
    expect(inside).toBeGreaterThan(120);
  });

  it("aucun recoin réservé aux petits personnages : le plus gros atteint tout le butin et tous les points d'apparition", () => {
    // Vérification indépendante du générateur : positions tous les 16 unités où un cercle du plus gros rayon
    // tient sans toucher d'obstacle, reliées de proche en proche (8 voisins).
    const step = 16 * SUB;
    for (let seed = 1; seed <= 16; seed++) {
      const { map, rng } = build(seed);
      const w = (map.size * map.tileSub) / step + 1;
      const fits = new Uint8Array(w * w);
      for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) fits[y * w + x] = circleHitsSolid(map, x * step, y * step, MAX_RADIUS) ? 0 : 1;
      const region = new Int32Array(w * w).fill(-1);
      let regions = 0;
      for (let start = 0; start < w * w; start++) {
        if (!fits[start] || region[start] >= 0) continue;
        const stack = [start];
        region[start] = regions;
        while (stack.length) {
          const v = stack.pop()!;
          const [x, y] = [v % w, Math.floor(v / w)];
          for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1], [x + 1, y + 1], [x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1]]) {
            const u = ny * w + nx;
            if (nx >= 0 && ny >= 0 && nx < w && ny < w && fits[u] && region[u] < 0) {
              region[u] = regions;
              stack.push(u);
            }
          }
        }
        regions++;
      }
      // Une seule région : personne ne peut se retrouver enfermé.
      expect(regions, `graine ${seed}`).toBe(1);
      const reachable = (px: number, py: number, range: number) => {
        for (let y = Math.max(0, Math.floor((py - range) / step)); y <= Math.min(w - 1, Math.ceil((py + range) / step)); y++) {
          for (let x = Math.max(0, Math.floor((px - range) / step)); x <= Math.min(w - 1, Math.ceil((px + range) / step)); x++) {
            if (fits[y * w + x] && (x * step - px) ** 2 + (y * step - py) ** 2 <= range * range) return true;
          }
        }
        return false;
      };
      const spawns = placeSpawns(map, RULES, rng, 100, MAX_RADIUS);
      for (let i = 0; i < 100; i++) expect(reachable(spawns[2 * i], spawns[2 * i + 1], step), `graine ${seed}, apparition ${i}`).toBe(true);
      for (const item of placeLoot(map, RULES, rng, 100)) expect(reachable(item.x, item.y, RULES.items.pickupRange), `graine ${seed}, objet`).toBe(true);
    }
  }, 60_000);

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
    // Le mur repousse un cercle qui le chevauche ; l'eau (franchissable, 3B) et le buisson, non.
    expect(circleHitsSolid(map, 5 * ts - 10, c(5), 20)).toBe(true);
    expect(circleHitsSolid(map, 5 * ts - 30, c(5), 20)).toBe(false);
    expect(circleHitsSolid(map, c(5), c(2), 20)).toBe(false);
    expect(circleHitsSolid(map, c(5), c(8), 20)).toBe(false);
    // En dehors de la carte : infranchissable.
    expect(circleHitsSolid(map, 5, c(4), 20)).toBe(true);
  });
});
