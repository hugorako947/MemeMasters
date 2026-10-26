/**
 * Mini-carte (canvas 2D) : la carte dessinée une fois (un pixel par case ; redessinée quand une caisse est brisée), puis à chaque mise à jour la zone
 * actuelle, la prochaine zone et la position du joueur. Elle ne montre jamais les autres participants.
 */
import { TILE, type GameMap } from "@/lib/br/map";
import { Z, type MatchState } from "@/lib/br/state";

/** Mêmes couleurs que le monde de la partie (renderer.ts) : herbe, eau, briques, buissons, caisses ; parquet des bâtiments. */
const TILE_RGB: Record<number, [number, number, number]> = {
  [TILE.floor]: [125, 187, 88],
  [TILE.water]: [75, 167, 220],
  [TILE.wall]: [125, 58, 43],
  [TILE.bush]: [44, 122, 55],
  [TILE.crate]: [204, 141, 76],
};
const INSIDE_RGB: [number, number, number] = [216, 176, 122];

export function minimapBase(map: GameMap): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = map.size;
  canvas.height = map.size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const image = ctx.createImageData(map.size, map.size);
  const inside = new Uint8Array(map.tiles.length);
  for (let k = 0; k < map.buildings.length; k += 4) {
    const [bx, by, bw, bh] = [map.buildings[k], map.buildings[k + 1], map.buildings[k + 2], map.buildings[k + 3]];
    for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) if (x >= 0 && y >= 0 && x < map.size && y < map.size) inside[y * map.size + x] = 1;
  }
  for (let i = 0; i < map.tiles.length; i++) {
    const [r, g, b] = inside[i] && map.tiles[i] === TILE.floor ? INSIDE_RGB : (TILE_RGB[map.tiles[i]] ?? TILE_RGB[TILE.floor]);
    image.data[4 * i] = r;
    image.data[4 * i + 1] = g;
    image.data[4 * i + 2] = b;
    image.data[4 * i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export function drawMinimap(canvas: HTMLCanvasElement, base: HTMLCanvasElement, s: MatchState, me: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  const k = width / (s.map.size * s.map.tileSub);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(base, 0, 0, width, height);
  const Zs = s.zone;
  // Extérieur de la zone assombri (le « Scroll »).
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.arc(Zs[Z.cx] * k, Zs[Z.cy] * k, Math.max(0, Zs[Z.r] * k), 0, Math.PI * 2, true);
  ctx.fillStyle = "rgba(107, 47, 214, 0.45)";
  ctx.fill("evenodd");
  ctx.restore();
  ctx.lineWidth = Math.max(1, width / 90);
  ctx.strokeStyle = "#ff3d7f";
  ctx.beginPath();
  ctx.arc(Zs[Z.cx] * k, Zs[Z.cy] * k, Math.max(0, Zs[Z.r] * k), 0, Math.PI * 2);
  ctx.stroke();
  if (Zs[Z.stage] !== 2) {
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(Zs[Z.tx] * k, Zs[Z.ty] * k, Math.max(0, Zs[Z.tr] * k), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Le joueur : un point blanc cerclé, avec sa direction de visée.
  const x = s.p.x[me] * k;
  const y = s.p.y[me] * k;
  const a = (s.p.aim[me] / 256) * Math.PI * 2;
  const r = Math.max(3, width / 40);
  ctx.strokeStyle = "#1a1238";
  ctx.lineWidth = Math.max(1.5, width / 80);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(a) * r * 2.2, y + Math.sin(a) * r * 2.2);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}
