import { describe, expect, it } from "vitest";
import { RARITIES } from "@/config/rarities";
import { VIBES } from "@/config/vibes";
import { cardArtDataUri, generateCardArtSvg } from "./generate";

describe("générateur d'illustrations", () => {
  it("est déterministe : même graine, même image", () => {
    const a = generateCardArtSvg({ seed: 42, vibe: "chaos", rarity: "rare" });
    const b = generateCardArtSvg({ seed: 42, vibe: "chaos", rarity: "rare" });
    expect(a).toBe(b);
  });

  it("varie avec la graine", () => {
    const a = generateCardArtSvg({ seed: 1, vibe: "rage", rarity: "commune" });
    const b = generateCardArtSvg({ seed: 2, vibe: "rage", rarity: "commune" });
    expect(a).not.toBe(b);
  });

  it("ne contient ni script, ni texte, ni ressource externe (sûr pour Storage)", () => {
    for (const vibe of VIBES) {
      for (const rarity of RARITIES) {
        for (let seed = 0; seed < 25; seed++) {
          const svg = generateCardArtSvg({ seed: seed * 977, vibe, rarity });
          expect(svg.startsWith("<svg")).toBe(true);
          expect(svg).not.toMatch(/<script|<text|<foreignObject|href=|on[a-z]+=|NaN|undefined/i);
        }
      }
    }
  });

  it("ajoute des ornements aux hautes raretés", () => {
    const common = generateCardArtSvg({ seed: 9, vibe: "wholesome", rarity: "commune" });
    const god = generateCardArtSvg({ seed: 9, vibe: "wholesome", rarity: "godlevel" });
    expect(god.length).toBeGreaterThan(common.length);
    expect(god).toContain('stroke="#FFC83D"');
  });

  it("produit une URL data: encodée", () => {
    expect(cardArtDataUri({ seed: 3, vibe: "cringe", rarity: "epique" })).toMatch(/^data:image\/svg\+xml;charset=utf-8,%3Csvg/);
  });
});
