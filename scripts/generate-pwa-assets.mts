/**
 * Génère les icônes de la PWA dans public/icons à partir de l'image d'icône fournie par le propriétaire
 * (scripts/icon-source.png : le personnage du jeu qui tire, sur fond vert de battle royale).
 * L'image (paysage) est ajustée en carré sur son propre vert ; la version « maskable » est rétrécie
 * dans la zone sûre. Usage : npm run assets:pwa
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "icon-source.png");
const OUT = join(process.cwd(), "public", "icons");
mkdirSync(OUT, { recursive: true });

// [nom, taille, maskable]. Les icônes maskable gardent une marge (zone sûre) ; les autres sont pleines.
const jobs: Array<[string, number, boolean]> = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, false],
  ["favicon-32.png", 32, false],
];

async function run(): Promise<void> {
  // Vert de fond de l'image (coin), pour remplir le carré sans couture visible.
  const corner = await sharp(SRC).extract({ left: 4, top: 4, width: 3, height: 3 }).raw().toBuffer();
  const green = { r: corner[0], g: corner[1], b: corner[2], alpha: 1 };
  for (const [name, size, maskable] of jobs) {
    // Maskable : le contenu tient dans ~80 % (le reste peut être rogné par le masque du système).
    const content = maskable ? Math.round(size * 0.8) : size;
    const inner = await sharp(SRC).resize(content, content, { fit: "contain", background: green }).png().toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background: green } })
      .composite([{ input: inner, gravity: "center" }])
      .png({ compressionLevel: 9 })
      .toFile(join(OUT, name));
  }
  console.log(`Icônes générées dans ${OUT}`);
}

run();
