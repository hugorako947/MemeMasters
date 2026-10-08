import { describe, expect, it } from "vitest";
import { VIBES } from "@/config/vibes";
import { checkBudget } from "@/lib/cards/balance";
import { cardSchema } from "@/lib/validation/card";
import { STARTER_SET } from "./starter-set";

const count = (pred: (c: (typeof STARTER_SET)[number]) => boolean) => STARTER_SET.filter(pred).length;

describe("jeu de départ", () => {
  it("compte 40 cartes réparties selon les raretés prévues", () => {
    expect(STARTER_SET).toHaveLength(40);
    const expected = { commune: 12, rare: 10, epique: 8, legendaire: 5, brainrot: 3, superbrainrot: 1, godlevel: 1 };
    for (const [rarity, n] of Object.entries(expected)) expect(count((c) => c.rarity === rarity), rarity).toBe(n);
  });

  it("a au moins 6 cartes par vibe", () => {
    for (const v of VIBES) expect(count((c) => c.vibe === v), v).toBeGreaterThanOrEqual(6);
  });

  it("a des identifiants et des slugs uniques", () => {
    expect(new Set(STARTER_SET.map((c) => c.id)).size).toBe(40);
    expect(new Set(STARTER_SET.map((c) => c.slug)).size).toBe(40);
  });

  it.each(STARTER_SET.map((c) => [c.name, c] as const))("%s : schéma valide et budget respecté", (_, card) => {
    expect(cardSchema.safeParse(card).success).toBe(true);
    expect(checkBudget(card, card.rarity).withinTolerance).toBe(true);
  });
});
