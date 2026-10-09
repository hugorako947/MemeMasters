import { describe, expect, it } from "vitest";
import { GAME_CONFIG, gameConfigSchema } from "@/config/game.config";
import { canUpgrade, countsTowardCap, creditCents, maxSellable, nextUpgrade, planBulkSale, sellAllDuplicates, sellValueCents } from "./duplicates";

describe("améliorations", () => {
  it("Dorée coûte 5 doublons, puis Divine 10 de plus", () => {
    expect(nextUpgrade("normal")).toEqual({ to: "gold", cost: 5 });
    expect(nextUpgrade("gold")).toEqual({ to: "divine", cost: 10 });
    expect(nextUpgrade("divine")).toBeNull();
  });

  it("compte les doublons, pas le premier exemplaire", () => {
    expect(canUpgrade(5, "normal")).toBe(false); // 4 doublons
    expect(canUpgrade(6, "normal")).toBe(true); // 5 doublons
    expect(canUpgrade(11, "gold")).toBe(true);
    expect(canUpgrade(20, "divine")).toBe(false);
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
    { cardId: "leg", rarity: "legendaire" as const, quantity: 3, variant: "normal" as const },
    { cardId: "com", rarity: "commune" as const, quantity: 4, variant: "normal" as const },
    { cardId: "solo", rarity: "rare" as const, quantity: 1, variant: "normal" as const },
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
    const plan = planBulkSale([{ cardId: "god", rarity: "godlevel", quantity: 2, variant: "normal" }], 0);
    expect(plan.lines).toEqual([{ cardId: "god", count: 1 }]);
  });

  it("refuse une configuration où une revente coûterait 0", () => {
    const broken = structuredClone(GAME_CONFIG) as unknown as { DUPLICATES: { SELL_CENTS: Record<string, number> } };
    broken.DUPLICATES.SELL_CENTS.commune = 0;
    expect(gameConfigSchema.safeParse(broken).success).toBe(false);
  });
});
