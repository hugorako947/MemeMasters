import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Toutes les pages du groupe (jeu), sous-dossiers compris. */
function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pages(path);
    return name === "page.tsx" ? [path] : [];
  });
}

describe("pages du groupe (jeu)", () => {
  // Le layout du groupe laisse passer les visiteurs (pour l'Accueil vitrine) :
  // chaque page doit donc vérifier elle-même le joueur.
  it.each(pages(join(process.cwd(), "src", "app", "(jeu)")).map((p) => [p.split("(jeu)")[1]]))("%s appelle requirePlayer()", (rel) => {
    const source = readFileSync(join(process.cwd(), "src", "app", "(jeu)", rel), "utf8");
    expect(source).toMatch(/requirePlayer\(\)/);
  });
});
