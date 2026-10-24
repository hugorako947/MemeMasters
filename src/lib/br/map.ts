/**
 * Carte du battle royale, générée à partir de la graine (flux « carte » et « butin ») :
 * eau tout autour, lacs, bâtiments simples (murs, portes de 2 cases, parfois une cloison),
 * caisses (couvertures), buissons (cachent sans arrêter les tirs). Toute case praticable
 * doit être accessible ; sinon on tire une autre carte dans la suite du même flux.
 *
 * Tuiles : sol, eau (infranchissable, les balles passent), mur et caisse (bloquent
 * tout), buisson (praticable, cache le joueur).
 */
import { clamp, floorDiv } from "./fixed";
import { nextBelow, nextRange, STREAM } from "./rng";
import { AMMO_KINDS, type Rules } from "./rules";

export const TILE = { floor: 0, water: 1, wall: 2, bush: 3, crate: 4 } as const;
export const ITEM = { none: 0, weapon: 1, ammo: 2, heal: 3, vest: 4 } as const;

export interface GameMap {
  /** Côté de la carte, en tuiles. */
  size: number;
  /** Côté d'une tuile, en sous-unités. */
  tileSub: number;
  tiles: Uint8Array;
  /** Bâtiments : x, y, largeur, hauteur (en tuiles), à la suite. */
  buildings: Int32Array;
}

export interface LootItem {
  kind: number;
  /** Arme : indice de l'arme ; munitions : type (AMMO_KINDS). */
  sub: number;
  /** Arme : balles dans le chargeur ; munitions : nombre ; soin et gilet : 1. */
  qty: number;
  x: number;
  y: number;
}

export const isPassable = (t: number) => t === TILE.floor || t === TILE.bush;
export const blocksShots = (t: number) => t === TILE.wall || t === TILE.crate;

/** Tuile sous un point (en sous-unités) ; en dehors de la carte : mur. */
export function tileAt(map: GameMap, x: number, y: number): number {
  const tx = floorDiv(x, map.tileSub);
  const ty = floorDiv(y, map.tileSub);
  if (tx < 0 || ty < 0 || tx >= map.size || ty >= map.size) return TILE.wall;
  return map.tiles[ty * map.size + tx];
}

/** Vrai si un cercle (centre et rayon en sous-unités) chevauche une tuile infranchissable ou sort de la carte. */
export function circleHitsSolid(map: GameMap, x: number, y: number, r: number): boolean {
  const ts = map.tileSub;
  const tx0 = floorDiv(x - r, ts);
  const tx1 = floorDiv(x + r, ts);
  const ty0 = floorDiv(y - r, ts);
  const ty1 = floorDiv(y + r, ts);
  const r2 = r * r;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const outside = tx < 0 || ty < 0 || tx >= map.size || ty >= map.size;
      if (!outside && isPassable(map.tiles[ty * map.size + tx])) continue;
      const nx = clamp(x, tx * ts, tx * ts + ts);
      const ny = clamp(y, ty * ts, ty * ts + ts);
      if ((x - nx) * (x - nx) + (y - ny) * (y - ny) < r2) return true;
    }
  }
  return false;
}

/**
 * Première tuile qui arrête les tirs (mur, caisse, bord de carte) le long du segment :
 * renvoie la fraction du segment parcourue à l'entrée dans cette tuile (num / den, entre 0 et 1),
 * ou null si le segment est libre. Parcours de grille exact, en entiers.
 */
export function segmentWallHit(map: GameMap, x0: number, y0: number, x1: number, y1: number): { num: number; den: number } | null {
  const ts = map.tileSub;
  let tx = floorDiv(x0, ts);
  let ty = floorDiv(y0, ts);
  const solid = (cx: number, cy: number) => cx < 0 || cy < 0 || cx >= map.size || cy >= map.size || blocksShots(map.tiles[cy * map.size + cx]);
  if (solid(tx, ty)) return { num: 0, den: 1 };
  const dx = x1 - x0;
  const dy = y1 - y0;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  // Distance (le long de l'axe) jusqu'à la prochaine frontière de tuile ; la fraction est nx / adx.
  let nx = dx > 0 ? (tx + 1) * ts - x0 : x0 - tx * ts;
  let ny = dy > 0 ? (ty + 1) * ts - y0 : y0 - ty * ts;
  for (;;) {
    // Frontière la plus proche : comparer nx / adx et ny / ady sans division.
    const xFirst = dx !== 0 && (dy === 0 || nx * ady <= ny * adx);
    if (xFirst) {
      if (nx > adx) return null;
      tx += stepX;
      if (solid(tx, ty)) return { num: nx, den: adx };
      nx += ts;
    } else {
      if (dy === 0 || ny > ady) return null;
      ty += stepY;
      if (solid(tx, ty)) return { num: ny, den: ady };
      ny += ts;
    }
  }
}

/** Ligne de vue : aucun mur ni caisse entre les deux points. */
export function lineOfSight(map: GameMap, x0: number, y0: number, x1: number, y1: number): boolean {
  return segmentWallHit(map, x0, y0, x1, y1) === null;
}

/** Cases praticables accessibles depuis la case praticable la plus proche du centre (1 = accessible). */
export function reachableMask(map: GameMap): Uint8Array {
  const n = map.size;
  const mask = new Uint8Array(n * n);
  const half = n >> 1;
  let start = -1;
  let best = Infinity;
  for (let i = 0; i < n * n; i++) {
    if (!isPassable(map.tiles[i])) continue;
    const d = Math.abs((i % n) - half) + Math.abs(floorDiv(i, n) - half);
    if (d < best) {
      best = d;
      start = i;
    }
  }
  if (start < 0) return mask;
  const stack = [start];
  mask[start] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % n;
    const neighbors = [x > 0 ? i - 1 : -1, x < n - 1 ? i + 1 : -1, i - n, i + n];
    for (const j of neighbors) {
      if (j < 0 || j >= n * n || mask[j] || !isPassable(map.tiles[j])) continue;
      mask[j] = 1;
      stack.push(j);
    }
  }
  return mask;
}

function fullyReachable(map: GameMap): boolean {
  const reach = reachableMask(map);
  for (let i = 0; i < map.tiles.length; i++) if (isPassable(map.tiles[i]) && !reach[i]) return false;
  return true;
}

/**
 * Sommets de la grille des tuiles (coins des tuiles, (taille + 1)² sommets) où le plus gros personnage peut se tenir :
 * les 4 tuiles autour sont praticables, donc tout obstacle est à au moins une tuile (32 unités), plus que la plus
 * grande zone de touche (22 unités). Deux sommets voisins praticables se rejoignent en ligne droite sans rien toucher.
 */
export function walkableVertices(map: GameMap): Uint8Array {
  const n = map.size;
  const side = n + 1;
  const pass = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n && isPassable(map.tiles[y * n + x]);
  const walk = new Uint8Array(side * side);
  for (let vy = 0; vy < side; vy++) {
    for (let vx = 0; vx < side; vx++) walk[vy * side + vx] = pass(vx - 1, vy - 1) && pass(vx, vy - 1) && pass(vx - 1, vy) && pass(vx, vy) ? 1 : 0;
  }
  return walk;
}

/** Régions de sommets praticables reliés (4 voisins) : numéro de région par sommet (−1 hors région), et numéro de la plus grande. */
function vertexRegions(map: GameMap, walk: Uint8Array): { region: Int32Array; main: number } {
  const side = map.size + 1;
  const region = new Int32Array(side * side).fill(-1);
  const stack = new Int32Array(side * side);
  let count = 0;
  let main = -1;
  let mainSize = 0;
  for (let start = 0; start < walk.length; start++) {
    if (!walk[start] || region[start] >= 0) continue;
    let top = 0;
    let size = 0;
    stack[top++] = start;
    region[start] = count;
    while (top > 0) {
      const v = stack[--top];
      size++;
      const x = v % side;
      const neighbors = [x > 0 ? v - 1 : -1, x < side - 1 ? v + 1 : -1, v - side, v + side];
      for (const u of neighbors) {
        if (u < 0 || u >= walk.length || !walk[u] || region[u] >= 0) continue;
        region[u] = count;
        stack[top++] = u;
      }
    }
    // À taille égale, la première trouvée (ordre de lecture) : déterministe.
    if (size > mainSize) {
      mainSize = size;
      main = count;
    }
    count++;
  }
  return { region, main };
}

/** Sommets de la région principale : là où tout personnage, même le plus gros, peut aller (1 = oui). */
export function mainVertices(map: GameMap): Uint8Array {
  const walk = walkableVertices(map);
  const { region, main } = vertexRegions(map, walk);
  for (let v = 0; v < walk.length; v++) walk[v] = region[v] === main && main >= 0 ? 1 : 0;
  return walk;
}

/** Tuiles accessibles à tous (1 = au moins un de leurs coins est dans la région principale) : butin et apparitions n'y sont posés que là. */
export function accessibleMask(map: GameMap): Uint8Array {
  const n = map.size;
  const side = n + 1;
  const main = mainVertices(map);
  const mask = new Uint8Array(n * n);
  for (let ty = 0; ty < n; ty++) {
    for (let tx = 0; tx < n; tx++) {
      const v = ty * side + tx;
      if (isPassable(map.tiles[ty * n + tx]) && (main[v] || main[v + 1] || main[v + side] || main[v + side + 1])) mask[ty * n + tx] = 1;
    }
  }
  return mask;
}

/**
 * Recoins reliés au reste seulement par un passage d'une seule case : un petit personnage y entrerait, pas un gros
 * (butin inaccessible, joueur enfermé). Ils deviennent de l'eau. La région principale n'est pas touchée : aucun de
 * ses sommets n'est le coin d'une tuile de recoin.
 */
function fillPockets(map: GameMap): void {
  const n = map.size;
  const side = n + 1;
  const walk = walkableVertices(map);
  const { region, main } = vertexRegions(map, walk);
  for (let ty = 0; ty < n; ty++) {
    for (let tx = 0; tx < n; tx++) {
      if (!isPassable(map.tiles[ty * n + tx])) continue;
      const corners = [ty * side + tx, ty * side + tx + 1, (ty + 1) * side + tx, (ty + 1) * side + tx + 1];
      const inMain = corners.some((v) => region[v] === main);
      const inPocket = corners.some((v) => region[v] >= 0 && region[v] !== main);
      if (inPocket && !inMain) map.tiles[ty * n + tx] = TILE.water;
    }
  }
  // Les bouts de passage étroit qui ne menaient qu'à ces recoins sont désormais isolés : eux aussi deviennent de l'eau.
  const reach = new Uint8Array(n * n);
  const stack: number[] = [];
  for (let t = 0; t < n * n; t++) {
    const tx = t % n;
    const ty = floorDiv(t, n);
    const corners = [ty * side + tx, ty * side + tx + 1, (ty + 1) * side + tx, (ty + 1) * side + tx + 1];
    if (isPassable(map.tiles[t]) && corners.some((v) => region[v] === main)) {
      reach[t] = 1;
      stack.push(t);
    }
  }
  while (stack.length) {
    const t = stack.pop()!;
    const tx = t % n;
    for (const u of [tx > 0 ? t - 1 : -1, tx < n - 1 ? t + 1 : -1, t - n, t + n]) {
      if (u < 0 || u >= n * n || reach[u] || !isPassable(map.tiles[u])) continue;
      reach[u] = 1;
      stack.push(u);
    }
  }
  for (let t = 0; t < n * n; t++) if (isPassable(map.tiles[t]) && !reach[t]) map.tiles[t] = TILE.water;
}

/**
 * Génère la carte. Jusqu'à 8 essais dans la suite du flux « carte » ; au-delà, les poches isolées deviennent de l'eau.
 * Puis les recoins réservés aux petits personnages deviennent aussi de l'eau (fillPockets).
 */
export function generateMap(rules: Rules, rng: Uint32Array): GameMap {
  let map = attempt(rules, rng);
  for (let tries = 1; tries < 8 && !fullyReachable(map); tries++) map = attempt(rules, rng);
  if (!fullyReachable(map)) {
    const reach = reachableMask(map);
    for (let i = 0; i < map.tiles.length; i++) if (isPassable(map.tiles[i]) && !reach[i]) map.tiles[i] = TILE.water;
  }
  fillPockets(map);
  return map;
}

function attempt(rules: Rules, rng: Uint32Array): GameMap {
  const M = rules.map;
  const n = M.tiles;
  const B = M.border;
  const tiles = new Uint8Array(n * n);
  // Cases réservées : emprise des bâtiments (marge comprise) et abords des portes (jamais de caisse ni de buisson).
  const occupied = new Uint8Array(n * n);
  const keepClear = new Uint8Array(n * n);
  const rand = (lo: number, hi: number) => nextRange(rng, STREAM.map, lo, hi);
  const idx = (x: number, y: number) => y * n + x;

  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (x < B || y < B || x >= n - B || y >= n - B) tiles[idx(x, y)] = TILE.water;

  // Lacs : trois disques proches les uns des autres, pour une forme irrégulière.
  const lakes = rand(M.lakes[0], M.lakes[1]);
  for (let l = 0; l < lakes; l++) {
    const r = rand(M.lakeRadius[0], M.lakeRadius[1]);
    const cx = rand(B + r + 2, n - B - r - 3);
    const cy = rand(B + r + 2, n - B - r - 3);
    for (let blob = 0; blob < 3; blob++) {
      const bx = cx + rand(-r, r);
      const by = cy + rand(-r, r);
      const br = Math.max(1, r - rand(0, 2));
      for (let y = by - br; y <= by + br; y++) {
        for (let x = bx - br; x <= bx + br; x++) {
          if (x < B || y < B || x >= n - B || y >= n - B) continue;
          if ((x - bx) * (x - bx) + (y - by) * (y - by) <= br * br + br) tiles[idx(x, y)] = TILE.water;
        }
      }
    }
  }

  // Bâtiments : murs, 2 ou 3 portes de 2 cases, une cloison percée dans les grands.
  const buildings: number[] = [];
  const wanted = rand(M.buildings[0], M.buildings[1]);
  for (let tries = 0; tries < wanted * 25 && buildings.length < wanted * 4; tries++) {
    const w = rand(M.buildingSize[0], M.buildingSize[1]);
    const h = rand(M.buildingSize[0], M.buildingSize[1]);
    const x = rand(B + 2, n - B - w - 3);
    const y = rand(B + 2, n - B - h - 3);
    if (x < B + 2 || y < B + 2) continue;
    let free = true;
    for (let j = y - 2; j < y + h + 2 && free; j++) for (let i = x - 2; i < x + w + 2 && free; i++) if (tiles[idx(i, j)] !== TILE.floor || occupied[idx(i, j)]) free = false;
    if (!free) continue;
    for (let j = y - 1; j < y + h + 1; j++) for (let i = x - 1; i < x + w + 1; i++) occupied[idx(i, j)] = 1;
    for (let i = x; i < x + w; i++) {
      tiles[idx(i, y)] = TILE.wall;
      tiles[idx(i, y + h - 1)] = TILE.wall;
    }
    for (let j = y; j < y + h; j++) {
      tiles[idx(x, j)] = TILE.wall;
      tiles[idx(x + w - 1, j)] = TILE.wall;
    }
    const doors = rand(2, 3);
    for (let d = 0; d < doors; d++) {
      const side = rand(0, 3);
      const horizontal = side < 2;
      const len = horizontal ? w : h;
      const at = rand(1, len - 3);
      for (let k = 0; k < 2; k++) {
        const [i, j] = horizontal ? [x + at + k, side === 0 ? y : y + h - 1] : [side === 2 ? x : x + w - 1, y + at + k];
        tiles[idx(i, j)] = TILE.floor;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) keepClear[idx(i + di, j + dj)] = 1;
      }
    }
    if (w >= 9) {
      const wx = x + rand(3, w - 4);
      const gap = rand(y + 1, y + h - 3);
      for (let j = y + 1; j < y + h - 1; j++) {
        if (j === gap || j === gap + 1) {
          for (let di = -1; di <= 1; di++) keepClear[idx(wx + di, j)] = 1;
        } else tiles[idx(wx, j)] = TILE.wall;
      }
    }
    buildings.push(x, y, w, h);
  }

  // Caisses : isolées, jamais collées à un obstacle (pas de passage d'une seule case) ni devant une porte.
  for (let tries = 0, placed = 0; tries < M.crates * 10 && placed < M.crates; tries++) {
    const x = rand(B + 1, n - B - 2);
    const y = rand(B + 1, n - B - 2);
    let ok = true;
    for (let dj = -1; dj <= 1 && ok; dj++) for (let di = -1; di <= 1 && ok; di++) if (tiles[idx(x + di, y + dj)] !== TILE.floor || keepClear[idx(x + di, y + dj)]) ok = false;
    if (!ok) continue;
    tiles[idx(x, y)] = TILE.crate;
    placed++;
  }

  // Buissons : petites taches à l'extérieur des bâtiments.
  for (let c = 0; c < M.bushClusters; c++) {
    let x = rand(B + 1, n - B - 2);
    let y = rand(B + 1, n - B - 2);
    const size = rand(M.bushClusterSize[0], M.bushClusterSize[1]);
    for (let k = 0; k < size; k++) {
      const i = idx(x, y);
      if (tiles[i] === TILE.floor && !occupied[i] && !keepClear[i]) tiles[i] = TILE.bush;
      const dir = rand(0, 3);
      x = clamp(x + (dir === 0 ? 1 : dir === 1 ? -1 : 0), B + 1, n - B - 2);
      y = clamp(y + (dir === 2 ? 1 : dir === 3 ? -1 : 0), B + 1, n - B - 2);
    }
  }

  return { size: n, tileSub: M.tileSub, tiles, buildings: Int32Array.from(buildings) };
}

/** Centre d'une tuile, en sous-unités. */
const center = (t: number, ts: number) => t * ts + (ts >> 1);

/**
 * Points d'apparition répartis sur la carte : une grille de cellules couvre la carte,
 * chaque participant reçoit une cellule tirée au hasard et une case libre dans cette cellule
 * (assez grande pour le plus gros personnage).
 */
export function placeSpawns(map: GameMap, rules: Rules, rng: Uint32Array, count: number, maxRadius: number): Int32Array {
  const n = map.size;
  const B = rules.map.border;
  const reach = accessibleMask(map);
  let grid = 1;
  while (grid * grid < count) grid++;
  const span = n - 2 * B;
  const cells = Array.from({ length: grid * grid }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = nextBelow(rng, STREAM.map, i + 1);
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const ok = (tx: number, ty: number) =>
    tx >= 0 && ty >= 0 && tx < n && ty < n && map.tiles[ty * n + tx] === TILE.floor && reach[ty * n + tx] === 1 && !circleHitsSolid(map, center(tx, map.tileSub), center(ty, map.tileSub), maxRadius);
  const spawns = new Int32Array(count * 2);
  for (let p = 0; p < count; p++) {
    const cell = cells[p];
    const cx0 = B + floorDiv((cell % grid) * span, grid);
    const cy0 = B + floorDiv(floorDiv(cell, grid) * span, grid);
    const cw = Math.max(1, floorDiv(span, grid));
    // D'abord le tiers central de la cellule : deux voisins apparaissent assez loin l'un de l'autre pour ne pas se
    // voir dès le départ (tout le monde a le temps de s'équiper). Puis toute la cellule, avec une marge au bord.
    const margin = Math.min(2, cw >> 2);
    const central = Math.max(margin, floorDiv(cw, 3));
    let found = -1;
    for (let tries = 0; tries < 60 && found < 0; tries++) {
      const m = tries < 40 ? central : margin;
      const tx = cx0 + m + nextBelow(rng, STREAM.map, Math.max(1, cw - 2 * m));
      const ty = cy0 + m + nextBelow(rng, STREAM.map, Math.max(1, cw - 2 * m));
      if (ok(tx, ty)) found = ty * n + tx;
    }
    // Repli : la case libre la plus proche du centre de la cellule, en spirale carrée.
    const mx = cx0 + (cw >> 1);
    const my = cy0 + (cw >> 1);
    for (let r = 0; found < 0 && r < n; r++) {
      for (let dy = -r; dy <= r && found < 0; dy++) {
        for (let dx = -r; dx <= r && found < 0; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) === r && ok(mx + dx, my + dy)) found = (my + dy) * n + mx + dx;
        }
      }
    }
    spawns[2 * p] = center(found % n, map.tileSub);
    spawns[2 * p + 1] = center(floorDiv(found, n), map.tileSub);
  }
  return spawns;
}

function pickWeighted(rng: Uint32Array, weights: readonly number[]): number {
  let total = 0;
  for (const w of weights) total += w;
  let roll = nextBelow(rng, STREAM.loot, Math.max(1, total));
  for (let i = 0; i < weights.length; i++) {
    if (roll < weights[i]) return i;
    roll -= weights[i];
  }
  return weights.length - 1;
}

/**
 * Butin de départ (flux « butin ») : PER_PARTICIPANT objets par participant, dont une part
 * dans les bâtiments, le reste sur les cases accessibles. Les mêmes chances pour tout le monde.
 */
export function placeLoot(map: GameMap, rules: Rules, rng: Uint32Array, participants: number): LootItem[] {
  const n = map.size;
  const ts = map.tileSub;
  const L = rules.loot;
  const reach = accessibleMask(map);
  const total = L.perParticipant * participants;
  const inBuildings = map.buildings.length ? floorDiv(total * L.inBuildingsPercent, 100) : 0;
  // Munitions : même répartition que les armes ramassables.
  const ammoWeights = AMMO_KINDS.map((_, kind) => rules.weapons.reduce((s, w, i) => s + (w.ammo === kind && kind > 0 ? (L.weaponWeights[i] ?? 0) : 0), 0));
  const items: LootItem[] = [];
  const free = (tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < n && ty < n && isPassable(map.tiles[ty * n + tx]) && reach[ty * n + tx] === 1;

  for (let k = 0; k < total; k++) {
    let tx = -1;
    let ty = -1;
    if (k < inBuildings) {
      const b = (k % (map.buildings.length >> 2)) * 4;
      const [bx, by, bw, bh] = [map.buildings[b], map.buildings[b + 1], map.buildings[b + 2], map.buildings[b + 3]];
      for (let tries = 0; tries < 30; tries++) {
        const x = bx + 1 + nextBelow(rng, STREAM.loot, bw - 2);
        const y = by + 1 + nextBelow(rng, STREAM.loot, bh - 2);
        if (free(x, y)) {
          tx = x;
          ty = y;
          break;
        }
      }
    }
    while (tx < 0) {
      const x = nextBelow(rng, STREAM.loot, n);
      const y = nextBelow(rng, STREAM.loot, n);
      if (free(x, y)) {
        tx = x;
        ty = y;
      }
    }
    const kind = 1 + pickWeighted(rng, L.weights);
    let sub = 0;
    let qty = 1;
    if (kind === ITEM.weapon) {
      sub = pickWeighted(rng, L.weaponWeights);
      qty = rules.weapons[sub].magazine;
    } else if (kind === ITEM.ammo) {
      sub = pickWeighted(rng, ammoWeights);
      qty = rules.items.ammoBox[sub];
    }
    // Petit décalage pour que deux objets d'une même case ne se superposent pas.
    const quarter = ts >> 2;
    items.push({ kind, sub, qty, x: center(tx, ts) + nextRange(rng, STREAM.loot, -quarter, quarter), y: center(ty, ts) + nextRange(rng, STREAM.loot, -quarter, quarter) });
  }
  return items;
}
