/**
 * Dessin de l'arène (canvas 2D). Le joueur local est toujours en bas.
 * Positions interpolées entre deux ticks pour un mouvement fluide.
 */
import { canDeployAt, type BattleEvent, type BattleState, type Side, type Tower, type Unit } from "@/lib/battle/engine";
import { ARENA } from "@/lib/battle/rules";

export interface Effect {
  kind: "shot" | "damage" | "puff" | "spark";
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  text?: string;
  born: number;
  life: number;
  color: string;
}

const SIDE_COLOR: Record<Side, string> = { a: "#2d6bff", b: "#ff3d7f" };
const RARITY_RING: Record<string, string> = {
  commune: "#8a93a6", rare: "#2d7bff", epique: "#8b3dff", legendaire: "#f5b400",
  brainrot: "#ff5fd2", superbrainrot: "#00d8e6", godlevel: "#ffd23f",
};

export interface DrawInput {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  state: BattleState;
  prev: Map<number, { x: number; y: number }>;
  alpha: number;
  images: Map<string, HTMLImageElement>;
  effects: Effect[];
  now: number;
  local: Side;
  selected: boolean;
}

export function drawArena(d: DrawInput) {
  const { ctx, width, height, state } = d;
  const s = width / ARENA.W;
  const flip = d.local === "b";
  const X = (x: number) => (flip ? ARENA.W - x : x) * s;
  const Y = (y: number) => (flip ? ARENA.H - y : y) * s;
  ctx.clearRect(0, 0, width, height);

  // Herbe en damier.
  const tile = 2_000 * s;
  for (let i = 0; i < ARENA.W / 2_000; i++) {
    for (let j = 0; j < ARENA.H / 2_000; j++) {
      ctx.fillStyle = (i + j) % 2 === 0 ? "#7fd36b" : "#74c862";
      ctx.fillRect(i * tile, j * tile, tile + 1, tile + 1);
    }
  }
  // Rivière et ponts.
  const riverTop = Y(flip ? ARENA.RIVER_BOTTOM : ARENA.RIVER_TOP);
  const riverH = (ARENA.RIVER_BOTTOM - ARENA.RIVER_TOP) * s;
  ctx.fillStyle = "#4aa8ff";
  ctx.fillRect(0, riverTop, width, riverH);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  for (let x = 0; x < width; x += 18) ctx.fillRect(x + ((d.now / 60) % 18), riverTop + riverH * 0.45, 8, 2);
  for (const bx of ARENA.BRIDGES) {
    ctx.fillStyle = "#c9a36b";
    ctx.fillRect(X(bx) - ARENA.BRIDGE_HALF * s, riverTop - 4, ARENA.BRIDGE_HALF * 2 * s, riverH + 8);
    ctx.strokeStyle = "#8a6a3d";
    ctx.lineWidth = 2;
    ctx.strokeRect(X(bx) - ARENA.BRIDGE_HALF * s, riverTop - 4, ARENA.BRIDGE_HALF * 2 * s, riverH + 8);
  }
  // Zone où l'on peut poser (quand une carte est choisie).
  if (d.selected) {
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    for (let y = 0; y < ARENA.H; y += 500) {
      for (const half of [0, 1]) {
        const x = half === 0 ? 4_500 : 13_500;
        if (canDeployAt(state, d.local, x, y + 250)) ctx.fillRect(half === 0 ? 0 : width / 2, Y(flip ? y + 500 : y), width / 2, 500 * s);
      }
    }
  }

  // Tours.
  for (const t of state.towers) drawTower(ctx, t, X, Y, s);

  // Cartes en cours d'apparition.
  for (const p of state.pending) {
    const left = Math.max(0, p.tick - state.tick);
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(X(p.x), Y(p.y), 780 * s, 0, Math.PI * 2);
    ctx.fillStyle = SIDE_COLOR[p.side];
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(X(p.x), Y(p.y), 880 * s, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - left / 20));
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Unités (interpolées).
  for (const u of state.units) {
    const p = d.prev.get(u.id) ?? u;
    const x = p.x + (u.x - p.x) * d.alpha;
    const y = p.y + (u.y - p.y) * d.alpha;
    drawUnit(ctx, u, X(x), Y(y), s, d.images.get(u.cardId), state.templates[u.cardId]?.rarity ?? "commune");
  }

  // Effets : tirs, étincelles, dégâts, fumée.
  for (const e of d.effects) {
    const t = (d.now - e.born) / e.life;
    if (t >= 1) continue;
    ctx.globalAlpha = 1 - t;
    if (e.kind === "shot" && e.x2 !== undefined && e.y2 !== undefined) {
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(X(e.x), Y(e.y));
      ctx.lineTo(X(e.x2), Y(e.y2));
      ctx.stroke();
    } else if (e.kind === "damage") {
      ctx.fillStyle = e.color;
      ctx.font = `800 ${Math.max(11, 700 * s)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(26,18,56,0.8)";
      ctx.lineWidth = 3;
      ctx.strokeText(e.text ?? "", X(e.x), Y(e.y) - t * 30);
      ctx.fillText(e.text ?? "", X(e.x), Y(e.y) - t * 30);
    } else {
      ctx.beginPath();
      ctx.arc(X(e.x), Y(e.y), (e.kind === "puff" ? 500 + t * 900 : 300 + t * 500) * s, 0, Math.PI * 2);
      ctx.fillStyle = e.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawTower(ctx: CanvasRenderingContext2D, t: Tower, X: (x: number) => number, Y: (y: number) => number, s: number) {
  const size = (t.kind === "king" ? 2_800 : 2_200) * s;
  const x = X(t.x) - size / 2;
  const y = Y(t.y) - size / 2;
  if (t.hp <= 0) {
    ctx.fillStyle = "#8a8f99";
    ctx.beginPath();
    ctx.arc(X(t.x), Y(t.y), size * 0.42, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.fillStyle = "#1a1238";
  ctx.fillRect(x - 2, y + 3, size + 4, size + 2);
  ctx.fillStyle = SIDE_COLOR[t.side];
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(x + size * 0.15, y + size * 0.15, size * 0.7, size * 0.25);
  ctx.font = `${size * 0.42}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(t.kind === "king" ? "👑" : "🏰", X(t.x), Y(t.y) + size * 0.08);
  ctx.textBaseline = "alphabetic";
  bar(ctx, x, y - 9, size, t.hp / Math.max(1, t.maxHp), SIDE_COLOR[t.side], `${t.hp}`);
}

function drawUnit(ctx: CanvasRenderingContext2D, u: Unit, x: number, y: number, s: number, img: HTMLImageElement | undefined, rarity: string) {
  const r = 780 * s; // plus grand que la zone de collision, pour rester lisible sur téléphone
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = "#fff";
  ctx.fill();
  if (img?.complete) {
    ctx.clip();
    ctx.drawImage(img, x - r * 1.25, y - r, r * 2.5, r * 2);
  }
  ctx.restore();
  ctx.lineWidth = 3;
  ctx.strokeStyle = SIDE_COLOR[u.side];
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = RARITY_RING[rarity];
  ctx.beginPath();
  ctx.arc(x, y, r + 3, 0, Math.PI * 2);
  ctx.stroke();
  if (u.stunned > 0) {
    ctx.font = `${r}px system-ui`;
    ctx.textAlign = "center";
    ctx.fillText("💫", x, y - r - 2);
  }
  bar(ctx, x - r, y - r - 8, r * 2, u.hp / u.maxHp, SIDE_COLOR[u.side]);
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, ratio: number, color: string, label?: string) {
  ctx.fillStyle = "rgba(26,18,56,0.75)";
  ctx.fillRect(x, y, w, 5);
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * ratio), 3);
  if (label) {
    ctx.font = "700 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "rgba(26,18,56,0.9)";
    ctx.lineWidth = 3;
    ctx.strokeText(label, x + w / 2, y - 3);
    ctx.fillText(label, x + w / 2, y - 3);
  }
}

/** Transforme les événements d'un tick en effets visuels. */
export function effectsFrom(events: BattleEvent[], state: BattleState, now: number): Effect[] {
  const pos = (id: number) => state.units.find((u) => u.id === id) ?? state.towers.find((t) => t.id === id);
  const out: Effect[] = [];
  for (const e of events) {
    if (e.type === "hit") {
      const from = pos(e.from);
      const to = pos(e.to);
      if (!to) continue;
      if (from && e.ranged) out.push({ kind: "shot", x: from.x, y: from.y, x2: to.x, y2: to.y, born: now, life: 160, color: e.special ? "#ffd23f" : "#ffffff" });
      if (e.special) out.push({ kind: "spark", x: to.x, y: to.y, born: now, life: 300, color: "rgba(255,210,63,0.8)" });
      out.push({ kind: "damage", x: to.x + ((e.damage * 37) % 600) - 300, y: to.y - 600, text: `-${e.damage}`, born: now, life: 650, color: e.special ? "#ffd23f" : "#ffffff" });
    } else if (e.type === "death") {
      out.push({ kind: "puff", x: e.x, y: e.y, born: now, life: 450, color: "rgba(255,255,255,0.7)" });
    }
  }
  return out;
}
