/**
 * Génère les icônes de la PWA dans public/icons à partir d'un dessin SVG.
 * Usage : npm run assets:pwa
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const OUT = join(process.cwd(), "public", "icons");
mkdirSync(OUT, { recursive: true });

/**
 * Logo du jeu : un personnage meme (le visage jaune de la marque) qui tire avec son pistolet
 * — éclair de tir et munitions qui filent, comme sur la page Battle Royale. `safe` réduit le
 * dessin pour la zone sûre des icônes maskable.
 */
function iconSvg(safe: boolean): string {
  const scale = safe ? 0.72 : 0.88;
  const offset = (512 * (1 - scale)) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${safe ? 0 : 112}" fill="#FF3D7F"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <!-- Visage (autocollant jaune) -->
    <circle cx="200" cy="252" r="170" fill="#fff"/>
    <circle cx="200" cy="252" r="154" fill="#FFD23F" stroke="#1A1238" stroke-width="15"/>
    <!-- Regard décidé, tourné vers le tir -->
    <path d="M118 198 L182 216" stroke="#1A1238" stroke-width="15" stroke-linecap="round"/>
    <path d="M214 210 L272 190" stroke="#1A1238" stroke-width="15" stroke-linecap="round"/>
    <ellipse cx="156" cy="244" rx="30" ry="35" fill="#fff" stroke="#1A1238" stroke-width="10"/>
    <circle cx="169" cy="249" r="14" fill="#1A1238"/>
    <ellipse cx="240" cy="238" rx="30" ry="35" fill="#fff" stroke="#1A1238" stroke-width="10"/>
    <circle cx="253" cy="243" r="14" fill="#1A1238"/>
    <path d="M150 304 q52 40 108 8 q-18 44 -66 38 q-40 -6 -42 -46z" fill="#1A1238"/>
    <!-- Bras qui tend l'arme -->
    <path d="M236 330 Q296 364 332 318" fill="none" stroke="#1A1238" stroke-width="52" stroke-linecap="round"/>
    <path d="M236 330 Q296 364 332 318" fill="none" stroke="#FFD23F" stroke-width="36" stroke-linecap="round"/>
    <!-- Pistolet -->
    <path d="M300 286 L340 286 L360 346 L322 354 Z" fill="#2B2340" stroke="#1A1238" stroke-width="10" stroke-linejoin="round"/>
    <rect x="296" y="250" width="92" height="36" rx="8" fill="#2B2340" stroke="#1A1238" stroke-width="10"/>
    <rect x="308" y="259" width="64" height="8" rx="4" fill="#4A4270"/>
    <!-- Main qui tient la crosse -->
    <circle cx="322" cy="314" r="30" fill="#FFD23F" stroke="#1A1238" stroke-width="12"/>
    <!-- Éclair de tir au bout du canon -->
    <path d="M400 221 L417 250 L446 267 L417 284 L400 313 L383 284 L354 267 L383 250 Z" fill="#fff" stroke="#1A1238" stroke-width="10" stroke-linejoin="round"/>
    <path d="M400 239 L410 257 L428 267 L410 277 L400 295 L390 277 L372 267 L390 257 Z" fill="#FFD23F"/>
    <!-- Munitions qui filent -->
    <rect x="452" y="212" width="40" height="18" rx="9" fill="#FFD23F" stroke="#1A1238" stroke-width="9"/>
    <rect x="452" y="306" width="40" height="18" rx="9" fill="#FFD23F" stroke="#1A1238" stroke-width="9"/>
    <rect x="456" y="259" width="44" height="18" rx="9" fill="#fff" stroke="#1A1238" stroke-width="9"/>
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
