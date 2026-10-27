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
 * Logo du jeu (référence du propriétaire) : un visage meme râleur en forme de cible — anneau sombre, couronne
 * orange/rouge segmentée, visage cyan en colère — tenant une arme qui dépasse à droite, sur un fond d'herbe de
 * battle royale. `safe` réduit le dessin pour la zone sûre des icônes maskable.
 */
function iconSvg(safe: boolean): string {
  const scale = safe ? 0.78 : 0.94;
  const offset = (512 * (1 - scale)) / 2;
  const fcx = 184;
  const fcy = 256;
  const outerR = 128;
  const innerR = 96;
  const seg = 12;
  const pt = (r: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(fcx + r * Math.cos(a)).toFixed(1)} ${(fcy + r * Math.sin(a)).toFixed(1)}`;
  };
  let ring = "";
  for (let i = 0; i < seg; i++) {
    const a0 = (i * 360) / seg;
    const a1 = ((i + 1) * 360) / seg;
    ring += `<path d="M ${pt(outerR, a0)} A ${outerR} ${outerR} 0 0 1 ${pt(outerR, a1)} L ${pt(innerR, a1)} A ${innerR} ${innerR} 0 0 0 ${pt(innerR, a0)} Z" fill="${i % 2 === 0 ? "#e0702e" : "#c23b2c"}"/>`;
  }
  // Touffes d'herbe réparties sur le fond.
  const tuftSpots = [[70, 120], [150, 70], [430, 90], [472, 210], [58, 300], [92, 436], [210, 474], [360, 452], [460, 404], [300, 108], [416, 470], [40, 212]];
  let tufts = "";
  for (const [x, y] of tuftSpots) tufts += `<path d="M${x} ${y + 10} Q${x - 4} ${y} ${x - 2} ${y - 12} M${x} ${y + 10} Q${x} ${y - 2} ${x} ${y - 14} M${x} ${y + 10} Q${x + 4} ${y} ${x + 3} ${y - 11}"/>`;
  // Éclair de tir : étoile à 8 branches au bout du canon.
  const mx = 452;
  const my = 256;
  const star = (R: number, r: number): string => {
    let d = "";
    for (let k = 0; k < 16; k++) {
      const rad = k % 2 === 0 ? R : r;
      const a = ((k * 22.5 - 90) * Math.PI) / 180;
      d += `${k ? "L" : "M"}${(mx + rad * Math.cos(a)).toFixed(1)} ${(my + rad * Math.sin(a)).toFixed(1)} `;
    }
    return d + "Z";
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs><clipPath id="sq"><rect width="512" height="512" rx="${safe ? 0 : 112}"/></clipPath></defs>
  <g clip-path="url(#sq)">
    <rect width="512" height="512" fill="#7dbb58"/>
    <g opacity="0.55">
      <ellipse cx="110" cy="80" rx="150" ry="90" fill="#6aa847"/>
      <ellipse cx="440" cy="150" rx="150" ry="100" fill="#94cc6c"/>
      <ellipse cx="70" cy="432" rx="160" ry="95" fill="#94cc6c"/>
      <ellipse cx="432" cy="452" rx="150" ry="90" fill="#6aa847"/>
    </g>
    <g stroke="#548f38" stroke-width="7" stroke-linecap="round" fill="none" opacity="0.85">${tufts}</g>
  </g>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <!-- Ombre portée douce -->
    <ellipse cx="${fcx}" cy="416" rx="${outerR}" ry="20" fill="#1a1238" opacity="0.16"/>
    <!-- Arme qui tire vers la droite : corps, poignée, canon -->
    <g stroke="#120c24" stroke-width="11" stroke-linejoin="round">
      <rect x="268" y="234" width="132" height="46" rx="10" fill="#2b2340"/>
      <rect x="290" y="276" width="38" height="40" rx="8" fill="#2b2340"/>
    </g>
    <rect x="392" y="245" width="44" height="24" rx="6" fill="#4a4270"/>
    <!-- Éclair de tir + munitions qui filent -->
    <path d="${star(52, 22)}" fill="#fff" stroke="#120c24" stroke-width="9" stroke-linejoin="round"/>
    <path d="${star(34, 13)}" fill="#ffd23f"/>
    <rect x="486" y="226" width="34" height="15" rx="7" fill="#ffd23f" stroke="#120c24" stroke-width="7"/>
    <rect x="494" y="278" width="34" height="15" rx="7" fill="#fff" stroke="#120c24" stroke-width="7"/>
    <!-- Bulle-cible : anneau sombre, couronne orange/rouge, visage cyan en colère -->
    <circle cx="${fcx}" cy="${fcy}" r="${outerR + 12}" fill="#241a4a"/>
    ${ring}
    <circle cx="${fcx}" cy="${fcy}" r="${innerR}" fill="#241a4a"/>
    <circle cx="${fcx}" cy="${fcy}" r="${innerR - 7}" fill="#aadcf7" stroke="#1a1238" stroke-width="7"/>
    <!-- Sourcils froncés (colère) -->
    <path d="M${fcx - 80} ${fcy - 36} L${fcx - 22} ${fcy - 12}" stroke="#1a1238" stroke-width="16" stroke-linecap="round"/>
    <path d="M${fcx + 80} ${fcy - 36} L${fcx + 22} ${fcy - 12}" stroke="#1a1238" stroke-width="16" stroke-linecap="round"/>
    <!-- Marques de colère -->
    <g stroke="#e5484d" stroke-width="6" stroke-linecap="round" fill="none">
      <path d="M${fcx - 62} ${fcy - 66} l14 8 M${fcx - 68} ${fcy - 52} l16 4"/>
    </g>
    <!-- Yeux -->
    <ellipse cx="${fcx - 35}" cy="${fcy + 2}" rx="23" ry="29" fill="#fff" stroke="#1a1238" stroke-width="7"/>
    <circle cx="${fcx - 29}" cy="${fcy + 7}" r="11" fill="#1a1238"/>
    <ellipse cx="${fcx + 35}" cy="${fcy + 2}" rx="23" ry="29" fill="#fff" stroke="#1a1238" stroke-width="7"/>
    <circle cx="${fcx + 29}" cy="${fcy + 7}" r="11" fill="#1a1238"/>
    <!-- Bouche grande ouverte (cri) + langue -->
    <path d="M${fcx - 46} ${fcy + 52} q46 50 92 4 q-10 42 -51 42 q-39 0 -41 -46z" fill="#1a1238"/>
    <path d="M${fcx - 5} ${fcy + 86} q20 -2 27 14 q-25 14 -36 0z" fill="#ff6a8e"/>
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
