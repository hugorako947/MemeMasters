/**
 * Grille spatiale des participants en vie (cellules de 256 unités) : collisions des balles,
 * aide à la visée, perception des bots. Donnée dérivée de l'état, reconstruite à chaque usage
 * (buildGrid) : elle ne fait pas partie de l'état et ne change jamais le résultat d'une partie.
 */
import { clamp, floorDiv, idiv } from "./fixed";
import { SUB } from "./rules";
import type { MatchState } from "./state";

/** Côté d'une cellule, en sous-unités. */
export const CELL = 256 * SUB;

let gridSide = 0;
let gridStart = new Int32Array(1);
let gridItems = new Int32Array(1);

function cellCoord(v: number): number {
  return clamp(floorDiv(v, CELL), 0, gridSide - 1);
}

/** Range les participants en vie de l'état dans la grille (à refaire dès que des positions ou des vies changent). */
export function buildGrid(s: MatchState): void {
  const P = s.p;
  gridSide = Math.max(1, idiv(s.map.size * s.map.tileSub + CELL - 1, CELL));
  const cells = gridSide * gridSide;
  if (gridStart.length < cells + 1) gridStart = new Int32Array(cells + 1);
  if (gridItems.length < s.n) gridItems = new Int32Array(s.n);
  gridStart.fill(0, 0, cells + 1);
  for (let i = 0; i < s.n; i++) if (P.alive[i]) gridStart[cellCoord(P.y[i]) * gridSide + cellCoord(P.x[i]) + 1]++;
  for (let c = 0; c < cells; c++) gridStart[c + 1] += gridStart[c];
  const fill = gridStart.slice(0, cells);
  for (let i = 0; i < s.n; i++) if (P.alive[i]) gridItems[fill[cellCoord(P.y[i]) * gridSide + cellCoord(P.x[i])]++] = i;
}

/** Participants en vie dans les cellules qui couvrent le rectangle, par cellule puis par emplacement. */
export function forEachNear(x0: number, y0: number, x1: number, y1: number, visit: (j: number) => void): void {
  const cx0 = cellCoord(x0);
  const cx1 = cellCoord(x1);
  const cy1 = cellCoord(y1);
  for (let cy = cellCoord(y0); cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const c = cy * gridSide + cx;
      for (let k = gridStart[c]; k < gridStart[c + 1]; k++) visit(gridItems[k]);
    }
  }
}
