/**
 * Rendu d'une partie avec PixiJS (WebGL ou WebGPU), chargé à la demande sur la page de partie seulement.
 * Il lit l'état du moteur sans jamais le modifier, et ne montre au joueur que ce que les règles de vision
 * lui permettent de voir (voir src/lib/br-client/view.ts).
 *
 * - Le monde (carte, objets, tirs, personnages, zone) est dessiné en sous-unités du moteur, puis mis à
 *   l'échelle pour que le champ de vision du moteur occupe l'écran ; des bandes masquent ce qui dépasse
 *   (même champ de vision pour tous, quelle que soit la taille de l'écran).
 * - La carte est découpée en blocs de 16 × 16 cases dessinés une fois ; seuls les blocs à l'écran sont affichés.
 * - Les textes (noms, barres de vie, dégâts) sont dans une couche à l'échelle de l'écran : nets et légers.
 * - Couleurs du monde : identité visuelle de la partie (comme les cartes, elles ne suivent pas le thème) ;
 *   les couleurs des raretés viennent des variables CSS du jeu.
 */
import { Application, Container, Graphics, Rectangle, Sprite, Text, Texture } from "pixi.js";
import { RARITIES, type Rarity } from "@/config/rarities";
import { itemVisible, shotVisible, type DamageEvent } from "@/lib/br-client/view";
import type { RosterEntry } from "@/lib/br-client/training";
import { ITEM, TILE } from "@/lib/br/map";
import { BURN_SHOT } from "@/lib/br/rules";
import { weaponInHand, Z, type MatchState } from "@/lib/br/state";
import { buildPortraitAtlas, PORTRAIT } from "./atlas";

const COLORS = {
  outside: 0x14102a,
  floor: 0xe9e3cf,
  floorInside: 0xf7f2e4,
  grid: 0xdcd4bb,
  water: 0x5ab4e2,
  wall: 0x3b3355,
  wallTop: 0x544a78,
  crate: 0xc98a4b,
  crateEdge: 0x7a4e24,
  bush: 0x3f9e4a,
  ink: 0x1a1238,
  white: 0xffffff,
  scroll: 0x6b2fd6,
  scrollEdge: 0xff3d7f,
  hp: 0x2fbf71,
  hpLow: 0xe5484d,
  shield: 0x4aa3ff,
  shot: 0xffd23f,
  burn: 0xff7a1a,
  heal: 0xff3d7f,
  ammo: [0, 0xf2c94c, 0xe5484d, 0x2fbf71],
} as const;

const CHUNK = 16;
const FONT = "'Bricolage Grotesque Variable', 'Bricolage Grotesque', system-ui, sans-serif";

export interface RendererLabels {
  bot: string;
}

export interface MatchRenderer {
  /** Dessine une image : positions entre le tick précédent (prevX, prevY) et l'actuel selon alpha (0 à 1). */
  draw(s: MatchState, prevX: Int32Array, prevY: Int32Array, alpha: number, visible: Uint8Array): void;
  /** Chiffres de dégâts à faire apparaître au-dessus des personnages touchés. */
  addDamage(events: readonly DamageEvent[], s: MatchState): void;
  /** Images par seconde mesurées (essai de la phase 3). */
  fps(): number;
  /** Renderer réellement utilisé (WebGL ou WebGPU). */
  backend(): string;
  destroy(): void;
}

function cssColor(name: string, fallback: number): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const m = /^#([0-9a-f]{6})$/i.exec(value);
  return m ? parseInt(m[1], 16) : fallback;
}

function rarityColors(): Record<Rarity, number> {
  return Object.fromEntries(RARITIES.map((r) => [r, cssColor(`--color-r-${r}`, 0x8c93a8)])) as Record<Rarity, number>;
}

interface Bubble {
  root: Container;
  weapon: Graphics;
  weaponIndex: number;
  label: Text;
  bar: Graphics;
}

interface FloatingNumber {
  text: Text;
  x: number;
  y: number;
  born: number;
}

export async function createRenderer(host: HTMLElement, s: MatchState, roster: readonly RosterEntry[], me: number, labels: RendererLabels, reducedMotion: boolean): Promise<MatchRenderer> {
  const app = new Application();
  await app.init({
    resizeTo: host,
    background: COLORS.outside,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(2, window.devicePixelRatio || 1),
    autoStart: false,
    preference: "webgl",
  });
  host.appendChild(app.canvas);
  app.canvas.setAttribute("aria-hidden", "true");
  app.canvas.style.display = "block";

  const map = s.map;
  const ts = map.tileSub;
  const size = map.size;
  const world = new Container();
  const overlay = new Container();
  app.stage.addChild(world, overlay);

  // ---- Carte : sol, intérieur des bâtiments, quadrillage léger, puis blocs d'obstacles et de buissons.
  const ground = new Graphics();
  ground.rect(0, 0, size * ts, size * ts).fill(COLORS.floor);
  for (let b = 0; b < map.buildings.length; b += 4) {
    ground.rect(map.buildings[b] * ts, map.buildings[b + 1] * ts, map.buildings[b + 2] * ts, map.buildings[b + 3] * ts).fill(COLORS.floorInside);
  }
  for (let k = 0; k <= size; k += 2) {
    ground.moveTo(k * ts, 0).lineTo(k * ts, size * ts);
    ground.moveTo(0, k * ts).lineTo(size * ts, k * ts);
  }
  ground.stroke({ width: ts / 24, color: COLORS.grid, alpha: 0.7 });
  world.addChild(ground);

  const solids = new Container();
  const items = new Graphics();
  const shots = new Graphics();
  const people = new Container();
  const bushes = new Container();
  const zone = new Graphics();
  world.addChild(solids, items, shots, people, bushes, zone);

  const chunks: { g: Graphics; x: number; y: number; bush: boolean }[] = [];
  for (let cy = 0; cy < size; cy += CHUNK) {
    for (let cx = 0; cx < size; cx += CHUNK) {
      const solid = new Graphics();
      const bush = new Graphics();
      let hasSolid = false;
      let hasBush = false;
      for (let y = cy; y < Math.min(size, cy + CHUNK); y++) {
        // Suites de cases identiques sur une ligne : un seul rectangle.
        let x = cx;
        while (x < Math.min(size, cx + CHUNK)) {
          const t = map.tiles[y * size + x];
          let end = x + 1;
          while (end < Math.min(size, cx + CHUNK) && map.tiles[y * size + end] === t) end++;
          const [px, py, w] = [x * ts, y * ts, (end - x) * ts];
          if (t === TILE.water) {
            solid.rect(px, py, w, ts).fill(COLORS.water);
            hasSolid = true;
          } else if (t === TILE.wall) {
            solid.rect(px, py, w, ts).fill(COLORS.wall);
            solid.rect(px, py, w, ts * 0.22).fill(COLORS.wallTop);
            hasSolid = true;
          } else if (t === TILE.crate) {
            for (let k = x; k < end; k++) {
              solid.roundRect(k * ts + ts * 0.06, py + ts * 0.06, ts * 0.88, ts * 0.88, ts * 0.12).fill(COLORS.crate).stroke({ width: ts * 0.08, color: COLORS.crateEdge });
              solid.moveTo(k * ts + ts * 0.18, py + ts * 0.18).lineTo(k * ts + ts * 0.82, py + ts * 0.82).stroke({ width: ts * 0.06, color: COLORS.crateEdge });
            }
            hasSolid = true;
          } else if (t === TILE.bush) {
            for (let k = x; k < end; k++) bush.circle(k * ts + ts / 2, py + ts / 2, ts * 0.62).fill({ color: COLORS.bush, alpha: 0.78 });
            hasBush = true;
          }
          x = end;
        }
      }
      if (hasSolid) {
        solids.addChild(solid);
        chunks.push({ g: solid, x: cx * ts, y: cy * ts, bush: false });
      } else solid.destroy();
      if (hasBush) {
        bushes.addChild(bush);
        chunks.push({ g: bush, x: cx * ts, y: cy * ts, bush: true });
      } else bush.destroy();
    }
  }

  // ---- Personnages : portrait rond, contour de la rareté, arme ; nom et barre de vie dans la couche écran.
  const atlas = await buildPortraitAtlas(roster.map((r) => r.card));
  const atlasTexture = Texture.from(atlas.canvas);
  const colors = rarityColors();
  const bubbles: Bubble[] = roster.map((entry, i) => {
    const r = s.fighters[i].radius;
    const root = new Container();
    const weapon = new Graphics();
    const frame = atlas.frames.get(entry.card.id) ?? { x: 0, y: 0 };
    const portrait = new Sprite(new Texture({ source: atlasTexture.source, frame: new Rectangle(frame.x, frame.y, PORTRAIT, PORTRAIT) }));
    portrait.anchor.set(0.5);
    portrait.width = portrait.height = 2 * r;
    const ring = new Graphics();
    ring.circle(0, 0, r).stroke({ width: r * 0.22, color: colors[entry.card.rarity] });
    ring.circle(0, 0, r * 1.11).stroke({ width: r * 0.08, color: i === me ? COLORS.white : COLORS.ink });
    if (entry.level > 0) {
      // Étoiles d'évolution : petits losanges dorés au-dessus du portrait.
      for (let k = 0; k < entry.level; k++) {
        const sx = (k - (entry.level - 1) / 2) * r * 0.5;
        ring.poly([sx, -r * 1.42, sx + r * 0.16, -r * 1.24, sx, -r * 1.06, sx - r * 0.16, -r * 1.24]).fill(entry.level === 3 ? COLORS.white : 0xffc83d).stroke({ width: r * 0.05, color: COLORS.ink });
      }
    }
    root.addChild(weapon, portrait, ring);
    people.addChild(root);
    const label = new Text({
      text: entry.bot ? `${labels.bot} · ${entry.name}` : entry.name,
      style: { fontFamily: FONT, fontSize: 12, fontWeight: "700", fill: COLORS.white, stroke: { color: COLORS.ink, width: 3 } },
      resolution: Math.min(2, window.devicePixelRatio || 1),
    });
    label.anchor.set(0.5, 0);
    const bar = new Graphics();
    overlay.addChild(bar, label);
    return { root, weapon, weaponIndex: -2, label, bar };
  });

  /** Arme dessinée à côté du portrait, pointée dans la direction de visée (formes simples et originales). */
  function drawWeapon(g: Graphics, weapon: number, r: number): void {
    g.clear();
    const length = [0.95, 1.25, 1.2, 1.65][weapon] ?? 1;
    const width = [0.3, 0.38, 0.32, 0.24][weapon] ?? 0.3;
    const body = [0x8a8fa8, 0xc0623a, 0x4b4f6b, 0x2f6b4f][weapon] ?? 0x8a8fa8;
    g.roundRect(r * 0.6, -r * width, r * length, r * width * 2, r * 0.14).fill(body).stroke({ width: r * 0.12, color: COLORS.ink });
  }

  // ---- Chiffres de dégâts.
  const floating: FloatingNumber[] = [];
  const DAMAGE_MS = 800;

  // ---- Bandes hors du champ de vision.
  const bands = new Graphics();
  overlay.addChild(bands);

  const backendName = app.renderer.name;
  let bandsFor = "";

  return {
    draw(st, prevX, prevY, alpha, visible) {
      const width = app.screen.width;
      const height = app.screen.height;
      const view = st.rules.view;
      const scale = Math.min(width / (2 * view.halfWidth), height / (2 * view.halfHeight));
      const P = st.p;
      const lerp = (a: number, b: number) => a + (b - a) * alpha;
      const camX = lerp(prevX[me], P.x[me]);
      const camY = lerp(prevY[me], P.y[me]);
      world.scale.set(scale);
      world.position.set(width / 2 - camX * scale, height / 2 - camY * scale);
      const left = camX - view.halfWidth - ts;
      const right = camX + view.halfWidth + ts;
      const top = camY - view.halfHeight - ts;
      const bottom = camY + view.halfHeight + ts;
      const span = CHUNK * ts;
      for (const c of chunks) c.g.visible = c.x + span >= left && c.x <= right && c.y + span >= top && c.y <= bottom;

      // Objets visibles du joueur (champ de vision et ligne de vue, comme pour les bots).
      items.clear();
      const I = st.it;
      for (let k = 0; k < st.itemCount; k++) {
        if (I.kind[k] === ITEM.none || I.x[k] < left || I.x[k] > right || I.y[k] < top || I.y[k] > bottom) continue;
        if (itemVisible(st, me, k)) drawItem(items, I.kind[k], I.sub[k], I.x[k], I.y[k], ts);
      }

      // Tirs visibles (dans le champ de vision du joueur).
      shots.clear();
      const S = st.s;
      for (let k = 0; k < st.shotCount; k++) {
        if (!shotVisible(st, me, k)) continue;
        const x = S.x[k] - S.vx[k] * (1 - alpha);
        const y = S.y[k] - S.vy[k] * (1 - alpha);
        const burn = S.weapon[k] === BURN_SHOT;
        const tail = 0.35;
        shots.moveTo(x - S.vx[k] * tail, y - S.vy[k] * tail).lineTo(x, y).stroke({ width: ts * 0.16, color: burn ? COLORS.burn : COLORS.shot, alpha: 0.9 });
        shots.circle(x, y, ts * 0.13).fill(burn ? COLORS.burn : COLORS.white).stroke({ width: ts * 0.05, color: COLORS.ink });
      }

      // Personnages.
      for (let i = 0; i < st.n; i++) {
        const b = bubbles[i];
        const shown = visible[i] === 1 && P.alive[i] === 1;
        b.root.visible = shown;
        b.label.visible = shown;
        b.bar.visible = shown;
        if (!shown) continue;
        const x = lerp(prevX[i], P.x[i]);
        const y = lerp(prevY[i], P.y[i]);
        b.root.position.set(x, y);
        const w = weaponInHand(st, i);
        if (w !== b.weaponIndex) {
          drawWeapon(b.weapon, w, st.fighters[i].radius);
          b.weaponIndex = w;
        }
        b.weapon.rotation = (P.aim[i] / 256) * Math.PI * 2;
        // Un participant étourdi tremble légèrement (sauf si les animations sont réduites).
        b.root.alpha = P.stun[i] > 0 && !reducedMotion ? 0.75 : 1;
        const sx = width / 2 + (x - camX) * scale;
        const sy = height / 2 + (y - camY) * scale;
        const r = st.fighters[i].radius * scale;
        b.label.position.set(sx, sy + r + 4);
        b.bar.clear();
        if (i !== me) {
          const maxHp = st.fighters[i].maxHp;
          const bw = Math.max(34, r * 2.2);
          const bx = sx - bw / 2;
          const by = sy - r - 16;
          b.bar.rect(bx - 1, by - 1, bw + 2, 7).fill(COLORS.ink);
          b.bar.rect(bx, by, (bw * P.hp[i]) / maxHp, 5).fill(P.hp[i] * 4 < maxHp ? COLORS.hpLow : COLORS.hp);
          if (P.shield[i] > 0) b.bar.rect(bx, by - 4, (bw * Math.min(P.shield[i], maxHp)) / maxHp, 3).fill(COLORS.shield);
        }
      }

      // Zone (« le Scroll ») : tout l'extérieur du cercle actuel est recouvert ; le prochain cercle en pointillés.
      zone.clear();
      const Zs = st.zone;
      const reach = 4 * (view.halfWidth + view.halfHeight);
      zone.circle(Zs[Z.cx], Zs[Z.cy], Zs[Z.r] + reach / 2).stroke({ width: reach, color: COLORS.scroll, alpha: 0.32 });
      zone.circle(Zs[Z.cx], Zs[Z.cy], Zs[Z.r]).stroke({ width: ts * 0.22, color: COLORS.scrollEdge });
      if (Zs[Z.stage] !== 2 && Zs[Z.tr] > 0) {
        // Tirets d'environ 18 px à l'écran (quelle que soit la taille du cercle), seulement près du champ de vision.
        const step = (18 / scale) / Zs[Z.tr];
        const dashes = Math.min(4096, Math.ceil((Math.PI * 2) / step / 2) * 2);
        for (let k = 0; k < dashes; k += 2) {
          const a0 = (k / dashes) * Math.PI * 2;
          const a1 = ((k + 1) / dashes) * Math.PI * 2;
          const x0 = Zs[Z.tx] + Math.cos(a0) * Zs[Z.tr];
          const y0 = Zs[Z.ty] + Math.sin(a0) * Zs[Z.tr];
          if (x0 < left - span || x0 > right + span || y0 < top - span || y0 > bottom + span) continue;
          zone.moveTo(x0, y0).arc(Zs[Z.tx], Zs[Z.ty], Zs[Z.tr], a0, a1);
        }
        zone.stroke({ width: ts * 0.12, color: COLORS.white, alpha: 0.9 });
      }

      // Chiffres de dégâts : ils montent et s'effacent (ils s'effacent seulement si les animations sont réduites).
      const now = performance.now();
      for (let k = floating.length - 1; k >= 0; k--) {
        const f = floating[k];
        const t = (now - f.born) / DAMAGE_MS;
        if (t >= 1) {
          f.text.destroy();
          floating.splice(k, 1);
          continue;
        }
        f.text.position.set(width / 2 + (f.x - camX) * scale, height / 2 + (f.y - camY) * scale - (reducedMotion ? 0 : t * 28));
        f.text.alpha = 1 - t * t;
      }

      // Bandes : rien n'est montré au-delà du champ de vision du moteur.
      if (bandsFor !== `${width}x${height}`) {
        bandsFor = `${width}x${height}`;
        bands.clear();
        const vw = 2 * view.halfWidth * scale;
        const vh = 2 * view.halfHeight * scale;
        const bx = (width - vw) / 2;
        const by = (height - vh) / 2;
        if (bx > 0.5) bands.rect(0, 0, bx, height).rect(width - bx, 0, bx, height).fill(COLORS.outside);
        if (by > 0.5) bands.rect(0, 0, width, by).rect(0, height - by, width, by).fill(COLORS.outside);
      }

      app.render();
    },

    addDamage(events, st) {
      for (const e of events) {
        if (floating.length > 40) floating.shift()?.text.destroy();
        const received = e.slot === me;
        const text = new Text({
          text: received ? `−${e.amount}` : String(e.amount),
          style: { fontFamily: FONT, fontSize: e.mine ? 18 : 14, fontWeight: "800", fill: received ? COLORS.hpLow : e.mine ? 0xffd23f : COLORS.white, stroke: { color: COLORS.ink, width: 4 } },
          resolution: Math.min(2, window.devicePixelRatio || 1),
        });
        text.anchor.set(0.5, 1);
        overlay.addChild(text);
        const jitter = ((floating.length % 5) - 2) * st.map.tileSub * 0.25;
        floating.push({ text, x: st.p.x[e.slot] + jitter, y: st.p.y[e.slot] - st.fighters[e.slot].radius, born: performance.now() });
      }
    },

    fps: () => app.ticker.FPS,
    backend: () => backendName,

    destroy() {
      app.destroy(true, { children: true, texture: true });
      atlasTexture.destroy(true);
    },
  };
}

/** Objets au sol : formes simples et lisibles, avec un contour (jamais la couleur seule). */
function drawItem(g: Graphics, kind: number, sub: number, x: number, y: number, ts: number): void {
  const u = ts * 0.32;
  if (kind === ITEM.weapon) {
    g.roundRect(x - u * 1.3, y - u * 0.45, u * 2.6, u * 0.9, u * 0.2).fill([0x8a8fa8, 0xc0623a, 0x4b4f6b, 0x2f6b4f][sub] ?? 0x8a8fa8).stroke({ width: u * 0.22, color: COLORS.white });
    g.roundRect(x - u * 1.3, y - u * 0.45, u * 2.6, u * 0.9, u * 0.2).stroke({ width: u * 0.1, color: COLORS.ink });
  } else if (kind === ITEM.ammo) {
    g.roundRect(x - u * 0.8, y - u * 0.6, u * 1.6, u * 1.2, u * 0.15).fill(COLORS.ammo[sub] ?? 0xf2c94c).stroke({ width: u * 0.16, color: COLORS.ink });
    g.rect(x - u * 0.5, y - u * 0.15, u, u * 0.3).fill(COLORS.ink);
  } else if (kind === ITEM.heal) {
    g.roundRect(x - u * 0.85, y - u * 0.85, u * 1.7, u * 1.7, u * 0.3).fill(COLORS.white).stroke({ width: u * 0.16, color: COLORS.ink });
    g.rect(x - u * 0.18, y - u * 0.6, u * 0.36, u * 1.2).rect(x - u * 0.6, y - u * 0.18, u * 1.2, u * 0.36).fill(COLORS.heal);
  } else if (kind === ITEM.vest) {
    g.poly([x - u, y - u * 0.8, x + u, y - u * 0.8, x + u * 0.8, y + u * 0.3, x, y + u, x - u * 0.8, y + u * 0.3]).fill(COLORS.shield).stroke({ width: u * 0.16, color: COLORS.ink });
  }
}
