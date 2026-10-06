/**
 * Générateur procédural d'illustrations de cartes (SVG).
 *
 * Aucune image réelle : chaque carte reçoit un personnage « sticker » original,
 * composé à partir d'une graine, de sa vibe (expression, décor) et de sa
 * rareté (ornements). Même graine + même vibe + même rareté = même image.
 *
 * Le SVG produit ne contient ni texte ni script : il est sûr à afficher en
 * <img src="data:..."> et à stocker dans Supabase Storage.
 */
import { rarityTier, type Rarity } from "@/config/rarities";
import type { Vibe } from "@/config/vibes";
import { between, mulberry32, pick } from "./prng";

export const ART_WIDTH = 400;
export const ART_HEIGHT = 320;

const INK = "#1A1238";

interface Palette {
  from: string;
  to: string;
  pattern: string;
}

const PALETTES: Record<Vibe, Palette> = {
  chaos: { from: "#2B1055", to: "#FF3D7F", pattern: "#FFD23F" },
  wholesome: { from: "#FFE3EC", to: "#FFF6C9", pattern: "#FF8FB1" },
  rage: { from: "#FF5A36", to: "#8A0F1B", pattern: "#FFD23F" },
  ironique: { from: "#D6ECFF", to: "#7FA8FF", pattern: "#1A1238" },
  cringe: { from: "#E4FF9A", to: "#7FD8A0", pattern: "#4B7F3A" },
  absurde: { from: "#FFD23F", to: "#5FE1F5", pattern: "#7C3AED" },
};

const SKINS = ["#FFE08A", "#B8F2E6", "#FFB5C2", "#C9B6FF", "#9AE6B4", "#FFD1A1", "#A0D8FF", "#F4F1FF"];

type Eyes = "dots" | "wide" | "halfLid" | "angry" | "spiral" | "sparkle" | "side" | "closed";
type Mouth = "smile" | "grin" | "flat" | "scream" | "wavy" | "smirk" | "o";

const EXPRESSIONS: Record<Vibe, { eyes: readonly Eyes[]; mouths: readonly Mouth[] }> = {
  chaos: { eyes: ["spiral", "wide", "angry"], mouths: ["grin", "scream"] },
  wholesome: { eyes: ["sparkle", "closed"], mouths: ["smile", "o"] },
  rage: { eyes: ["angry"], mouths: ["scream", "flat"] },
  ironique: { eyes: ["halfLid", "side"], mouths: ["smirk", "flat"] },
  cringe: { eyes: ["wide", "side"], mouths: ["wavy", "grin"] },
  absurde: { eyes: ["spiral", "dots", "wide"], mouths: ["o", "wavy"] },
};

const r1 = (n: number) => Math.round(n * 10) / 10;

export interface CardArtInput {
  seed: number;
  vibe: Vibe;
  rarity: Rarity;
}

export function generateCardArtSvg({ seed, vibe, rarity }: CardArtInput): string {
  const rand = mulberry32(seed);
  const tier = rarityTier(rarity);
  const pal = PALETTES[vibe];
  const skin = pick(rand, SKINS);
  const cx = 200 + between(rand, -12, 12);
  const cy = 182 + between(rand, -6, 8);
  const rx = between(rand, 92, 118);
  const ry = between(rand, 84, 104);

  const parts: string[] = [];
  parts.push(
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${pal.from}"/><stop offset="1" stop-color="${pal.to}"/></linearGradient></defs>`,
    `<rect width="${ART_WIDTH}" height="${ART_HEIGHT}" fill="url(#bg)"/>`,
    backgroundPattern(vibe, rand, pal.pattern),
  );
  if (tier >= 7) parts.push(rays(cx, cy));
  if (tier >= 5) parts.push(stars(rand, tier >= 6 ? 14 : 9));

  const head = headPath(rand, cx, cy, rx, ry);
  // Contour blanc épais puis trait d'encre : l'effet « sticker ».
  parts.push(`<path d="${head}" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="22" stroke-linejoin="round"/>`);
  parts.push(`<path d="${head}" fill="${skin}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>`);

  const { eyes, mouths } = EXPRESSIONS[vibe];
  const eyeKind = pick(rand, eyes);
  const mouthKind = pick(rand, mouths);
  const eyeGap = rx * between(rand, 0.36, 0.48);
  const eyeY = cy - ry * between(rand, 0.12, 0.28);
  parts.push(drawEyes(eyeKind, rand, cx, eyeY, eyeGap, skin, vibe === "absurde"));
  parts.push(drawMouth(mouthKind, rand, cx, cy + ry * between(rand, 0.32, 0.46), rx * between(rand, 0.28, 0.42)));

  parts.push(vibeExtras(vibe, rand, cx, cy, rx, ry, eyeY, eyeGap));
  if (tier >= 6) parts.push(thirdEye(cx, cy - ry * 0.62));
  if (tier >= 3) parts.push(sparkles(rand, tier >= 4 ? 5 : 3));
  if (tier >= 7) parts.push(halo(cx, cy - ry - 18, rx));

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ART_WIDTH} ${ART_HEIGHT}" preserveAspectRatio="xMidYMid slice">${parts.join("")}</svg>`;
}

/** URL data: utilisable directement dans un <img>. */
export function cardArtDataUri(input: CardArtInput): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(generateCardArtSvg(input))}`;
}

// ---------------------------------------------------------------------------
// Formes
// ---------------------------------------------------------------------------

function headPath(rand: () => number, cx: number, cy: number, rx: number, ry: number): string {
  const n = 9;
  const pts: Array<[number, number]> = [];
  const wobble = between(rand, 0.04, 0.12);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const k = 1 + between(rand, -wobble, wobble);
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  // Catmull-Rom fermé converti en courbes de Bézier : un contour doux et organique.
  let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return `${d}Z`;
}

function backgroundPattern(vibe: Vibe, rand: () => number, color: string): string {
  const out: string[] = [];
  switch (vibe) {
    case "chaos":
      for (let i = 0; i < 7; i++) {
        const x = between(rand, 0, ART_WIDTH);
        const y = between(rand, 0, ART_HEIGHT);
        const s = between(rand, 18, 46);
        out.push(`<polygon points="${r1(x)},${r1(y - s)} ${r1(x + s * 0.6)},${r1(y + s * 0.3)} ${r1(x - s * 0.7)},${r1(y + s * 0.5)}" fill="${color}" opacity="0.55"/>`);
      }
      out.push(`<polyline points="20,40 70,90 50,110 110,170" fill="none" stroke="${color}" stroke-width="7" stroke-linejoin="bevel" opacity="0.7"/>`);
      break;
    case "wholesome":
      for (let i = 0; i < 9; i++) {
        const x = between(rand, 10, ART_WIDTH - 10);
        const y = between(rand, 10, ART_HEIGHT - 10);
        out.push(heart(x, y, between(rand, 8, 16), color, 0.5));
      }
      break;
    case "rage":
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const x1 = 200 + Math.cos(a) * 400;
        const y1 = 180 + Math.sin(a) * 400;
        const x2 = 200 + Math.cos(a + 0.12) * 400;
        const y2 = 180 + Math.sin(a + 0.12) * 400;
        out.push(`<polygon points="200,180 ${r1(x1)},${r1(y1)} ${r1(x2)},${r1(y2)}" fill="${color}" opacity="0.28"/>`);
      }
      break;
    case "ironique":
      for (let y = 12; y < ART_HEIGHT; y += 24) {
        for (let x = (y / 24) % 2 === 0 ? 12 : 24; x < ART_WIDTH; x += 24) {
          out.push(`<circle cx="${x}" cy="${y}" r="${r1(2 + (y / ART_HEIGHT) * 4)}" fill="${color}" opacity="0.18"/>`);
        }
      }
      break;
    case "cringe":
      for (let y = 20; y < ART_HEIGHT; y += 34) {
        let d = `M0 ${y}`;
        for (let x = 0; x <= ART_WIDTH; x += 40) d += ` Q${x + 20} ${y + 12} ${x + 40} ${y}`;
        out.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="5" opacity="0.3"/>`);
      }
      break;
    case "absurde":
      for (let i = 0; i < 8; i++) {
        const x = between(rand, 0, ART_WIDTH);
        const y = between(rand, 0, ART_HEIGHT);
        const s = between(rand, 14, 30);
        const rot = Math.round(between(rand, 0, 90));
        out.push(
          rand() < 0.5
            ? `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(s)}" height="${r1(s)}" rx="4" fill="${color}" opacity="0.4" transform="rotate(${rot} ${r1(x)} ${r1(y)})"/>`
            : `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(s / 2)}" fill="none" stroke="${color}" stroke-width="5" opacity="0.45"/>`,
        );
      }
      break;
  }
  return out.join("");
}

function heart(x: number, y: number, s: number, color: string, opacity: number): string {
  return `<path d="M${r1(x)} ${r1(y + s * 0.9)}C${r1(x - s * 1.4)} ${r1(y)} ${r1(x - s * 0.6)} ${r1(y - s)} ${r1(x)} ${r1(y - s * 0.25)}C${r1(x + s * 0.6)} ${r1(y - s)} ${r1(x + s * 1.4)} ${r1(y)} ${r1(x)} ${r1(y + s * 0.9)}Z" fill="${color}" opacity="${opacity}"/>`;
}

function drawEyes(kind: Eyes, rand: () => number, cx: number, y: number, gap: number, skin: string, mismatched: boolean): string {
  const lx = cx - gap;
  const rx = cx + gap;
  const s = between(rand, 15, 20);
  const s2 = mismatched ? s * between(rand, 0.6, 1.4) : s;
  const eye = (x: number, size: number) => {
    switch (kind) {
      case "dots":
        return `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(size * 0.55)}" fill="${INK}"/>`;
      case "wide":
        return `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(size)}" ry="${r1(size * 1.15)}" fill="#fff" stroke="${INK}" stroke-width="4"/><circle cx="${r1(x + between(rand, -3, 3))}" cy="${r1(y + 2)}" r="${r1(size * 0.38)}" fill="${INK}"/>`;
      case "side":
        return `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(size * 1.1)}" ry="${r1(size * 0.8)}" fill="#fff" stroke="${INK}" stroke-width="4"/><circle cx="${r1(x + size * 0.55)}" cy="${r1(y)}" r="${r1(size * 0.36)}" fill="${INK}"/>`;
      case "halfLid":
        return `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(size)}" fill="#fff" stroke="${INK}" stroke-width="4"/><circle cx="${r1(x)}" cy="${r1(y + size * 0.35)}" r="${r1(size * 0.38)}" fill="${INK}"/><path d="M${r1(x - size - 2)} ${r1(y)}A${r1(size + 2)} ${r1(size + 2)} 0 0 1 ${r1(x + size + 2)} ${r1(y)}Z" fill="${skin}" stroke="${INK}" stroke-width="4"/>`;
      case "angry":
        return `<circle cx="${r1(x)}" cy="${r1(y + 4)}" r="${r1(size * 0.5)}" fill="${INK}"/>`;
      case "spiral": {
        let d = `M${r1(x)} ${r1(y)}`;
        for (let t = 0; t < 14; t++) {
          const a = t * 0.9;
          const rr = 1.5 + t * (size / 15);
          d += ` L${r1(x + Math.cos(a) * rr)} ${r1(y + Math.sin(a) * rr)}`;
        }
        return `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(size + 2)}" fill="#fff" stroke="${INK}" stroke-width="4"/><path d="${d}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
      }
      case "sparkle":
        return `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(size * 0.8)}" ry="${r1(size)}" fill="${INK}"/><circle cx="${r1(x - size * 0.25)}" cy="${r1(y - size * 0.35)}" r="${r1(size * 0.28)}" fill="#fff"/><circle cx="${r1(x + size * 0.25)}" cy="${r1(y + size * 0.3)}" r="${r1(size * 0.14)}" fill="#fff"/>`;
      case "closed":
        return `<path d="M${r1(x - size)} ${r1(y + 4)}Q${r1(x)} ${r1(y - size)} ${r1(x + size)} ${r1(y + 4)}" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
    }
  };
  let out = eye(lx, s) + eye(rx, s2);
  if (kind === "angry") {
    out += `<path d="M${r1(lx - s)} ${r1(y - s)}L${r1(lx + s * 0.8)} ${r1(y - s * 0.2)}M${r1(rx + s)} ${r1(y - s)}L${r1(rx - s * 0.8)} ${r1(y - s * 0.2)}" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
  }
  return out;
}

function drawMouth(kind: Mouth, rand: () => number, cx: number, y: number, w: number): string {
  switch (kind) {
    case "smile":
      return `<path d="M${r1(cx - w)} ${r1(y - 6)}Q${r1(cx)} ${r1(y + w * 0.7)} ${r1(cx + w)} ${r1(y - 6)}" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
    case "grin":
      return `<path d="M${r1(cx - w)} ${r1(y - 8)}L${r1(cx + w)} ${r1(y - 8)}Q${r1(cx + w)} ${r1(y + w * 0.7)} ${r1(cx)} ${r1(y + w * 0.7)}Q${r1(cx - w)} ${r1(y + w * 0.7)} ${r1(cx - w)} ${r1(y - 8)}Z" fill="#fff" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M${r1(cx - w)} ${r1(y + 6)}L${r1(cx + w)} ${r1(y + 6)}" stroke="${INK}" stroke-width="3"/>`;
    case "flat":
      return `<path d="M${r1(cx - w * 0.8)} ${r1(y)}L${r1(cx + w * 0.8)} ${r1(y + between(rand, -4, 4))}" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
    case "scream":
      return `<ellipse cx="${r1(cx)}" cy="${r1(y + 6)}" rx="${r1(w * 0.7)}" ry="${r1(w * 0.9)}" fill="${INK}"/><ellipse cx="${r1(cx)}" cy="${r1(y + w * 0.55)}" rx="${r1(w * 0.4)}" ry="${r1(w * 0.25)}" fill="#FF6B8A"/>`;
    case "wavy": {
      let d = `M${r1(cx - w)} ${r1(y)}`;
      const steps = 4;
      for (let i = 0; i < steps; i++) {
        const x0 = cx - w + (2 * w * i) / steps;
        d += ` Q${r1(x0 + w / steps / 1)} ${r1(y + (i % 2 ? 9 : -9))} ${r1(x0 + (2 * w) / steps)} ${r1(y)}`;
      }
      return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
    }
    case "smirk":
      return `<path d="M${r1(cx - w * 0.7)} ${r1(y + 2)}Q${r1(cx + w * 0.2)} ${r1(y + 6)} ${r1(cx + w * 0.8)} ${r1(y - 12)}" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
    case "o":
      return `<ellipse cx="${r1(cx)}" cy="${r1(y)}" rx="${r1(w * 0.3)}" ry="${r1(w * 0.38)}" fill="${INK}"/>`;
  }
}

function vibeExtras(vibe: Vibe, rand: () => number, cx: number, cy: number, rx: number, ry: number, eyeY: number, gap: number): string {
  switch (vibe) {
    case "wholesome":
      return `<ellipse cx="${r1(cx - gap - 8)}" cy="${r1(eyeY + 34)}" rx="16" ry="9" fill="#FF8FB1" opacity="0.7"/><ellipse cx="${r1(cx + gap + 8)}" cy="${r1(eyeY + 34)}" rx="16" ry="9" fill="#FF8FB1" opacity="0.7"/>`;
    case "rage": {
      const x = cx + rx * 0.55;
      const y = cy - ry * 0.7;
      return `<path d="M${r1(x - 14)} ${r1(y - 4)}Q${r1(x)} ${r1(y - 2)} ${r1(x - 2)} ${r1(y - 16)}M${r1(x + 4)} ${r1(y - 16)}Q${r1(x + 4)} ${r1(y)} ${r1(x + 18)} ${r1(y - 2)}M${r1(x - 12)} ${r1(y + 6)}Q${r1(x + 2)} ${r1(y + 4)} ${r1(x + 2)} ${r1(y + 18)}" fill="none" stroke="#C0001A" stroke-width="5" stroke-linecap="round"/>`;
    }
    case "cringe": {
      const x = cx + rx * 0.72;
      const y = cy - ry * 0.35;
      return `<path d="M${r1(x)} ${r1(y - 22)}Q${r1(x + 13)} ${r1(y)} ${r1(x)} ${r1(y + 4)}Q${r1(x - 13)} ${r1(y)} ${r1(x)} ${r1(y - 22)}Z" fill="#7FD3FF" stroke="${INK}" stroke-width="3.5"/>`;
    }
    case "ironique":
      // Lunettes pixelisées, posées une fois sur deux.
      if (rand() < 0.5) return "";
      return pixelShades(cx, eyeY);
    case "absurde":
      return `<path d="M${r1(cx + rx * 0.62)} ${r1(cy - ry * 0.95)}q0 -18 16 -18 16 0 16 14 0 10 -14 16v8" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><circle cx="${r1(cx + rx * 0.62 + 18)}" cy="${r1(cy - ry * 0.95 + 26)}" r="4" fill="${INK}"/>`;
    case "chaos":
      return `<path d="M${r1(cx - rx * 0.9)} ${r1(cy - ry * 0.9)}l14 6-6 10 16 4" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`;
  }
}

function pixelShades(cx: number, y: number): string {
  const p = 7;
  const rows = [
    "1111111111111111111",
    "1222211111112222211",
    "0122210000000122210",
    "0011100000000011100",
  ];
  const width = rows[0].length * p;
  const x0 = cx - width / 2;
  const y0 = y - p * 1.5;
  const out: string[] = [];
  rows.forEach((row, ry) => {
    [...row].forEach((c, rx) => {
      if (c === "0") return;
      out.push(`<rect x="${r1(x0 + rx * p)}" y="${r1(y0 + ry * p)}" width="${p}" height="${p}" fill="${c === "1" ? INK : "#3B3366"}"/>`);
    });
  });
  return out.join("");
}

function sparkles(rand: () => number, count: number): string {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const x = between(rand, 24, ART_WIDTH - 24);
    const y = between(rand, 20, 110);
    const s = between(rand, 6, 12);
    out.push(`<path d="M${r1(x)} ${r1(y - s)}Q${r1(x)} ${r1(y)} ${r1(x + s)} ${r1(y)}Q${r1(x)} ${r1(y)} ${r1(x)} ${r1(y + s)}Q${r1(x)} ${r1(y)} ${r1(x - s)} ${r1(y)}Q${r1(x)} ${r1(y)} ${r1(x)} ${r1(y - s)}Z" fill="#FFFFFF" opacity="0.9"/>`);
  }
  return out.join("");
}

function stars(rand: () => number, count: number): string {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(`<circle cx="${r1(between(rand, 0, ART_WIDTH))}" cy="${r1(between(rand, 0, ART_HEIGHT))}" r="${r1(between(rand, 1, 2.6))}" fill="#FFFFFF" opacity="${r1(between(rand, 0.5, 0.95))}"/>`);
  }
  return out.join("");
}

function rays(cx: number, cy: number): string {
  const out: string[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const b = a + 0.16;
    out.push(`<polygon points="${r1(cx)},${r1(cy)} ${r1(cx + Math.cos(a) * 420)},${r1(cy + Math.sin(a) * 420)} ${r1(cx + Math.cos(b) * 420)},${r1(cy + Math.sin(b) * 420)}" fill="#FFF3B0" opacity="0.35"/>`);
  }
  return out.join("");
}

function halo(cx: number, y: number, rx: number): string {
  return `<ellipse cx="${r1(cx)}" cy="${r1(y)}" rx="${r1(rx * 0.62)}" ry="14" fill="none" stroke="#FFFFFF" stroke-width="14"/><ellipse cx="${r1(cx)}" cy="${r1(y)}" rx="${r1(rx * 0.62)}" ry="14" fill="none" stroke="#FFC83D" stroke-width="7"/>`;
}

function thirdEye(cx: number, y: number): string {
  return `<ellipse cx="${r1(cx)}" cy="${r1(y)}" rx="15" ry="10" fill="#fff" stroke="${INK}" stroke-width="4"/><circle cx="${r1(cx)}" cy="${r1(y)}" r="5" fill="#7C3AED"/>`;
}
