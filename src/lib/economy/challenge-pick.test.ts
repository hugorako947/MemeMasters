import { describe, expect, it } from "vitest";
import { pickTemplate } from "./challenge-pick";

const templates = [
  { id: "a", weight: 3 },
  { id: "b", weight: 1 },
  { id: "c", weight: 1 },
];

describe("tirage du défi du jour", () => {
  it("donne le même défi toute la journée", () => {
    expect(pickTemplate(templates, "joueur-1", "2026-10-12", null)).toEqual(pickTemplate(templates, "joueur-1", "2026-10-12", null));
  });

  it("ne redonne jamais le défi de la veille", () => {
    for (let d = 1; d <= 28; d++) {
      const day = `2026-10-${String(d).padStart(2, "0")}`;
      expect(pickTemplate(templates, "joueur-1", day, "a")?.id).not.toBe("a");
    }
  });

  it("varie d'un jour et d'un joueur à l'autre, en respectant les poids", () => {
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (let p = 0; p < 300; p++) counts[pickTemplate(templates, `joueur-${p}`, "2026-10-12", null)!.id]++;
    expect(counts.a).toBeGreaterThan(counts.b);
    expect(counts.b).toBeGreaterThan(20);
    expect(counts.c).toBeGreaterThan(20);
  });

  it("ne tire rien s'il n'y a aucun défi actif", () => {
    expect(pickTemplate([], "joueur-1", "2026-10-12", null)).toBeNull();
  });
});
