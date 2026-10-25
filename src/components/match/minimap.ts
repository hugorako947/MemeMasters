/**
 * Mini-carte (canvas 2D) : la carte dessinée une fois (un pixel par case), puis à chaque mise à jour la zone
 * actuelle, la prochaine zone et la position du joueur. Elle ne montre jamais les autres participants.
 */
import { TILE, type GameMap } from "@/lib/br/map";
import { Z, type MatchState } from "@/lib/br/state";

const TILE_RGB: Record<number, [number, number, number]> = {
  [TILE.floor]: [233, 227, 207],
  [TILE.water]: [90, 180, 226],
  [TILE.wall]: [59, 51, 85],
  [TILE.bush]: [63, 158, 74],
  [TILE.crate]: [201, 138, 75],
};

export function minimapBase(map: GameMap): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = map.size;
  canvas.height = map.size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const image = ctx.createImageData(map.size, map.size);
  for (let i = 0; i < map.tiles.length; i++) {
    const [r, g, b] = TILE_RGB[map.tiles[i]] ?? TILE_RGB[TILE.floor];
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
