import { describe, expect, it } from "vitest";
import { GAME_CONFIG, gameConfigSchema } from "@/config/game.config";
import { boostedStats, canUpgrade, creditCents, lookOf, MAX_LEVEL, maxSellable, nextUpgrade, planBulkSale, planBulkUpgrade, sellAllDuplicates, sellValueCents } from "./duplicates";

describe("évolutions", () => {
  it("passe de 1 à 2 puis 3 étoiles, puis Divine (5, 10, 15, 20 exemplaires pour une commune)", () => {
    expect(MAX_LEVEL).toBe(4);
    expect(nextUpgrade("commune", 0)).toEqual({ to: 1, cost: 5 });
    expect(nextUpgrade("commune", 1)).toEqual({ to: 2, cost: 10 });
    expect(nextUpgrade("commune", 2)).toEqual({ to: 3, cost: 15 });
    expect(nextUpgrade("commune", 3)).toEqual({ to: 4, cost: 20 });
    expect(nextUpgrade("commune", 4)).toBeNull();
    expect(nextUpgrade("godlevel", 3)).toEqual({ to: 4, cost: 4 });
  });

  it("demande moins d'exemplaires pour les cartes plus rares", () => {
    const total = (r: Parameters<typeof nextUpgrade>[0]) => GAME_CONFIG.DUPLICATES.UPGRADES[r].reduce((a, b) => a + b, 0);
    const order = ["commune", "rare", "epique", "legendaire", "godlevel"] as const;
    for (let i = 1; i < order.length; i++) expect(total(order[i])).toBeLessThanOrEqual(total(order[i - 1]));
  });

  it("compte les exemplaires en trop, pas le premier", () => {
    expect(canUpgrade("commune", 5, 0)).toBe(false); // 4 en trop
    expect(canUpgrade("commune", 6, 0)).toBe(true); // 5 en trop
    expect(canUpgrade("legendaire", 3, 0)).toBe(true); // 2 en trop
    expect(canUpgrade("commune", 21, 3)).toBe(true); // 20 en trop : Divine
    expect(canUpgrade("commune", 99, 4)).toBe(false);
  });

  it("augmente un peu les statistiques à chaque niveau, jusqu'à +10 % en Divine", () => {
    const card = { hp: 100, atk: 40, def: 35, spd: 80 };
    expect(boostedStats(card, 0)).toEqual(card);
    expect(boostedStats(card, 1)).toEqual({ hp: 103, atk: 41, def: 36, spd: 82 });
    expect(boostedStats(card, 3)).toEqual({ hp: 108, atk: 43, def: 38, spd: 86 });
    expect(boostedStats(card, 4)).toEqual({ hp: 110, atk: 44, def: 39, spd: 88 });
  });

  it("garde la couleur de la rareté jusqu'à 3 étoiles : seule la Divine change d'apparence", () => {
    expect([0, 1, 2, 3, 4].map((l) => lookOf(l as 0 | 1 | 2 | 3 | 4))).toEqual(["normal", "normal", "normal", "normal", "divine"]);
  });
});

describe("tout faire évoluer", () => {
  it("monte chaque carte aussi haut que ses exemplaires en trop le permettent, en gardant toujours le premier", () => {
    const plan = planBulkUpgrade([
      { cardId: "a", rarity: "commune", quantity: 16, level: 0 }, // 15 en trop : 5 (★) + 10 (★★)
      { cardId: "b", rarity: "commune", quantity: 5, level: 0 }, // 4 en trop : rien
      { cardId: "c", rarity: "godlevel", quantity: 11, level: 0 }, // 10 en trop : 1 + 2 + 3 + 4, Divine
      { cardId: "d", rarity: "legendaire", quantity: 50, level: 4 }, // déjà Divine
      { cardId: "e", rarity: "rare", quantity: 0, level: 0 }, // pas possédée
    ]);
    expect(plan.lines).toEqual([
      { cardId: "a", from: 0, to: 2, used: 15 },
      { cardId: "c", from: 0, to: 4, used: 10 },
    ]);
    expect(plan.evolutions).toBe(6);
    expect(plan.used).toBe(25);
  });

  it("repart du niveau actuel de chaque carte et s'arrête dès qu'il manque des exemplaires", () => {
    // Rare ★ avec 12 en trop : ★★ coûte 8 ; il en reste 4, ★★★ en demande 12.
    expect(planBulkUpgrade([{ cardId: "r", rarity: "rare", quantity: 13, level: 1 }]).lines).toEqual([{ cardId: "r", from: 1, to: 2, used: 8 }]);
    expect(planBulkUpgrade([{ cardId: "r", rarity: "rare", quantity: 8, level: 1 }])).toEqual({ lines: [], evolutions: 0, used: 0 });
  });
});

describe("revente", () => {
  it("ne revend que les exemplaires en trop : la carte reste toujours dans la collection", () => {
    expect(maxSellable(3)).toBe(2);
    expect(maxSellable(1)).toBe(0);
    expect(maxSellable(0)).toBe(0);
  });

  it("revend tous les exemplaires en trop d'un coup (ex. : Lama Zen ×3 → revendre ×2), sans limite quotidienne", () => {
    expect(sellAllDuplicates("epique", 3)).toEqual({ count: 2, cents: 100 });
    expect(sellAllDuplicates("epique", 1)).toEqual({ count: 0, cents: 0 });
    expect(sellAllDuplicates("commune", 50)).toEqual({ count: 49, cents: 490 });
    expect(sellAllDuplicates("godlevel", 3)).toEqual({ count: 2, cents: 12000 });
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

  it("ne vend que des doublons, des plus courants aux plus rares, sans limite quotidienne", () => {
    const plan = planBulkSale(items);
    expect(plan.lines).toEqual([
      { cardId: "com", count: 3 },
      { cardId: "leg", count: 2 },
    ]);
    expect(plan.cents).toBe(30 + 600);
  });

  it("revend aussi les doublons de Godlevel", () => {
    const plan = planBulkSale([{ cardId: "god", rarity: "godlevel", quantity: 2 }]);
    expect(plan.lines).toEqual([{ cardId: "god", count: 1 }]);
    expect(plan.cents).toBe(6000);
  });

  it("refuse une configuration où une revente coûterait 0", () => {
    const broken = structuredClone(GAME_CONFIG) as unknown as { DUPLICATES: { SELL_CENTS: Record<string, number> } };
    broken.DUPLICATES.SELL_CENTS.commune = 0;
    expect(gameConfigSchema.safeParse(broken).success).toBe(false);
  });
});
