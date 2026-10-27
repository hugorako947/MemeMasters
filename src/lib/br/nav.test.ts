import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "@/config/game.config";
import { circleHitsSolid, generateMap, TILE, type GameMap } from "./map";
import { clearPath, fieldNext, findPath, navFor, nearestVertex, vertexX, vertexY, zoneField } from "./nav";
import { createStreams } from "./rng";
import { resolveRules, SUB } from "./rules";

const RULES = resolveRules(GAME_CONFIG.BATTLE_ROYALE);
const TS = RULES.map.tileSub;
const BIG = 22 * SUB;

function openMap(size = 32): GameMap {
  const tiles = new Uint8Array(size * size);
  for (let i = 0; i < size; i++) for (const [x, y] of [[i, 0], [i, size - 1], [0, i], [size - 1, i]]) tiles[y * size + x] = TILE.water;
  return { size, tileSub: TS, tiles, buildings: new Int32Array(0), buildingTypes: new Int32Array(0) };
}

/** Mur vertical en x = 16, percé d'une ouverture de 2 cases en y = 20 et 21. */
function wallWithGap(): GameMap {
  const map = openMap();
  for (let y = 1; y < 31; y++) if (y !== 20 && y !== 21) map.tiles[y * 32 + 16] = TILE.wall;
  return map;
}

/** Voisins reliés : les 4 droits, et les diagonales dont les deux sommets longés sont praticables (pas de coin coupé). */
const neighbours = (nav: ReturnType<typeof navFor>, v: number) => {
  const x = v % nav.side;
  const y = Math.floor(v / nav.side);
  const walk = (nx: number, ny: number) => nav.walk[ny * nav.side + nx] === 1;
  return [-1, 0, 1]
    .flatMap((dy) => [-1, 0, 1].map((dx) => [dx, dy]))
    .filter(([dx, dy]) => (dx || dy) && (!dx || !dy || (walk(x + dx, y) && walk(x, y + dy))))
    .map(([dx, dy]) => (y + dy) * nav.side + x + dx);
};

describe("navigation des bots", () => {
  it("sommets praticables : le plus gros personnage s'y tient et va de l'un à son voisin sans rien toucher", () => {
    const map = generateMap(RULES, createStreams(5, 4));
    const nav = navFor(map);
    let count = 0;
    for (let v = 0; v < nav.walk.length; v++) {
      if (!nav.walk[v]) continue;
      count++;
      expect(circleHitsSolid(map, vertexX(nav, v), vertexY(nav, v), BIG)).toBe(false);
      for (const u of neighbours(nav, v)) {
        if (!nav.walk[u]) continue;
        expect(clearPath(map, vertexX(nav, v), vertexY(nav, v), vertexX(nav, u), vertexY(nav, u), BIG)).toBe(true);
      }
    }
    expect(count).toBeGreaterThan(5000);
  }, 60_000);

  it("distance vers la zone : nulle dans le cercle visé ; en la descendant, on y arrive de partout", () => {
    const map = wallWithGap();
    const nav = navFor(map);
    const [cx, cy, r] = [26 * TS, 6 * TS, 3 * TS];
    const field = zoneField(nav, cx, cy, r);
    for (let v = 0; v < nav.walk.length; v++) {
      if (!nav.walk[v]) continue;
      expect(field[v]).toBeLessThan(1_000_000);
      let u = v;
      let steps = 0;
      while (field[u] > 0 && steps < 200) {
        const next = fieldNext(nav, field, u);
        expect(next).toBeGreaterThanOrEqual(0);
        expect(field[next]).toBeLessThan(field[u]);
        u = next;
        steps++;
      }
      expect(field[u]).toBe(0);
      // Arrivée dans le cercle visé (à la marge près).
      expect((vertexX(nav, u) - cx) ** 2 + (vertexY(nav, u) - cy) ** 2).toBeLessThanOrEqual(r * r);
    }
    // De l'autre côté du mur, il faut passer par l'ouverture : bien plus long que la ligne droite.
    const left = nearestVertex(nav, 6 * TS, 6 * TS);
    expect(field[left]).toBeGreaterThan(10 * 20);
    // Même cercle : même tableau (calculé une seule fois).
    expect(zoneField(nav, cx, cy, r)).toBe(field);
  });

  it("chemin : contourne le mur par l'ouverture, points voisins deux à deux, toujours le même", () => {
    const map = wallWithGap();
    const nav = navFor(map);
    const start = nearestVertex(nav, 6 * TS, 6 * TS);
    const goal = nearestVertex(nav, 26 * TS, 6 * TS);
    const out = new Int32Array(64);
    const len = findPath(nav, start, goal, 2000, out, 0, 64);
    expect(len).toBeGreaterThan(1);
    expect(out[len - 1]).toBe(goal);
    // Les points gardés sont les angles du chemin, reliés en ligne droite praticable.
    let [x, y] = [vertexX(nav, start), vertexY(nav, start)];
    let lowest = y;
    for (let k = 0; k < len; k++) {
      const [nx, ny] = [vertexX(nav, out[k]), vertexY(nav, out[k])];
      expect(clearPath(map, x, y, nx, ny, BIG)).toBe(true);
      lowest = Math.max(lowest, ny);
      [x, y] = [nx, ny];
    }
    // Des segments praticables d'un côté à l'autre du mur passent forcément par l'ouverture (y = 20 à 22 tuiles).
    expect(lowest).toBeGreaterThanOrEqual(21 * TS);
    const again = new Int32Array(64);
    expect(findPath(nav, start, goal, 2000, again, 0, 64)).toBe(len);
    expect(again).toEqual(out);
  });

  it("chemin borné : au-delà de la limite de nœuds, il s'arrête au plus près du but", () => {
    const map = wallWithGap();
    const nav = navFor(map);
    const start = nearestVertex(nav, 6 * TS, 6 * TS);
    const goal = nearestVertex(nav, 26 * TS, 6 * TS);
    const out = new Int32Array(64);
    const len = findPath(nav, start, goal, 40, out, 0, 64);
    expect(len).toBeGreaterThan(0);
    const end = out[len - 1];
    expect(end).not.toBe(goal);
    const d2 = (v: number) => (vertexX(nav, v) - vertexX(nav, goal)) ** 2 + (vertexY(nav, v) - vertexY(nav, goal)) ** 2;
    expect(d2(end)).toBeLessThan(d2(start));
  });

  it("sommet le plus proche : praticable et tout près ; aucun au milieu d'un lac", () => {
    const map = openMap();
    for (let y = 18; y < 30; y++) for (let x = 18; x < 30; x++) map.tiles[y * 32 + x] = TILE.water;
    const nav = navFor(map);
    const v = nearestVertex(nav, 6 * TS + 100, 7 * TS + 300);
    expect(nav.walk[v]).toBe(1);
    expect([vertexX(nav, v), vertexY(nav, v)]).toEqual([6 * TS, 8 * TS]);
    expect(nearestVertex(nav, 24 * TS, 24 * TS)).toBe(-1);
  });

  it("ligne droite : bloquée par un mur, ou trop près d'un mur pour la taille du personnage", () => {
    const map = wallWithGap();
    expect(clearPath(map, 6 * TS, 6 * TS, 26 * TS, 6 * TS, BIG)).toBe(false);
    expect(clearPath(map, 6 * TS, 6 * TS, 6 * TS, 26 * TS, BIG)).toBe(true);
    // Le long du mur (x = 16 tuiles), centre à 18 unités de lui : un petit (14) passe, un gros (22) non.
    const x = 16 * TS - 18 * SUB;
    expect(clearPath(map, x, 3 * TS, x, 15 * TS, 14 * SUB)).toBe(true);
    expect(clearPath(map, x, 3 * TS, x, 15 * TS, BIG)).toBe(false);
  });
});
