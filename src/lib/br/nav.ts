/**
 * Navigation des bots (conception §7.3), en entiers.
 *
 * - Graphe : les sommets de la grille des tuiles (coins des tuiles) où le plus gros personnage
 *   peut se tenir, dans la région principale de la carte (voir mainVertices). Huit voisins ; une
 *   diagonale n'est permise que si les deux sommets qu'elle longe sont praticables (pas de coin
 *   coupé). Coût : 10 en ligne droite, 14 en diagonale.
 * - Distance vers la zone : carte des distances depuis le cercle visé (Dijkstra), calculée une
 *   fois par cercle et partagée par tous les bots.
 * - Chemin vers un but précis : A* borné (nombre de nœuds explorés limité) ; s'il n'atteint pas
 *   le but, il mène au sommet exploré le plus proche du but.
 *
 * Ces données dérivent de la carte seule (jamais modifiée après sa création) : elles sont gardées
 * en cache, hors de l'état de la partie, sans effet sur le résultat.
 */
import { floorDiv, idiv, isqrt } from "./fixed";
import { circleHitsSolid, mainVertices, type GameMap } from "./map";

/** Distance infinie (sommet hors de portée). */
export const FAR = 0x3fffffff;

export interface Nav {
  /** Côté de la grille des sommets (côté de la carte en tuiles + 1). */
  side: number;
  /** Côté d'une tuile, en sous-unités. */
  ts: number;
  /** 1 = sommet de la région principale. */
  walk: Uint8Array;
  /** Dernière carte des distances vers un cercle (centre, rayon) et ce cercle. */
  fieldKey: Int32Array;
  field: Int32Array | null;
}

const navCache = new WeakMap<GameMap, Nav>();

/** Graphe de navigation d'une carte (calculé une fois par carte). */
export function navFor(map: GameMap): Nav {
  let nav = navCache.get(map);
  if (!nav) {
    nav = { side: map.size + 1, ts: map.tileSub, walk: mainVertices(map), fieldKey: new Int32Array(3), field: null };
    navCache.set(map, nav);
  }
  return nav;
}

export const vertexX = (nav: Nav, v: number) => (v % nav.side) * nav.ts;
export const vertexY = (nav: Nav, v: number) => floorDiv(v, nav.side) * nav.ts;

/** Voisins dans un ordre fixe : 4 directions droites, puis 4 diagonales (dx, dy, coût). */
const STEPS = [
  [1, 0, 10],
  [-1, 0, 10],
  [0, 1, 10],
  [0, -1, 10],
  [1, 1, 14],
  [-1, 1, 14],
  [1, -1, 14],
  [-1, -1, 14],
] as const;

/** Voisin praticable de v dans la direction k (−1 sinon). */
function neighbour(nav: Nav, v: number, k: number): number {
  const side = nav.side;
  const x = v % side;
  const y = floorDiv(v, side);
  const [dx, dy] = STEPS[k];
  const nx = x + dx;
  const ny = y + dy;
  if (nx < 0 || ny < 0 || nx >= side || ny >= side) return -1;
  const u = ny * side + nx;
  if (!nav.walk[u]) return -1;
  if (dx !== 0 && dy !== 0 && (!nav.walk[y * side + nx] || !nav.walk[ny * side + x])) return -1;
  return u;
}

/** Sommet praticable le plus proche d'un point, cherché à `reach` tuiles autour (2 par défaut : 6 × 6 sommets) ; −1 si aucun. */
export function nearestVertex(nav: Nav, x: number, y: number, reach = 2): number {
  const tx = floorDiv(x, nav.ts);
  const ty = floorDiv(y, nav.ts);
  let best = -1;
  let bestD = 0;
  for (let vy = ty - reach; vy <= ty + reach + 1; vy++) {
    for (let vx = tx - reach; vx <= tx + reach + 1; vx++) {
      if (vx < 0 || vy < 0 || vx >= nav.side || vy >= nav.side) continue;
      const v = vy * nav.side + vx;
      if (!nav.walk[v]) continue;
      const dx = vx * nav.ts - x;
      const dy = vy * nav.ts - y;
      const d = dx * dx + dy * dy;
      if (best < 0 || d < bestD) {
        best = v;
        bestD = d;
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------- tas binaire (clé puis numéro de sommet)

let heapKey = new Int32Array(1024);
let heapNode = new Int32Array(1024);
let heapSize = 0;

const before = (a: number, b: number) => heapKey[a] < heapKey[b] || (heapKey[a] === heapKey[b] && heapNode[a] < heapNode[b]);

function heapSwap(a: number, b: number): void {
  const k = heapKey[a];
  const n = heapNode[a];
  heapKey[a] = heapKey[b];
  heapNode[a] = heapNode[b];
  heapKey[b] = k;
  heapNode[b] = n;
}

function heapPush(key: number, node: number): void {
  if (heapSize === heapKey.length) {
    const k = new Int32Array(heapSize * 2);
    const n = new Int32Array(heapSize * 2);
    k.set(heapKey);
    n.set(heapNode);
    heapKey = k;
    heapNode = n;
  }
  let i = heapSize++;
  heapKey[i] = key;
  heapNode[i] = node;
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (!before(i, parent)) break;
    heapSwap(i, parent);
    i = parent;
  }
}

/** Retire le plus petit élément (à lire avant dans heapKey[0], heapNode[0]). */
function heapPop(): void {
  heapSize--;
  heapKey[0] = heapKey[heapSize];
  heapNode[0] = heapNode[heapSize];
  let i = 0;
  for (;;) {
    const l = 2 * i + 1;
    const r = l + 1;
    let m = i;
    if (l < heapSize && before(l, m)) m = l;
    if (r < heapSize && before(r, m)) m = r;
    if (m === i) return;
    heapSwap(i, m);
    i = m;
  }
}

// ---------------------------------------------------------------- distance vers la zone

/**
 * Distance (10 par tuile en ligne droite, 14 en diagonale) de chaque sommet au cercle visé :
 * 0 pour les sommets à plus de 2 tuiles à l'intérieur du bord (le personnage y est entièrement),
 * ou, si le cercle est trop petit, pour le sommet le plus proche de son centre.
 */
export function zoneField(nav: Nav, cx: number, cy: number, r: number): Int32Array {
  const key = nav.fieldKey;
  if (nav.field && key[0] === cx && key[1] === cy && key[2] === r) return nav.field;
  const n = nav.walk.length;
  const dist = new Int32Array(n).fill(FAR);
  heapSize = 0;
  const inner = r - 2 * nav.ts;
  let nearest = -1;
  let nearestD = 0;
  for (let v = 0; v < n; v++) {
    if (!nav.walk[v]) continue;
    const dx = vertexX(nav, v) - cx;
    const dy = vertexY(nav, v) - cy;
    const d = dx * dx + dy * dy;
    if (inner > 0 && d <= inner * inner) {
      dist[v] = 0;
      heapPush(0, v);
    }
    if (nearest < 0 || d < nearestD) {
      nearest = v;
      nearestD = d;
    }
  }
  if (heapSize === 0 && nearest >= 0) {
    dist[nearest] = 0;
    heapPush(0, nearest);
  }
  while (heapSize > 0) {
    const d = heapKey[0];
    const v = heapNode[0];
    heapPop();
    if (d > dist[v]) continue;
    for (let k = 0; k < 8; k++) {
      const u = neighbour(nav, v, k);
      if (u < 0) continue;
      const nd = d + STEPS[k][2];
      if (nd < dist[u]) {
        dist[u] = nd;
        heapPush(nd, u);
      }
    }
  }
  key[0] = cx;
  key[1] = cy;
  key[2] = r;
  nav.field = dist;
  return dist;
}

/** Voisin qui rapproche le plus du cercle visé (−1 : déjà dedans, ou sommet hors de portée). */
export function fieldNext(nav: Nav, field: Int32Array, v: number): number {
  let best = -1;
  let bestD = field[v];
  for (let k = 0; k < 8; k++) {
    const u = neighbour(nav, v, k);
    if (u >= 0 && field[u] < bestD) {
      best = u;
      bestD = field[u];
    }
  }
  return best;
}

// ---------------------------------------------------------------- A* borné

let scratch = 0;
let gScore = new Int32Array(1);
let parent = new Int32Array(1);
let seen = new Int32Array(1);
let done = new Int32Array(1);
let generation = 0;

/** Distance « octile » (10 en ligne droite, 14 en diagonale) entre deux sommets. */
function octile(nav: Nav, a: number, b: number): number {
  const dx = Math.abs((a % nav.side) - (b % nav.side));
  const dy = Math.abs(floorDiv(a, nav.side) - floorDiv(b, nav.side));
  return dx > dy ? 10 * dx + 4 * dy : 10 * dy + 4 * dx;
}

/**
 * Chemin de `start` à `goal` (sommets praticables), en explorant au plus `maxNodes` sommets.
 * Écrit dans out[offset…] les angles du chemin (sans le départ, jusqu'au but ou au sommet exploré
 * le plus proche du but), au plus `cap` points ; renvoie leur nombre (0 : aucun chemin utile).
 * Entre deux points écrits, le chemin est une ligne droite (horizontale, verticale ou diagonale) praticable.
 */
export function findPath(nav: Nav, start: number, goal: number, maxNodes: number, out: Int32Array, offset: number, cap: number): number {
  if (start < 0 || goal < 0 || start === goal) return 0;
  const n = nav.walk.length;
  if (scratch !== n) {
    scratch = n;
    gScore = new Int32Array(n);
    parent = new Int32Array(n);
    seen = new Int32Array(n);
    done = new Int32Array(n);
    generation = 0;
  }
  if (++generation > 0x3fffffff) {
    seen.fill(0);
    done.fill(0);
    generation = 1;
  }
  const gen = generation;
  heapSize = 0;
  gScore[start] = 0;
  parent[start] = -1;
  seen[start] = gen;
  // Clé : f × 65 536 + h (à f égal, le plus avancé d'abord), puis numéro de sommet.
  heapPush(octile(nav, start, goal) * 65536 + octile(nav, start, goal), start);
  let best = start;
  let bestH = octile(nav, start, goal);
  let expanded = 0;
  while (heapSize > 0 && expanded < maxNodes) {
    const v = heapNode[0];
    heapPop();
    if (done[v] === gen) continue;
    done[v] = gen;
    expanded++;
    const h = octile(nav, v, goal);
    if (h < bestH || (h === bestH && gScore[v] < gScore[best])) {
      best = v;
      bestH = h;
    }
    if (v === goal) break;
    for (let k = 0; k < 8; k++) {
      const u = neighbour(nav, v, k);
      if (u < 0 || done[u] === gen) continue;
      const g = gScore[v] + STEPS[k][2];
      if (seen[u] === gen && g >= gScore[u]) continue;
      seen[u] = gen;
      gScore[u] = g;
      parent[u] = v;
      const hu = octile(nav, u, goal);
      heapPush((g + hu) * 65536 + hu, u);
    }
  }
  if (best === start) return 0;
  // Remonte le chemin, puis garde seulement les angles (changements de direction) et l'arrivée.
  let length = 0;
  for (let v = best; v !== start; v = parent[v]) length++;
  const nodes = new Int32Array(length);
  for (let v = best, k = length - 1; v !== start; v = parent[v], k--) nodes[k] = v;
  let count = 0;
  let prev = start;
  for (let k = 0; k < length && count < cap; k++) {
    const v = nodes[k];
    const next = k + 1 < length ? nodes[k + 1] : -1;
    if (next >= 0 && v - prev === next - v) {
      prev = v;
      continue;
    }
    out[offset + count++] = v;
    prev = v;
  }
  return count;
}

// ---------------------------------------------------------------- ligne droite

/** Un cercle de rayon r va en ligne droite de (x0, y0) à (x1, y1) sans toucher d'obstacle (contrôle tous les 8 unités). */
export function clearPath(map: GameMap, x0: number, y0: number, x1: number, y1: number, r: number): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(1, idiv(isqrt(dx * dx + dy * dy) + 127, 128));
  for (let k = 1; k <= steps; k++) {
    if (circleHitsSolid(map, x0 + idiv(dx * k, steps), y0 + idiv(dy * k, steps), r)) return false;
  }
  return true;
}
