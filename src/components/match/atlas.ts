/**
 * Portraits des personnages d'une partie, rassemblés dans une seule image (conception §6.5) : un disque par
 * carte différente, découpé dans l'illustration (image téléversée, sinon illustration générée par la graine).
 * Une image indisponible (hors ligne, erreur) est remplacée par l'illustration générée.
 */
import { ART_HEIGHT, ART_WIDTH, generateCardArtSvg } from "@/lib/art/generate";
import type { Card } from "@/lib/validation/card";

/** Taille d'un portrait dans l'image commune, en pixels. */
export const PORTRAIT = 128;

export interface PortraitAtlas {
  canvas: HTMLCanvasElement;
  /** Position (coin haut gauche) du portrait de chaque carte. */
  frames: Map<string, { x: number; y: number }>;
}

function loadImage(src: string, crossOrigin: boolean, timeoutMs: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(null), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.decoding = "async";
    img.src = src;
  });
}

async function artFor(card: Card): Promise<HTMLImageElement | null> {
  // Taille explicite : un SVG qui ne déclare que ses proportions (viewBox) a une taille par défaut de 300 × 150
  // pour le canvas, et le visage serait mal découpé.
  const svg = generateCardArtSvg({ seed: card.artSeed, rarity: card.rarity }).replace("<svg ", `<svg width="${ART_WIDTH}" height="${ART_HEIGHT}" `);
  const generated = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  if (card.imageUrl) {
    const uploaded = await loadImage(card.imageUrl, true, 4000);
    if (uploaded) return uploaded;
  }
  return loadImage(generated, false, 4000);
}

export async function buildPortraitAtlas(cards: readonly Card[]): Promise<PortraitAtlas> {
  const unique = [...new Map(cards.map((c) => [c.id, c])).values()];
  const columns = Math.max(1, Math.ceil(Math.sqrt(unique.length)));
  const rows = Math.max(1, Math.ceil(unique.length / columns));
  const canvas = document.createElement("canvas");
  canvas.width = columns * PORTRAIT;
  canvas.height = rows * PORTRAIT;
  const ctx = canvas.getContext("2d");
  const frames = new Map<string, { x: number; y: number }>();
  const images = await Promise.all(unique.map(artFor));
  unique.forEach((card, k) => {
    const x = (k % columns) * PORTRAIT;
    const y = Math.floor(k / columns) * PORTRAIT;
    frames.set(card.id, { x, y });
    const img = images[k];
    if (!ctx) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + PORTRAIT / 2, y + PORTRAIT / 2, PORTRAIT / 2, 0, Math.PI * 2);
    ctx.clip();
    if (img) {
      // Illustration 400 × 320, visage au centre : on en garde un carré centré, un peu au-dessus du milieu.
      const side = Math.min(img.naturalWidth, img.naturalHeight) * 0.82;
      const sx = (img.naturalWidth - side) / 2;
      const sy = Math.max(0, (img.naturalHeight - side) / 2 + img.naturalHeight * 0.02);
      ctx.drawImage(img, sx, sy, side, side, x, y, PORTRAIT, PORTRAIT);
    } else {
      ctx.fillStyle = "#d9d3f5";
      ctx.fillRect(x, y, PORTRAIT, PORTRAIT);
    }
    ctx.restore();
  });
  return { canvas, frames };
}
