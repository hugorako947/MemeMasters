import { describe, expect, it } from "vitest";
import { GAME_CONFIG, gameConfigSchema } from "@/config/game.config";
import { boostedStats, canUpgrade, countsTowardCap, creditCents, lookOf, maxSellable, nextUpgrade, planBulkSale, sellAllDuplicates, sellValueCents } from "./duplicates";

describe("améliorations", () => {
  it("passe de Dorée ★ à Dorée ★★ puis Divine ★★★ (5, 10, 15 exemplaires pour une commune)", () => {
    expect(nextUpgrade("commune", 0)).toEqual({ to: 1, cost: 5 });
    expect(nextUpgrade("commune", 1)).toEqual({ to: 2, cost: 10 });
    expect(nextUpgrade("commune", 2)).toEqual({ to: 3, cost: 15 });
    expect(nextUpgrade("commune", 3)).toBeNull();
  });

  it("demande moins d'exemplaires pour les cartes plus rares", () => {
    const total = (r: Parameters<typeof nextUpgrade>[0]) => GAME_CONFIG.DUPLICATES.UPGRADES[r].reduce((a, b) => a + b, 0);
    const order = ["commune", "rare", "epique", "legendaire", "brainrot", "superbrainrot", "godlevel"] as const;
    for (let i = 1; i < order.length; i++) expect(total(order[i])).toBeLessThanOrEqual(total(order[i - 1]));
  });

  it("compte les exemplaires en trop, pas le premier", () => {
    expect(canUpgrade("commune", 5, 0)).toBe(false); // 4 en trop
    expect(canUpgrade("commune", 6, 0)).toBe(true); // 5 en trop
    expect(canUpgrade("legendaire", 3, 0)).toBe(true); // 2 en trop
    expect(canUpgrade("commune", 99, 3)).toBe(false);
  });

  it("augmente un peu les statistiques à chaque niveau", () => {
    const card = { hp: 100, atk: 40, def: 35, spd: 80 };
    expect(boostedStats(card, 0)).toEqual(card);
    expect(boostedStats(card, 1)).toEqual({ hp: 103, atk: 41, def: 36, spd: 82 });
    expect(boostedStats(card, 3)).toEqual({ hp: 110, atk: 44, def: 39, spd: 88 });
  });

  it("donne l'apparence dorée aux niveaux 1 et 2, divine au niveau 3", () => {
    expect([0, 1, 2, 3].map((l) => lookOf(l as 0 | 1 | 2 | 3))).toEqual(["normal", "gold", "gold", "divine"]);
  });
});

describe("revente", () => {
  it("ne revend que les exemplaires en trop : la carte reste toujours dans la collection", () => {
    expect(maxSellable(3)).toBe(2);
    expect(maxSellable(1)).toBe(0);
    expect(maxSellable(0)).toBe(0);
  });

  it("revend tous les exemplaires en trop d'un coup (ex. : Lama Zen ×3 → revendre ×2)", () => {
    expect(sellAllDuplicates("epique", 3, 2000)).toEqual({ count: 2, cents: 100, limited: false });
    expect(sellAllDuplicates("epique", 1, 2000)).toEqual({ count: 0, cents: 0, limited: false });
  });

  it("s'arrête au plafond du jour pour les communes, mais pas pour une Godlevel", () => {
    expect(sellAllDuplicates("commune", 50, 30)).toEqual({ count: 3, cents: 30, limited: true });
    expect(sellAllDuplicates("godlevel", 3, 0)).toEqual({ count: 2, cents: 12000, limited: false });
  });

  it("applique les prix (en centièmes de MemeMoney)", () => {
    expect(sellValueCents("commune", 10)).toBe(100);
    expect(sellValueCents("rare", 4)).toBe(100);
    expect(sellValueCents("godlevel", 1)).toBe(6000);
  });

  it("conserve les fractions d'une vente à l'autre", () => {
    expect(creditCents(0, 30)).toEqual({ memeMoney: 0, carryCents: 30 });
    expect(creditCents(80, 30)).toEqual({ memeMoney: 1, carryCents: 10 });
    expect(creditCents(50, 300)).toEqual({ memeMoney: 3, carryCents: 50 });
  });

  it("rapporte peu : un booster journalier entier en doublons vaut moins de 3 MemeMoney", () => {
    const cents = sellValueCents("commune", 5) + sellValueCents("rare", 3) + sellValueCents("epique", 2);
    expect(cents / 100).toBeLessThan(3);
    expect(cents / 100).toBeLessThan(GAME_CONFIG.MEME_MONEY.EXTRA_DAILY_BOOSTER_PRICE / 5);
  });
});

describe("revente groupée", () => {
  const items = [
    { cardId: "leg", rarity: "legendaire" as const, quantity: 3 },
    { cardId: "com", rarity: "commune" as const, quantity: 4 },
    { cardId: "solo", rarity: "rare" as const, quantity: 1 },
  ];

  it("ne vend que des doublons, des plus courants aux plus rares", () => {
    const plan = planBulkSale(items, 100_000);
    expect(plan.lines).toEqual([
      { cardId: "com", count: 3 },
      { cardId: "leg", count: 2 },
    ]);
    expect(plan.cents).toBe(30 + 600);
  });

  it("arrête les communes, rares et épiques au plafond, mais pas les légendaires", () => {
    const plan = planBulkSale(items, 20);
    expect(plan.lines).toEqual([
      { cardId: "com", count: 2 },
      { cardId: "leg", count: 2 },
    ]);
    expect(plan.cappedCents).toBe(20);
  });

  it("laisse toujours vendre un doublon de Godlevel, même si sa valeur dépasse le plafond", () => {
    expect(countsTowardCap("godlevel")).toBe(false);
    expect(countsTowardCap("epique")).toBe(true);
    const plan = planBulkSale([{ cardId: "god", rarity: "godlevel", quantity: 2 }], 0);
    expect(plan.lines).toEqual([{ cardId: "god", count: 1 }]);
  });

  it("refuse une configuration où une revente coûterait 0", () => {
    const broken = structuredClone(GAME_CONFIG) as unknown as { DUPLICATES: { SELL_CENTS: Record<string, number> } };
    broken.DUPLICATES.SELL_CENTS.commune = 0;
    expect(gameConfigSchema.safeParse(broken).success).toBe(false);
  });
});
