/**
 * Vérifie, avant `npm run dev` et `npm run build`, que toutes les dépendances
 * de package.json sont installées. Sans ce contrôle, une bibliothèque ajoutée
 * dans une nouvelle version du projet provoque une erreur peu claire
 * (« Module not found »).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
const missing = names.filter((name) => !existsSync(join("node_modules", name, "package.json")));

if (missing.length > 0) {
  console.error(`\n✖ ${missing.length} dépendance(s) manquante(s) : ${missing.join(", ")}`);
  console.error("  Le projet a reçu de nouvelles bibliothèques. Installez-les puis relancez :\n");
  console.error("    npm install\n");
  process.exit(1);
}
