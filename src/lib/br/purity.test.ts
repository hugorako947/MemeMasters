import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Le moteur ne calcule qu'en entiers : aucune fonction flottante de Math (résultats
 * variables d'un navigateur à l'autre), aucun nombre décimal, aucune division hors de
 * fixed.ts (où elle est corrigée pour être exacte), ni horloge, ni hasard non reproductible.
 */
const DIR = join(process.cwd(), "src", "lib", "br");
const FILES = readdirSync(DIR).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

/** Retire commentaires et chaînes de caractères (le contrôle ne porte que sur le code). */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/`(?:\\.|[^`\\])*`/g, "``")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''");
}

const FORBIDDEN_MATH = /\bMath\.(random|sin|cos|tan|asin|acos|atan|atan2|sqrt|cbrt|pow|exp|expm1|log|log2|log10|log1p|hypot|sinh|cosh|tanh|asinh|acosh|atanh|fround)\b/;
const DECIMAL = /(?<![\w$.])\d+(\.\d+|e[+-]?\d+)/i;
const CLOCK = /\b(Date|performance|crypto|setTimeout|setInterval)\b/;

describe("moteur en nombres entiers", () => {
  it("les fichiers du moteur sont bien analysés", () => {
    expect(FILES).toEqual(expect.arrayContaining(["engine.ts", "fixed.ts", "map.ts", "rng.ts", "rules.ts", "state.ts", "character.ts", "commands.ts", "replay.ts"]));
  });

  for (const file of FILES) {
    it(`${file} : ni fonction flottante, ni nombre décimal, ni division, ni horloge`, () => {
      const code = codeOnly(readFileSync(join(DIR, file), "utf8"));
      expect(code.match(FORBIDDEN_MATH)?.[0] ?? null).toBeNull();
      expect(code.match(DECIMAL)?.[0] ?? null).toBeNull();
      expect(code.match(CLOCK)?.[0] ?? null).toBeNull();
      if (file !== "fixed.ts") expect(code.includes("/")).toBe(false);
    });
  }
});
