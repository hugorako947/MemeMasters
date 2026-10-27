/**
 * Rendu d'une partie avec PixiJS (WebGL ou WebGPU), chargé à la demande sur l'écran de partie seulement.
 * Il lit l'état du moteur sans jamais le modifier, et ne montre au joueur que ce que les règles de vision
 * lui permettent de voir (voir src/lib/br-client/view.ts).
 *
 * - Le monde (carte, objets, tirs, personnages, effets, zone) est dessiné en sous-unités du moteur, puis mis à
 *   l'échelle pour que le champ de vision du moteur occupe l'écran (une lunette l'agrandit : la vue s'éloigne) ;
 *   des bandes masquent ce qui dépasse (même champ de vision pour tous, quelle que soit la taille de l'écran).
 * - La carte est découpée en blocs de 16 × 16 cases dessinés une fois ; seuls les blocs à l'écran sont affichés.
 *   Les caisses sont à part : elles se fissurent puis disparaissent quand elles sont brisées.
 * - Effets (flashs, traceurs, étincelles, éclats de bois, coups de couteau, éliminations) : petites particules
 *   redessinées à chaque image. Animations réduites : ni secousse, ni eau qui ondule, ni halo qui pulse.
 * - Les textes (noms, barres de vie, dégâts) sont dans une couche à l'échelle de l'écran : nets et légers.
 * - Couleurs du monde : identité visuelle de la partie (comme les cartes, elles ne suivent pas le thème) ;
 *   les couleurs des raretés viennent des variables CSS du jeu.
 */
import { Application, Container, Graphics, Rectangle, Sprite, Text, Texture } from "pixi.js";
import { RARITIES, type Rarity } from "@/config/rarities";
import type { TickEvents } from "@/lib/br-client/events";
import type { RosterEntry } from "@/lib/br-client/training";
import { itemVisible, shotVisible, type DamageEvent } from "@/lib/br-client/view";
import type { KillEntry } from "@/lib/br/engine";
import { ITEM, TILE, tileAt } from "@/lib/br/map";
import { BURN_SHOT, KNIFE } from "@/lib/br/rules";
import { weaponInHand, Z, type MatchState } from "@/lib/br/state";
import { inView } from "@/lib/br/vision";
import { MAX_LEVEL } from "@/lib/economy/duplicates";
import type { Card } from "@/lib/validation/card";
import { buildPortraitAtlas, PORTRAIT } from "./atlas";

const COLORS = {
  outside: 0x14102a,
  grass: 0x7dbb58,
  grassDark: 0x6aa847,
  grassLight: 0x94cc6c,
  tuft: 0x548f38,
  flowers: [0xfff6b0, 0xffffff, 0xffa8cf],
  wood: 0xd8b07a,
  woodLine: 0xb88c56,
  water: 0x4ba7dc,
  waterDeep: 0x3a8cc2,
  foam: 0xbfe6f8,
  brick: 0xa5533d,
  brickDark: 0x7d3a2b,
  mortar: 0xe0cba8,
  shadow: 0x1a1238,
  crate: 0xcc8d4c,
  crateLight: 0xe3ad6d,
  crateDark: 0x8e5a2a,
  crateEdge: 0x55351a,
  bush: 0x3f9e4a,
  bushDark: 0x2c7a37,
  bushLight: 0x68c270,
  ink: 0x1a1238,
  white: 0xffffff,
  steel: 0xe4e9f3,
  silver: 0xcfd8ea,
  scroll: 0x6b2fd6,
  scrollEdge: 0xff3d7f,
  hp: 0x2fbf71,
  hpLow: 0xe5484d,
  shield: 0x4aa3ff,
  shot: 0xffd23f,
  flash: 0xfff1a8,
  burn: 0xff7a1a,
  heal: 0xff3d7f,
  speed: 0x22c7e8,
  ready: 0xffd23f,
  ammo: [0, 0xf2c94c, 0xe5484d, 0x2fbf71],
} as const;

/** Finitions des armes : chaque carte a la sienne (tirée de son identifiant) ; dorée pour une godlevel. */
const FINISHES = [
  { body: 0x5b6178, accent: 0xa3acc8 },
  { body: 0x3f5a37, accent: 0x8aa65c },
  { body: 0x2b2a36, accent: 0xff3d7f },
  { body: 0x2b4c7e, accent: 0x7cc4ff },
  { body: 0x7a4a2a, accent: 0xdaa266 },
  { body: 0xcfd2e0, accent: 0x6b2fd6 },
  { body: 0x1f6f68, accent: 0xffc83d },
] as const;
const GOLD = { body: 0xc9971f, accent: 0xffe7a0 };
type Finish = { body: number; accent: number };

/** Bout du canon (en rayons du personnage) de chaque arme : armes à feu, projectile de brûlure, couteau. */
const MUZZLE = [1.5, 1.9, 1.65, 2.25, 1.5, 1.95];

const CHUNK = 16;
const FONT = "'Bricolage Grotesque Variable', 'Bricolage Grotesque', system-ui, sans-serif";
const MAX_PARTICLES = 500;

export interface RendererLabels {
  bot: string;
}

export interface MatchRenderer {
  /** Dessine une image : positions entre le tick précédent (prevX, prevY) et l'actuel selon alpha (0 à 1). */
  draw(s: MatchState, prevX: Int32Array, prevY: Int32Array, alpha: number, visible: Uint8Array): void;
  /** Chiffres de dégâts à faire apparaître au-dessus des personnages touchés. */
  addDamage(events: readonly DamageEvent[], s: MatchState): void;
  /**
   * Après chaque tick : caisses redessinées, et effets (tirs, impacts, caisses, couteau, éliminations) limités à ce que le
   * joueur voit ; `loud` faux pendant un rattrapage (seules les caisses sont mises à jour).
   */
  addEffects(s: MatchState, events: TickEvents, kills: readonly KillEntry[], visible: Uint8Array, loud: boolean): void;
  /** Images par seconde mesurées. */
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

/** Nombre pseudo-aléatoire stable (0 à 2³² − 1) : détails du décor, finition des armes. */
function hash(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

function finishFor(card: Card): Finish {
  if (card.rarity === "godlevel") return GOLD;
  let h = 0;
  for (let k = 0; k < card.id.length; k++) h = (Math.imul(h, 31) + card.id.charCodeAt(k)) | 0;
  return FINISHES[hash(h) % FINISHES.length];
}

interface Bubble {
  root: Container;
  weapon: Graphics;
  weaponIndex: number;
  aura: Graphics;
  active: Graphics;
  flash: Graphics;
  flashAt: number;
  finish: Finish;
  label: Text;
  bar: Graphics;
}

interface FloatingNumber {
  text: Text;
  x: number;
  y: number;
  born: number;
}

/** Sortes de particules. */
const FX = { spark: 0, chip: 1, puff: 2, ring: 3, flash: 4, swing: 5 } as const;
type FxKind = (typeof FX)[keyof typeof FX];

interface Particle {
  kind: FxKind;
  x: number;
  y: number;
  /** Vitesse en sous-unités par milliseconde. */
  vx: number;
  vy: number;
  born: number;
  life: number;
  color: number;
  size: number;
  rot: number;
  spin: number;
}

/** Arme dessinée à côté du portrait, pointée vers la droite (le conteneur tourne avec la visée) : formes simples et originales. */
function drawWeapon(g: Graphics, weapon: number, r: number, f: Finish): void {
  g.clear();
  const line = { width: r * 0.1, color: COLORS.ink };
  if (weapon === KNIFE) {
    g.roundRect(r * 0.72, -r * 0.13, r * 0.42, r * 0.26, r * 0.08).fill(f.accent).stroke(line);
    g.roundRect(r * 1.1, -r * 0.24, r * 0.09, r * 0.48, r * 0.03).fill(f.body).stroke(line);
    g.poly([r * 1.19, -r * 0.13, r * 1.78, -r * 0.07, r * 1.95, 0, r * 1.78, r * 0.07, r * 1.19, r * 0.13]).fill(COLORS.steel).stroke(line);
    g.moveTo(r * 1.25, 0).lineTo(r * 1.75, 0).stroke({ width: r * 0.04, color: 0xa9b2c6 });
    return;
  }
  switch (weapon) {
    case 1: // Fusil à pompe : canon épais, pompe, crosse.
      g.roundRect(r * 0.55, -r * 0.2, r * 0.45, r * 0.4, r * 0.1).fill(f.accent).stroke(line);
      g.roundRect(r * 0.95, -r * 0.17, r * 0.95, r * 0.34, r * 0.08).fill(f.body).stroke(line);
      g.roundRect(r * 1.2, -r * 0.24, r * 0.35, r * 0.48, r * 0.1).fill(f.accent).stroke(line);
      break;
    case 2: // Mitraillette : corps, chargeur, canon fin.
      g.roundRect(r * 0.6, -r * 0.19, r * 0.85, r * 0.38, r * 0.1).fill(f.body).stroke(line);
      g.roundRect(r * 0.95, r * 0.12, r * 0.18, r * 0.42, r * 0.05).fill(f.accent).stroke(line);
      g.rect(r * 1.42, -r * 0.08, r * 0.23, r * 0.16).fill(f.body).stroke(line);
      break;
    case 3: // Fusil de précision : long canon, lunette.
      g.roundRect(r * 0.55, -r * 0.14, r * 0.7, r * 0.28, r * 0.08).fill(f.accent).stroke(line);
      g.roundRect(r * 1.2, -r * 0.09, r * 1.05, r * 0.18, r * 0.05).fill(f.body).stroke(line);
      g.roundRect(r * 0.85, -r * 0.42, r * 0.55, r * 0.2, r * 0.08).fill(f.body).stroke(line);
      g.circle(r * 1.4, -r * 0.32, r * 0.07).fill(f.accent);
      break;
    default: // Pistolet : culasse, poignée.
      g.roundRect(r * 0.75, r * 0.0, r * 0.22, r * 0.42, r * 0.06).fill(f.accent).stroke(line);
      g.roundRect(r * 0.62, -r * 0.17, r * 0.88, r * 0.34, r * 0.09).fill(f.body).stroke(line);
      g.rect(r * 0.75, -r * 0.17, r * 0.6, r * 0.08).fill(f.accent);
  }
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
  const frameLayer = new Container();
  app.stage.addChild(world, overlay, frameLayer);

  const grounds = new Container();
  const interiors = new Graphics();
  const solids = new Container();
  const waves = new Container();
  const cratesLayer = new Container();
  const items = new Graphics();
  const shots = new Graphics();
  const people = new Container();
  const fx = new Graphics();
  const bushes = new Container();
  const zone = new Graphics();
  world.addChild(grounds, interiors, solids, waves, cratesLayer, items, shots, people, fx, bushes, zone);

  const tile = (x: number, y: number) => (x < 0 || y < 0 || x >= size || y >= size ? -1 : map.tiles[y * size + x]);
  const inside = new Uint8Array(size * size);
  for (let b = 0; b < map.buildings.length; b += 4) {
    const [bx, by, bw, bh] = [map.buildings[b], map.buildings[b + 1], map.buildings[b + 2], map.buildings[b + 3]];
    for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) if (x >= 0 && y >= 0 && x < size && y < size) inside[y * size + x] = 1;
  }

  // ---- Intérieur des bâtiments : parquet.
  for (let b = 0; b < map.buildings.length; b += 4) {
    const [bx, by, bw, bh] = [map.buildings[b] * ts, map.buildings[b + 1] * ts, map.buildings[b + 2] * ts, map.buildings[b + 3] * ts];
    interiors.rect(bx, by, bw, bh).fill(COLORS.wood);
    const plank = ts / 3;
    for (let y = by + plank; y < by + bh; y += plank) interiors.moveTo(bx, y).lineTo(bx + bw, y);
    for (let row = 0, y = by; y < by + bh; y += plank, row++) {
      for (let x = bx + ((row * 0.37) % 1) * ts; x < bx + bw; x += ts * 1.1) interiors.moveTo(x, y).lineTo(x, Math.min(by + bh, y + plank));
    }
    interiors.stroke({ width: ts / 28, color: COLORS.woodLine });
  }

  // ---- Blocs de carte : herbe texturée, murs en briques (avec ombre), eau (écume, reflets), buissons feuillus.
  const chunks: { g: Container; x: number; y: number }[] = [];
  const chunkCount = Math.ceil(size / CHUNK);
  for (let cy = 0; cy < size; cy += CHUNK) {
    for (let cx = 0; cx < size; cx += CHUNK) {
      const x1 = Math.min(size, cx + CHUNK);
      const y1 = Math.min(size, cy + CHUNK);
      const ground = new Graphics();
      ground.rect(cx * ts, cy * ts, (x1 - cx) * ts, (y1 - cy) * ts).fill(COLORS.grass);
      const solid = new Graphics();
      const wave = new Graphics();
      const bush = new Graphics();
      let hasSolid = false;
      let hasWave = false;
      let hasBush = false;
      // Herbe : taches plus sombres ou plus claires, touffes, quelques fleurs (dehors seulement).
      for (let y = cy; y < y1; y++) {
        for (let x = cx; x < x1; x++) {
          const t = map.tiles[y * size + x];
          if (inside[y * size + x] || t === TILE.water || t === TILE.wall) continue;
          const h = hash(y * size + x);
          if (h % 4 === 0) ground.roundRect(x * ts + (h % 7) * ts * 0.06, y * ts + ((h >> 3) % 7) * ts * 0.06, ts * 0.55, ts * 0.42, ts * 0.18).fill({ color: (h >> 5) & 1 ? COLORS.grassDark : COLORS.grassLight, alpha: 0.6 });
        }
      }
      for (let y = cy; y < y1; y++) {
        for (let x = cx; x < x1; x++) {
          const t = map.tiles[y * size + x];
          if (inside[y * size + x] || t === TILE.water || t === TILE.wall) continue;
          const h = hash(y * size + x + 7919);
          if (h % 3 !== 0) continue;
          const px = x * ts + ts * (0.15 + (h % 60) / 100);
          const py = y * ts + ts * (0.25 + ((h >> 8) % 55) / 100);
          const u = ts * 0.09;
          ground.moveTo(px - u, py).lineTo(px - u * 1.6, py - u * 1.8).moveTo(px, py).lineTo(px, py - u * 2.2).moveTo(px + u, py).lineTo(px + u * 1.6, py - u * 1.8);
        }
      }
      ground.stroke({ width: ts * 0.035, color: COLORS.tuft, cap: "round" });
      for (let y = cy; y < y1; y++) {
        for (let x = cx; x < x1; x++) {
          const t = map.tiles[y * size + x];
          if (inside[y * size + x] || t !== TILE.floor) continue;
          const h = hash(y * size + x + 104729);
          if (h % 19 !== 0) continue;
          const px = x * ts + ts * (0.2 + (h % 60) / 100);
          const py = y * ts + ts * (0.2 + ((h >> 8) % 60) / 100);
          ground.circle(px, py, ts * 0.06).fill(COLORS.flowers[h % 3]).circle(px, py, ts * 0.025).fill(0xffc83d);
        }
      }

      for (let y = cy; y < y1; y++) {
        let x = cx;
        while (x < x1) {
          const t = map.tiles[y * size + x];
          let end = x + 1;
          while (end < x1 && map.tiles[y * size + end] === t) end++;
          const [px, py, w] = [x * ts, y * ts, (end - x) * ts];
          if (t === TILE.wall) {
            // Ombre portée sous le mur, puis briques (rangées décalées) et joints.
            if (tile(x, y + 1) !== TILE.wall) solid.rect(px, py + ts, w, ts * 0.22).fill({ color: COLORS.shadow, alpha: 0.22 });
            solid.rect(px, py, w, ts).fill(COLORS.brick);
            const row = ts / 4;
            for (let k = 1; k < 4; k++) solid.moveTo(px, py + k * row).lineTo(px + w, py + k * row);
            for (let k = 0; k < 4; k++) {
              const offset = k % 2 ? ts / 4 : ts * 0.75;
              for (let jx = px + offset; jx < px + w; jx += ts / 2) solid.moveTo(jx, py + k * row).lineTo(jx, py + (k + 1) * row);
            }
            solid.stroke({ width: ts / 30, color: COLORS.mortar });
            solid.rect(px, py, w, ts).stroke({ width: ts / 18, color: COLORS.brickDark });
            hasSolid = true;
          } else if (t === TILE.water) {
            solid.rect(px, py, w, ts).fill(COLORS.water);
            for (let k = x; k < end; k++) {
              const h = hash(y * size + k + 31337);
              if (h % 3 === 0) solid.roundRect(k * ts + ts * 0.2, py + ts * 0.25, ts * 0.6, ts * 0.5, ts * 0.25).fill({ color: COLORS.waterDeep, alpha: 0.5 });
              // Écume le long des rives.
              const foam = ts * 0.1;
              if (tile(k, y - 1) !== TILE.water && y > 0) solid.rect(k * ts, py, ts, foam).fill(COLORS.foam);
              if (tile(k, y + 1) !== TILE.water && y < size - 1) solid.rect(k * ts, py + ts - foam, ts, foam).fill(COLORS.foam);
              if (tile(k - 1, y) !== TILE.water && k > 0) solid.rect(k * ts, py, foam, ts).fill(COLORS.foam);
              if (tile(k + 1, y) !== TILE.water && k < size - 1) solid.rect(k * ts + ts - foam, py, foam, ts).fill(COLORS.foam);
              // Reflets (animés par la couche des vagues).
              if (h % 2 === 0) {
                const wx = k * ts + ts * (0.2 + (h % 40) / 100);
                const wy = py + ts * (0.3 + ((h >> 6) % 40) / 100);
                wave.moveTo(wx, wy).quadraticCurveTo(wx + ts * 0.12, wy - ts * 0.08, wx + ts * 0.24, wy).quadraticCurveTo(wx + ts * 0.36, wy + ts * 0.08, wx + ts * 0.48, wy);
                hasWave = true;
              }
            }
            hasSolid = true;
          } else if (t === TILE.bush) {
            for (let k = x; k < end; k++) {
              const h = hash(y * size + k + 4241);
              const bx = k * ts + ts / 2 + ((h % 9) - 4) * ts * 0.03;
              const by = py + ts / 2 + (((h >> 4) % 9) - 4) * ts * 0.03;
              const big = h % 5 === 0 ? 1.25 : 1;
              bush.circle(bx, by, ts * 0.66 * big).fill(COLORS.bushDark);
              bush.circle(bx - ts * 0.1, by - ts * 0.1, ts * 0.52 * big).fill(COLORS.bush);
              bush.circle(bx + ts * 0.18, by + ts * 0.05, ts * 0.32 * big).fill(COLORS.bush);
              bush.circle(bx - ts * 0.22, by - ts * 0.24, ts * 0.17 * big).fill(COLORS.bushLight);
              bush.circle(bx + ts * 0.12, by - ts * 0.18, ts * 0.11 * big).fill(COLORS.bushLight);
            }
            hasBush = true;
          }
          x = end;
        }
      }
      grounds.addChild(ground);
      chunks.push({ g: ground, x: cx * ts, y: cy * ts });
      for (const [g, has, layer] of [
        [solid, hasSolid, solids],
        [bush, hasBush, bushes],
      ] as const) {
        if (has) {
          layer.addChild(g);
          chunks.push({ g, x: cx * ts, y: cy * ts });
        } else g.destroy();
      }
      if (hasWave) {
        wave.stroke({ width: ts * 0.045, color: COLORS.white, alpha: 0.7, cap: "round" });
        waves.addChild(wave);
        chunks.push({ g: wave, x: cx * ts, y: cy * ts });
      } else wave.destroy();
    }
  }

  // ---- Caisses : un dessin par bloc, refait quand une caisse du bloc est touchée ou brisée.
  const crateChunks = new Map<number, { g: Graphics; tiles: number[] }>();
  for (const t of s.crateTiles) {
    const c = Math.floor(t / size / CHUNK) * chunkCount + Math.floor((t % size) / CHUNK);
    let entry = crateChunks.get(c);
    if (!entry) {
      entry = { g: new Graphics(), tiles: [] };
      crateChunks.set(c, entry);
      cratesLayer.addChild(entry.g);
      chunks.push({ g: entry.g, x: ((c % chunkCount) * CHUNK) * ts, y: (Math.floor(c / chunkCount) * CHUNK) * ts });
    }
    entry.tiles.push(t);
  }
  const crateMax = s.rules.crate.hp;
  function drawCrates(st: MatchState, entry: { g: Graphics; tiles: number[] }): void {
    const g = entry.g;
    g.clear();
    for (const t of entry.tiles) {
      const hp = st.crates[t];
      if (hp <= 0) continue;
      const x = (t % size) * ts;
      const y = Math.floor(t / size) * ts;
      const m = ts * 0.06;
      const w = ts - 2 * m;
      g.rect(x + m, y + ts - m, w, ts * 0.12).fill({ color: COLORS.shadow, alpha: 0.2 });
      g.roundRect(x + m, y + m, w, w, ts * 0.08).fill(COLORS.crate).stroke({ width: ts * 0.07, color: COLORS.crateEdge });
      g.rect(x + m * 2, y + m * 2, w - 2 * m, ts * 0.1).fill(COLORS.crateLight);
      for (const k of [0.36, 0.64]) g.moveTo(x + m * 1.5, y + ts * k).lineTo(x + ts - m * 1.5, y + ts * k);
      g.stroke({ width: ts * 0.035, color: COLORS.crateDark });
      g.moveTo(x + m * 2, y + m * 2).lineTo(x + ts - m * 2, y + ts - m * 2).stroke({ width: ts * 0.07, color: COLORS.crateDark });
      for (const [nx, ny] of [
        [0.18, 0.18],
        [0.82, 0.18],
        [0.18, 0.82],
        [0.82, 0.82],
      ]) g.circle(x + ts * nx, y + ts * ny, ts * 0.035).fill(COLORS.crateEdge);
      // Fissures selon les dégâts.
      const cracks = hp * 4 <= crateMax ? 3 : hp * 2 <= crateMax ? 2 : hp * 4 <= crateMax * 3 ? 1 : 0;
      const h = hash(t);
      for (let k = 0; k < cracks; k++) {
        const sx = x + ts * (0.25 + ((h >> (k * 4)) % 5) * 0.12);
        const sy = y + ts * (0.2 + ((h >> (k * 4 + 2)) % 4) * 0.15);
        g.moveTo(sx, sy)
          .lineTo(sx + ts * 0.1, sy + ts * 0.14)
          .lineTo(sx + ts * 0.04, sy + ts * 0.26)
          .lineTo(sx + ts * 0.16, sy + ts * 0.38);
      }
      if (cracks) g.stroke({ width: ts * 0.04, color: COLORS.ink, cap: "round", join: "round" });
    }
  }
  for (const entry of crateChunks.values()) drawCrates(s, entry);

  // ---- Personnages : ombre, halo de capacité, arme au style de la carte, portrait rond, contour de la rareté.
  const atlas = await buildPortraitAtlas(roster.map((r) => r.card));
  const atlasTexture = Texture.from(atlas.canvas);
  const colors = rarityColors();
  const bubbles: Bubble[] = roster.map((entry, i) => {
    const r = s.fighters[i].radius;
    const root = new Container();
    const shadow = new Graphics().ellipse(0, r * 0.35, r * 1.05, r * 0.75).fill({ color: COLORS.shadow, alpha: 0.22 });
    const aura = new Graphics().circle(0, 0, r * 1.38).stroke({ width: r * 0.16, color: COLORS.ready, alpha: 0.95 });
    aura.circle(0, 0, r * 1.62).stroke({ width: r * 0.08, color: COLORS.ready, alpha: 0.45 });
    const active = new Graphics().circle(0, 0, r * 1.5).fill({ color: colors[entry.card.rarity], alpha: 0.28 }).stroke({ width: r * 0.08, color: COLORS.white, alpha: 0.8 });
    const weapon = new Graphics();
    const frame = atlas.frames.get(entry.card.id) ?? { x: 0, y: 0 };
    const portrait = new Sprite(new Texture({ source: atlasTexture.source, frame: new Rectangle(frame.x, frame.y, PORTRAIT, PORTRAIT) }));
    portrait.anchor.set(0.5);
    portrait.width = portrait.height = 2 * r;
    const ring = new Graphics();
    ring.circle(0, 0, r).stroke({ width: r * 0.22, color: colors[entry.card.rarity] });
    ring.circle(0, 0, r * 1.11).stroke({ width: r * 0.08, color: i === me ? COLORS.white : COLORS.ink });
    if (entry.level > 0) {
      // Évolution : un à trois losanges jaunes au-dessus du portrait (★ à ★★★) ; Divine : anneau argenté et losange blanc.
      const divine = entry.level === MAX_LEVEL;
      if (divine) ring.circle(0, 0, r * 1.22).stroke({ width: r * 0.12, color: COLORS.silver });
      const marks = divine ? 1 : entry.level;
      for (let k = 0; k < marks; k++) {
        const sx = (k - (marks - 1) / 2) * r * 0.5;
        ring.poly([sx, -r * 1.42, sx + r * 0.16, -r * 1.24, sx, -r * 1.06, sx - r * 0.16, -r * 1.24]).fill(divine ? COLORS.white : 0xffd23f).stroke({ width: r * 0.05, color: COLORS.ink });
      }
    }
    const flash = new Graphics().circle(0, 0, r).fill(COLORS.white);
    flash.alpha = 0;
    aura.visible = false;
    active.visible = false;
    root.addChild(shadow, active, aura, weapon, portrait, flash, ring);
    people.addChild(root);
    const label = new Text({
      text: entry.bot ? `${labels.bot} · ${entry.name}` : entry.name,
      style: { fontFamily: FONT, fontSize: 12, fontWeight: "700", fill: COLORS.white, stroke: { color: COLORS.ink, width: 3 } },
      resolution: Math.min(2, window.devicePixelRatio || 1),
    });
    label.anchor.set(0.5, 0);
    const bar = new Graphics();
    overlay.addChild(bar, label);
    return { root, weapon, weaponIndex: -2, aura, active, flash, flashAt: -1e9, finish: finishFor(entry.card), label, bar };
  });

  // ---- Chiffres de dégâts, particules, secousse.
  const floating: FloatingNumber[] = [];
  const DAMAGE_MS = 800;
  const particles: Particle[] = [];
  const shake = { amp: 0, at: 0 };
  const SHAKE_MS = 260;
  let zoom = Math.max(1, s.p.scope[me]);
  let lastFrame = performance.now();

  function emit(p: Omit<Particle, "born" | "rot" | "spin"> & { rot?: number; spin?: number }, now: number): void {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push({ rot: 0, spin: 0, ...p, born: now });
  }

  /** Éclats autour d'un point : `count` particules, vitesse (sous-unités par ms) et durée au hasard dans une plage. */
  function burst(kind: FxKind, x: number, y: number, count: number, color: number, speed: number, life: number, sizeU: number, now: number, dir?: number, spread = Math.PI): void {
    for (let k = 0; k < count; k++) {
      const a = (dir ?? Math.random() * Math.PI * 2) + (dir === undefined ? 0 : (Math.random() * 2 - 1) * spread);
      const v = speed * (0.4 + Math.random() * 0.8);
      emit({ kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.7 + Math.random() * 0.6), color, size: sizeU * (0.7 + Math.random() * 0.6), rot: Math.random() * Math.PI, spin: (Math.random() * 2 - 1) * 0.02 }, now);
    }
  }

  function kick(amp: number, now: number): void {
    if (reducedMotion) return;
    if (amp >= shake.amp * Math.max(0, 1 - (now - shake.at) / SHAKE_MS)) {
      shake.amp = amp;
      shake.at = now;
    }
  }

  // ---- Bandes hors du champ de vision.
  const bands = new Graphics();
  frameLayer.addChild(bands);

  const backendName = app.renderer.name;
  let bandsFor = "";

  return {
    draw(st, prevX, prevY, alpha, visible) {
      const now = performance.now();
      const dt = Math.min(100, now - lastFrame);
      lastFrame = now;
      const width = app.screen.width;
      const height = app.screen.height;
      const view = st.rules.view;
      // Lunette : la vue s'éloigne en douceur jusqu'au champ de vision agrandi (immédiat si les animations sont réduites).
      const targetZoom = Math.max(1, st.p.scope[me]);
      zoom = reducedMotion ? targetZoom : zoom + (targetZoom - zoom) * Math.min(1, dt / 220);
      if (Math.abs(targetZoom - zoom) < 0.01) zoom = targetZoom;
      const halfW = view.halfWidth * zoom;
      const halfH = view.halfHeight * zoom;
      const scale = Math.min(width / (2 * halfW), height / (2 * halfH));
      const P = st.p;
      const lerp = (a: number, b: number) => a + (b - a) * alpha;
      const camX = lerp(prevX[me], P.x[me]);
      const camY = lerp(prevY[me], P.y[me]);
      const shakeLeft = shake.amp * Math.max(0, 1 - (now - shake.at) / SHAKE_MS);
      const ox = shakeLeft > 0.2 ? (Math.random() * 2 - 1) * shakeLeft : 0;
      const oy = shakeLeft > 0.2 ? (Math.random() * 2 - 1) * shakeLeft : 0;
      world.scale.set(scale);
      world.position.set(width / 2 - camX * scale + ox, height / 2 - camY * scale + oy);
      overlay.position.set(ox, oy);
      const left = camX - halfW - ts;
      const right = camX + halfW + ts;
      const top = camY - halfH - ts;
      const bottom = camY + halfH + ts;
      const span = CHUNK * ts;
      for (const c of chunks) c.g.visible = c.x + span >= left && c.x <= right && c.y + span >= top && c.y <= bottom;

      // Eau : les reflets ondulent doucement.
      if (!reducedMotion) {
        waves.alpha = 0.45 + 0.3 * Math.sin(now / 650);
        waves.position.set(Math.sin(now / 900) * ts * 0.08, 0);
      } else waves.alpha = 0.6;
      // Le joueur dans un buisson : le feuillage devient plus transparent (il se voit, comme les autres le voient de près).
      bushes.alpha = tileAt(st.map, P.x[me], P.y[me]) === TILE.bush ? 0.55 : 0.92;

      // Objets visibles du joueur (champ de vision et ligne de vue, comme pour les bots), avec un halo et un léger flottement.
      items.clear();
      const I = st.it;
      const bob = reducedMotion ? 0 : Math.sin(now / 300) * ts * 0.03;
      for (let k = 0; k < st.itemCount; k++) {
        if (I.kind[k] === ITEM.none || I.x[k] < left || I.x[k] > right || I.y[k] < top || I.y[k] > bottom) continue;
        if (itemVisible(st, me, k)) drawItem(items, I.kind[k], I.sub[k], I.x[k], I.y[k] + bob, ts);
      }

      // Tirs visibles : traceur lumineux et balle.
      shots.clear();
      const S = st.s;
      for (let k = 0; k < st.shotCount; k++) {
        if (!shotVisible(st, me, k)) continue;
        const x = S.x[k] - S.vx[k] * (1 - alpha);
        const y = S.y[k] - S.vy[k] * (1 - alpha);
        const burn = S.weapon[k] === BURN_SHOT;
        const color = burn ? COLORS.burn : COLORS.shot;
        shots.moveTo(x - S.vx[k] * 0.7, y - S.vy[k] * 0.7).lineTo(x, y).stroke({ width: ts * 0.22, color, alpha: 0.25, cap: "round" });
        shots.moveTo(x - S.vx[k] * 0.4, y - S.vy[k] * 0.4).lineTo(x, y).stroke({ width: ts * 0.09, color: COLORS.white, alpha: 0.9, cap: "round" });
        shots.circle(x, y, ts * (burn ? 0.2 : 0.11)).fill(burn ? COLORS.burn : COLORS.white).stroke({ width: ts * 0.04, color: COLORS.ink });
      }

      // Personnages.
      const pulse = reducedMotion ? 1 : 0.65 + 0.35 * Math.sin(now / 160);
      fx.clear();
      for (let i = 0; i < st.n; i++) {
        const b = bubbles[i];
        const shown = visible[i] === 1 && P.alive[i] === 1;
        b.root.visible = shown;
        // Vue éloignée par une lunette (au-delà de ×2) : les noms se chevaucheraient ; on garde le sien et les barres de vie.
        b.label.visible = shown && (zoom <= 2.2 || i === me);
        b.bar.visible = shown;
        if (!shown) continue;
        const x = lerp(prevX[i], P.x[i]);
        const y = lerp(prevY[i], P.y[i]);
        b.root.position.set(x, y);
        const r = st.fighters[i].radius;
        const w = weaponInHand(st, i);
        if (w !== b.weaponIndex) {
          drawWeapon(b.weapon, w, r, b.finish);
          b.weaponIndex = w;
        }
        b.weapon.rotation = (P.aim[i] / 256) * Math.PI * 2;
        // Capacité prête : un halo doré, visible de tous ; capacité en cours : un disque à la couleur de la rareté.
        b.aura.visible = P.abilityCd[i] === 0;
        b.aura.alpha = pulse;
        b.active.visible = P.abilityLeft[i] > 0;
        // Touché : un éclair blanc bref sur le portrait.
        b.flash.alpha = Math.max(0, 0.75 * (1 - (now - b.flashAt) / 140));
        // Un participant étourdi est un peu transparent.
        b.root.alpha = P.stun[i] > 0 ? 0.75 : 1;
        // Boisson énergisante : traits de vitesse derrière le personnage en mouvement.
        const mx = P.x[i] - prevX[i];
        const my = P.y[i] - prevY[i];
        if (P.boostLeft[i] > 0 && (mx !== 0 || my !== 0)) {
          const len = Math.hypot(mx, my);
          const ux = mx / len;
          const uy = my / len;
          for (const k of [-0.6, 0, 0.6]) {
            const sx = x - ux * r * 1.2 - uy * k * r;
            const sy = y - uy * r * 1.2 + ux * k * r;
            const l = r * (k === 0 ? 1.1 : 0.7) * (reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(now / 60 + k * 3));
            fx.moveTo(sx, sy).lineTo(sx - ux * l, sy - uy * l);
          }
          fx.stroke({ width: r * 0.12, color: COLORS.speed, alpha: 0.85, cap: "round" });
        }
        const sx = width / 2 + (x - camX) * scale;
        const sy = height / 2 + (y - camY) * scale;
        const rs = r * scale;
        b.label.position.set(sx, sy + rs + 4);
        b.bar.clear();
        if (i !== me) {
          const maxHp = st.fighters[i].maxHp;
          const bw = Math.max(34, rs * 2.2);
          const bx = sx - bw / 2;
          const by = sy - rs - 16;
          b.bar.rect(bx - 1, by - 1, bw + 2, 7).fill(COLORS.ink);
          b.bar.rect(bx, by, (bw * P.hp[i]) / maxHp, 5).fill(P.hp[i] * 4 < maxHp ? COLORS.hpLow : COLORS.hp);
          if (P.shield[i] > 0) b.bar.rect(bx, by - 4, (bw * Math.min(P.shield[i], maxHp)) / maxHp, 3).fill(COLORS.shield);
        }
      }

      // Particules : flashs, étincelles, éclats, fumée, ondes, coups de couteau.
      for (let k = particles.length - 1; k >= 0; k--) {
        const p = particles[k];
        const age = now - p.born;
        const t = age / p.life;
        if (t >= 1) {
          particles.splice(k, 1);
          continue;
        }
        const drag = 1 - t * 0.5;
        const x = p.x + p.vx * age * drag;
        const y = p.y + p.vy * age * drag;
        const fade = 1 - t;
        switch (p.kind) {
          case FX.spark:
            fx.moveTo(x, y).lineTo(x - p.vx * 40, y - p.vy * 40).stroke({ width: p.size, color: p.color, alpha: fade, cap: "round" });
            break;
          case FX.chip: {
            const a = p.rot + p.spin * age;
            const c = Math.cos(a) * p.size;
            const s2 = Math.sin(a) * p.size;
            fx.poly([x - c + s2 * 0.4, y - s2 - c * 0.4, x + c + s2 * 0.4, y + s2 - c * 0.4, x + c - s2 * 0.4, y + s2 + c * 0.4, x - c - s2 * 0.4, y - s2 + c * 0.4]).fill({ color: p.color, alpha: Math.min(1, fade * 1.5) });
            break;
          }
          case FX.puff:
            fx.circle(x, y, p.size * (0.6 + t)).fill({ color: p.color, alpha: 0.45 * fade });
            break;
          case FX.ring:
            fx.circle(p.x, p.y, p.size * (1 + 2 * t)).stroke({ width: p.size * 0.25 * fade + 1, color: p.color, alpha: fade });
            break;
          case FX.flash: {
            const pts: number[] = [];
            for (let q = 0; q < 10; q++) {
              const a = p.rot + (q / 10) * Math.PI * 2;
              const rr = q % 2 ? p.size * 0.4 : p.size * (q === 0 ? 1.6 : 1);
              pts.push(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr);
            }
            fx.poly(pts).fill({ color: COLORS.flash, alpha: fade }).circle(p.x, p.y, p.size * 0.35).fill({ color: COLORS.white, alpha: fade });
            break;
          }
          case FX.swing: {
            const a0 = p.rot - 0.9 + 1.8 * Math.min(1, t * 2.5);
            fx.arc(p.x, p.y, p.size, p.rot - 0.9, a0).stroke({ width: p.size * 0.16 * fade + 1, color: COLORS.white, alpha: 0.9 * fade, cap: "round" });
            break;
          }
        }
      }

      // Zone : tout l'extérieur du cercle actuel est recouvert ; le prochain cercle en pointillés.
      zone.clear();
      const Zs = st.zone;
      const reach = 4 * (halfW + halfH);
      zone.circle(Zs[Z.cx], Zs[Z.cy], Zs[Z.r] + reach / 2).stroke({ width: reach, color: COLORS.scroll, alpha: 0.32 });
      zone.circle(Zs[Z.cx], Zs[Z.cy], Zs[Z.r]).stroke({ width: ts * 0.22, color: COLORS.scrollEdge });
      if (Zs[Z.stage] !== 2 && Zs[Z.tr] > 0) {
        // Tirets d'environ 18 px à l'écran (quelle que soit la taille du cercle), seulement près du champ de vision.
        const step = 18 / scale / Zs[Z.tr];
        const dashes = Math.min(4096, Math.ceil(Math.PI * 2 / step / 2) * 2);
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

      // Bandes : rien n'est montré au-delà du champ de vision du moteur (agrandi par la lunette).
      const key = `${width}x${height}x${zoom.toFixed(3)}`;
      if (bandsFor !== key) {
        bandsFor = key;
        bands.clear();
        const vw = 2 * halfW * scale;
        const vh = 2 * halfH * scale;
        const bx = (width - vw) / 2;
        const by = (height - vh) / 2;
        if (bx > 0.5) bands.rect(0, 0, bx, height).rect(width - bx, 0, bx, height).fill(COLORS.outside);
        if (by > 0.5) bands.rect(0, 0, width, by).rect(0, height - by, width, by).fill(COLORS.outside);
      }

      app.render();
    },

    addDamage(events, st) {
      const now = performance.now();
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
        floating.push({ text, x: st.p.x[e.slot] + jitter, y: st.p.y[e.slot] - st.fighters[e.slot].radius, born: now });
        bubbles[e.slot].flashAt = now;
        burst(FX.spark, st.p.x[e.slot], st.p.y[e.slot], 4, COLORS.white, 0.5, 160, ts * 0.05, now);
        // Le joueur touché : l'écran tremble un peu, selon les dégâts.
        if (received) kick(Math.min(9, 2 + e.amount * 0.25), now);
      }
    },

    addEffects(st, events, kills, visible, loud) {
      for (const e of events.crates) {
        const entry = crateChunks.get(Math.floor(e.tile / size / CHUNK) * chunkCount + Math.floor((e.tile % size) / CHUNK));
        if (entry) drawCrates(st, entry);
      }
      if (!loud) return;
      const now = performance.now();
      const P = st.p;
      for (const e of events.shots) {
        if (e.owner !== me && !visible[e.owner]) continue;
        const a = (P.aim[e.owner] / 256) * Math.PI * 2;
        const muzzle = st.fighters[e.owner].radius * (MUZZLE[weaponInHand(st, e.owner)] ?? 1.5);
        const mx = e.x + Math.cos(a) * muzzle;
        const my = e.y + Math.sin(a) * muzzle;
        const big = e.weapon === 1 || e.weapon === 3;
        emit({ kind: FX.flash, x: mx, y: my, vx: 0, vy: 0, life: 70, color: COLORS.flash, size: ts * (big ? 0.42 : 0.3), rot: a }, now);
        if (e.weapon === 1) burst(FX.puff, mx, my, 2, 0xd9d4e8, 0.08, 320, ts * 0.18, now, a, 0.4);
        if (e.owner === me && big) kick(e.weapon === 3 ? 4 : 3, now);
      }
      for (const e of events.swings) {
        if (e.slot !== me && !visible[e.slot]) continue;
        const a = (e.aim / 256) * Math.PI * 2;
        emit({ kind: FX.swing, x: P.x[e.slot], y: P.y[e.slot], vx: 0, vy: 0, life: 180, color: COLORS.white, size: st.fighters[e.slot].radius * 1.9, rot: a }, now);
      }
      for (const e of events.impacts) {
        if (!inView(st, me, e.x, e.y)) continue;
        burst(FX.spark, e.x, e.y, 5, COLORS.shot, 0.6, 180, ts * 0.04, now);
        burst(FX.puff, e.x, e.y, 1, 0xcfc8b8, 0.03, 260, ts * 0.12, now);
      }
      for (const e of events.crates) {
        if (!inView(st, me, e.x, e.y)) continue;
        if (e.hp === 0) {
          burst(FX.chip, e.x, e.y, 14, COLORS.crate, 0.55, 520, ts * 0.12, now);
          burst(FX.chip, e.x, e.y, 6, COLORS.crateDark, 0.45, 520, ts * 0.1, now);
          burst(FX.puff, e.x, e.y, 4, 0xd8c7a8, 0.12, 480, ts * 0.3, now);
        } else burst(FX.chip, e.x, e.y, 4, COLORS.crateLight, 0.4, 300, ts * 0.07, now);
      }
      for (const k of kills) {
        // Élimination : onde et confettis à la couleur de la rareté, là où le participant est tombé.
        if (k.victim !== me && !inView(st, me, P.x[k.victim], P.y[k.victim])) continue;
        const color = colors[roster[k.victim].card.rarity];
        const x = P.x[k.victim];
        const y = P.y[k.victim];
        const r = st.fighters[k.victim].radius;
        emit({ kind: FX.ring, x, y, vx: 0, vy: 0, life: 420, color, size: r }, now);
        burst(FX.chip, x, y, 14, color, 0.5, 700, r * 0.22, now);
        burst(FX.chip, x, y, 8, COLORS.white, 0.45, 600, r * 0.18, now);
        burst(FX.puff, x, y, 3, 0xe8e4f4, 0.1, 500, r * 0.7, now);
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

/** Objets au sol : formes simples et lisibles, avec un contour (jamais la couleur seule) et un halo. */
function drawItem(g: Graphics, kind: number, sub: number, x: number, y: number, ts: number): void {
  const u = ts * 0.32;
  g.circle(x, y, u * 1.7).fill({ color: COLORS.white, alpha: 0.22 });
  if (kind === ITEM.weapon) {
    g.roundRect(x - u * 1.3, y - u * 0.45, u * 2.6, u * 0.9, u * 0.2).fill(FINISHES[sub % FINISHES.length].body).stroke({ width: u * 0.22, color: COLORS.white });
    g.roundRect(x - u * 1.3, y - u * 0.45, u * 2.6, u * 0.9, u * 0.2).stroke({ width: u * 0.1, color: COLORS.ink });
    g.rect(x - u * 0.6, y + u * 0.2, u * 0.4, u * 0.6).fill(FINISHES[sub % FINISHES.length].accent).stroke({ width: u * 0.08, color: COLORS.ink });
  } else if (kind === ITEM.ammo) {
    g.roundRect(x - u * 0.8, y - u * 0.6, u * 1.6, u * 1.2, u * 0.15).fill(COLORS.ammo[sub] ?? 0xf2c94c).stroke({ width: u * 0.16, color: COLORS.ink });
    g.rect(x - u * 0.5, y - u * 0.15, u, u * 0.3).fill(COLORS.ink);
  } else if (kind === ITEM.heal) {
    g.roundRect(x - u * 0.85, y - u * 0.85, u * 1.7, u * 1.7, u * 0.3).fill(COLORS.white).stroke({ width: u * 0.16, color: COLORS.ink });
    g.rect(x - u * 0.18, y - u * 0.6, u * 0.36, u * 1.2).rect(x - u * 0.6, y - u * 0.18, u * 1.2, u * 0.36).fill(COLORS.heal);
  } else if (kind === ITEM.vest) {
    g.poly([x - u, y - u * 0.8, x + u, y - u * 0.8, x + u * 0.8, y + u * 0.3, x, y + u, x - u * 0.8, y + u * 0.3]).fill(COLORS.shield).stroke({ width: u * 0.16, color: COLORS.ink });
  } else if (kind === ITEM.speed) {
    // Boisson énergisante : canette et éclair.
    g.roundRect(x - u * 0.5, y - u * 0.9, u, u * 1.8, u * 0.22).fill(COLORS.speed).stroke({ width: u * 0.16, color: COLORS.ink });
    g.poly([x + u * 0.1, y - u * 0.6, x - u * 0.25, y + u * 0.05, x, y + u * 0.05, x - u * 0.1, y + u * 0.6, x + u * 0.25, y - u * 0.1, x, y - u * 0.1]).fill(COLORS.white);
  } else if (kind === ITEM.scope) {
    // Lunette : objectif rond et réticule ; une ×4 a un second anneau doré.
    g.circle(x, y, u * 0.95).fill(COLORS.ink);
    if (sub >= 4) g.circle(x, y, u * 0.95).stroke({ width: u * 0.16, color: 0xffc83d });
    g.circle(x, y, u * 0.62).fill(0x7cc4ff).stroke({ width: u * 0.1, color: COLORS.white });
    g.moveTo(x - u * 0.5, y).lineTo(x + u * 0.5, y).moveTo(x, y - u * 0.5).lineTo(x, y + u * 0.5).stroke({ width: u * 0.08, color: COLORS.ink });
  }
}
