import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "./game.config";
import { CURRENCIES, currencyForCountry, discountedPrice, isOfferActive, OFFERS, PRICE_POINTS } from "./shop";

describe("boutique", () => {
  it("a un prix par pack dans chaque devise", () => {
    for (const c of CURRENCIES) expect(PRICE_POINTS[c]).toHaveLength(GAME_CONFIG.PURCHASES.PRODUCTS.length);
  });

  it("garde le prix en euros aligné avec la config", () => {
    expect(PRICE_POINTS.EUR.map((p) => Math.round(p * 100))).toEqual(GAME_CONFIG.PURCHASES.PRODUCTS.map((p) => p.priceCents));
  });

  it("choisit la devise selon le pays", () => {
    expect(currencyForCountry("FR")).toBe("EUR");
    expect(currencyForCountry("de")).toBe("EUR");
    expect(currencyForCountry("BR")).toBe("BRL");
    expect(currencyForCountry("SN")).toBe("XOF");
    expect(currencyForCountry("KR")).toBe("USD");
    expect(currencyForCountry(null)).toBe("EUR");
  });

  it("arrondit les réductions selon la devise", () => {
    expect(discountedPrice(9.99, 20, "EUR")).toBe(7.99);
    expect(discountedPrice(1600, 20, "JPY")).toBe(1280);
  });

  it("respecte les dates des offres", () => {
    const launch = OFFERS.find((o) => o.code === "launch_20")!;
    expect(isOfferActive(launch, new Date("2026-10-08T12:00:00Z"))).toBe(true);
    expect(isOfferActive(launch, new Date("2027-01-02T12:00:00Z"))).toBe(false);
  });

  it("donne plus de bonus aux plus gros packs", () => {
    const ratios = GAME_CONFIG.PURCHASES.PRODUCTS.map((p) => (p.memeMoney + p.bonus) / p.priceCents);
    for (let i = 1; i < ratios.length; i++) expect(ratios[i]).toBeGreaterThan(ratios[i - 1]);
  });
});
