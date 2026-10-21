import { describe, expect, it } from "vitest";
import { RARITIES } from "@/config/rarities";
import { cardArtDataUri, decorFor, generateCardArtSvg } from "./generate";

describe("générateur d'illustrations", () => {
  it("est déterministe : même graine, même image", () => {
    const a = generateCardArtSvg({ seed: 42, rarity: "rare" });
    const b = generateCardArtSvg({ seed: 42, rarity: "rare" });
    expect(a).toBe(b);
  });

  it("varie avec la graine", () => {
    const a = generateCardArtSvg({ seed: 1, rarity: "commune" });
    const b = generateCardArtSvg({ seed: 2, rarity: "commune" });
    expect(a).not.toBe(b);
  });

  it("tire les 6 décors de la graine", () => {
    expect(new Set(Array.from({ length: 12 }, (_, i) => decorFor(i))).size).toBe(6);
  });

  it("ne contient ni script, ni texte, ni ressource externe (sûr pour Storage)", () => {
    for (const rarity of RARITIES) {
      for (let seed = 0; seed < 150; seed++) {
        const svg = generateCardArtSvg({ seed: seed * 977, rarity });
        expect(svg.startsWith("<svg")).toBe(true);
        expect(svg).not.toMatch(/<script|<text|<foreignObject|href=|on[a-z]+=|NaN|undefined/i);
      }
    }
  });

  it("ajoute des ornements aux hautes raretés", () => {
    const common = generateCardArtSvg({ seed: 9, rarity: "commune" });
    const god = generateCardArtSvg({ seed: 9, rarity: "godlevel" });
    expect(god.length).toBeGreaterThan(common.length);
    expect(god).toContain('stroke="#FFC83D"');
  });

  it("produit une URL data: encodée", () => {
    expect(cardArtDataUri({ seed: 3, rarity: "epique" })).toMatch(/^data:image\/svg\+xml;charset=utf-8,%3Csvg/);
  });
});
