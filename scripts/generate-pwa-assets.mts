/**
 * Génère les icônes de la PWA dans public/icons à partir d'un dessin SVG.
 * Usage : npm run assets:pwa
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const OUT = join(process.cwd(), "public", "icons");
mkdirSync(OUT, { recursive: true });

/** Un autocollant-visage sur fond rose. `safe` réduit le dessin pour la zone sûre des icônes maskable. */
function iconSvg(safe: boolean): string {
  const scale = safe ? 0.72 : 0.9;
  const offset = (512 * (1 - scale)) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${safe ? 0 : 112}" fill="#FF3D7F"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <path d="M256 70c118 0 196 70 196 178 0 114-84 192-196 192S60 362 60 248C60 140 138 70 256 70z" fill="#fff" stroke="#fff" stroke-width="40" stroke-linejoin="round"/>
    <path d="M256 70c118 0 196 70 196 178 0 114-84 192-196 192S60 362 60 248C60 140 138 70 256 70z" fill="#FFD23F" stroke="#1A1238" stroke-width="16" stroke-linejoin="round"/>
    <ellipse cx="190" cy="226" rx="30" ry="36" fill="#fff" stroke="#1A1238" stroke-width="10"/>
    <circle cx="202" cy="232" r="13" fill="#1A1238"/>
    <ellipse cx="322" cy="226" rx="30" ry="36" fill="#fff" stroke="#1A1238" stroke-width="10"/>
    <circle cx="334" cy="232" r="13" fill="#1A1238"/>
    <path d="M176 314h160q0 70-80 70t-80-70z" fill="#fff" stroke="#1A1238" stroke-width="12" stroke-linejoin="round"/>
    <path d="M176 336h160" stroke="#1A1238" stroke-width="7"/>
  </g>
</svg>`;
}

const jobs: Array<[string, number, boolean]> = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, true],
  ["favicon-32.png", 32, false],
];

Promise.all(
  jobs.map(([name, size, safe]) =>
    sharp(Buffer.from(iconSvg(safe))).resize(size, size).png({ compressionLevel: 9 }).toFile(join(OUT, name)),
  ),
).then(() => console.log(`Icônes générées dans ${OUT}`));
