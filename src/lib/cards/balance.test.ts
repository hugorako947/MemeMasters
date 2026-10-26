import { describe, expect, it } from "vitest";
import { RARITIES } from "@/config/rarities";
import { SAMPLE_CARDS } from "@/components/card/sample-cards";
import { cardSchema } from "@/lib/validation/card";
import { checkBudget, statBudget, statIndex } from "./balance";

describe("budget de stats", () => {
  it("vaut 160 pour une commune et 208 pour une godlevel", () => {
    expect(statBudget("commune")).toBe(160);
    expect(statBudget("godlevel")).toBeCloseTo(208, 10);
  });

  it("croît avec la rareté : 160, 168, 176, 184, puis 208 pour la godlevel", () => {
    expect(RARITIES.map((r) => Math.round(statBudget(r)))).toEqual([160, 168, 176, 184, 208]);
  });

  it("calcule l'indice PV/2 + ATK + DEF + VIT/2", () => {
    expect(statIndex({ hp: 90, atk: 40, def: 35, spd: 80 })).toBe(160);
  });

  it("détecte une carte hors tolérance (±3 %)", () => {
    expect(checkBudget({ hp: 90, atk: 40, def: 35, spd: 80 }, "commune").withinTolerance).toBe(true);
    expect(checkBudget({ hp: 140, atk: 65, def: 65, spd: 100 }, "commune").withinTolerance).toBe(false);
  });
});

describe("cartes de démonstration", () => {
  it("couvrent les 5 raretés", () => {
    expect(new Set(SAMPLE_CARDS.map((c) => c.rarity))).toEqual(new Set(RARITIES));
  });

  it.each(SAMPLE_CARDS.map((c) => [c.name, c] as const))("%s respecte le schéma et le budget", (_, card) => {
    expect(cardSchema.safeParse(card).success).toBe(true);
    expect(checkBudget(card, card.rarity).withinTolerance).toBe(true);
  });
});
