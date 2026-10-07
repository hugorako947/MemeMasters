import { describe, expect, it } from "vitest";
import { GAME_CONFIG, gameConfigSchema } from "@/config/game.config";
import { bestOddsFor, boosterOdds, composition, drawBoosterRarities } from "./boosters";

const count = (list: string[], r: string) => list.filter((x) => x === r).length;

describe("composition des boosters", () => {
  it("journalier : 5 communes, 3 rares, 1 ou 2 épiques, 1 ou 0 légendaire", () => {
    const usual = composition(GAME_CONFIG.BOOSTERS.daily, false, false);
    expect([count(usual, "commune"), count(usual, "rare"), count(usual, "epique"), count(usual, "legendaire")]).toEqual([5, 3, 2, 0]);
    const lucky = composition(GAME_CONFIG.BOOSTERS.daily, true, false);
    expect([count(lucky, "epique"), count(lucky, "legendaire")]).toEqual([1, 1]);
    expect(usual).toHaveLength(10);
  });

  it("spécial : 3 communes, 3 rares, 2 épiques, 1 ou 2 légendaires, 1 ou 0 brainrot", () => {
    const usual = composition(GAME_CONFIG.BOOSTERS.special, false, false);
    expect([count(usual, "commune"), count(usual, "rare"), count(usual, "epique"), count(usual, "legendaire"), count(usual, "brainrot")]).toEqual([3, 3, 2, 2, 0]);
    const lucky = composition(GAME_CONFIG.BOOSTERS.special, true, false);
    expect([count(lucky, "legendaire"), count(lucky, "brainrot")]).toEqual([1, 1]);
  });

  it("très spécial : 2 communes, 2 rares, 2 épiques, 2 légendaires, 1 ou 2 brainrots, 1 ou 0 superbrainrot", () => {
    const usual = composition(GAME_CONFIG.BOOSTERS.very_special, false, false);
    expect([count(usual, "commune"), count(usual, "rare"), count(usual, "epique"), count(usual, "legendaire"), count(usual, "brainrot"), count(usual, "superbrainrot")]).toEqual([2, 2, 2, 2, 2, 0]);
    const lucky = composition(GAME_CONFIG.BOOSTERS.very_special, true, false);
    expect([count(lucky, "brainrot"), count(lucky, "superbrainrot")]).toEqual([1, 1]);
  });

  it("la Godlevel remplace une commune, dans n'importe quel booster", () => {
    for (const kind of ["daily", "special", "very_special"] as const) {
      const cards = composition(GAME_CONFIG.BOOSTERS[kind], false, true);
      expect(count(cards, "godlevel")).toBe(1);
      expect(cards).toHaveLength(10);
    }
  });

  it("oriente l'emplacement au choix vers la rareté habituelle", () => {
    for (const kind of ["daily", "special", "very_special"] as const) {
      expect(GAME_CONFIG.BOOSTERS[kind].flex.upgradeChance).toBeLessThan(50);
    }
  });

  it("refuse une composition qui ne fait pas 10 cartes", () => {
    const broken = structuredClone(GAME_CONFIG);
    broken.BOOSTERS.daily.fixed.commune = 6;
    expect(gameConfigSchema.safeParse(broken).success).toBe(false);
  });
});

describe("probabilités publiées", () => {
  it("donne les chances d'au moins une carte par booster", () => {
    const daily = boosterOdds("daily");
    expect(daily.commune).toBe(1);
    expect(daily.epique).toBe(1);
    expect(daily.legendaire).toBeCloseTo(0.15);
    expect(daily.brainrot).toBe(0);
    expect(daily.godlevel).toBeCloseTo(0.0005);
  });

  it("indique le booster le plus accessible pour chaque rareté", () => {
    expect(bestOddsFor("legendaire").kind).toBe("daily");
    expect(bestOddsFor("brainrot")).toEqual({ kind: "special", chance: expect.closeTo(0.12) });
    expect(bestOddsFor("superbrainrot").kind).toBe("very_special");
    expect(bestOddsFor("godlevel").kind).toBe("daily");
  });
});

describe("tirage", () => {
  it("révèle les cartes de la plus courante à la plus rare", () => {
    const r = drawBoosterRarities("daily", () => 0.99);
    expect(r.rarities[0]).toBe("commune");
    expect(r.rarities.at(-1)).toBe("epique");
    expect(r.upgraded).toBe(false);
  });

  it("garantit la légendaire au 10e booster journalier sans elle (pity)", () => {
    const r = drawBoosterRarities("daily", () => 0.99, GAME_CONFIG.PITY_THRESHOLD - 1);
    expect(r.upgraded).toBe(true);
    expect(r.pityTriggered).toBe(true);
    expect(r.rarities).toContain("legendaire");
  });

  it("respecte les fréquences sur un grand nombre de tirages", () => {
    let seed = 42;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    let upgrades = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) if (drawBoosterRarities("special", random).upgraded) upgrades++;
    expect(upgrades / n).toBeGreaterThan(0.11);
    expect(upgrades / n).toBeLessThan(0.13);
  });
});
