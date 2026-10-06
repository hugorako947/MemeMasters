import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GAME_CONFIG, gameConfigSchema } from "./game.config";
import { RARITIES, isAtLeast, rarityTier } from "./rarities";

describe("configuration du jeu", () => {
  it("est valide et ses taux font 100 %", () => {
    const total = RARITIES.reduce((sum, r) => sum + GAME_CONFIG.DROP_RATES[r], 0);
    expect(total).toBeCloseTo(100, 10);
  });

  it("refuse des taux dont la somme n'est pas 100 %", () => {
    const broken = { ...GAME_CONFIG, DROP_RATES: { ...GAME_CONFIG.DROP_RATES, commune: 50 } };
    expect(gameConfigSchema.safeParse(broken).success).toBe(false);
  });

  it("refuse un taux nul (une rareté deviendrait introuvable)", () => {
    const broken = {
      ...GAME_CONFIG,
      DROP_RATES: { ...GAME_CONFIG.DROP_RATES, godlevel: 0, commune: 55.05 },
    };
    expect(gameConfigSchema.safeParse(broken).success).toBe(false);
  });

  it("garde des taux décroissants avec la rareté", () => {
    for (let i = 1; i < RARITIES.length; i++) {
      expect(GAME_CONFIG.DROP_RATES[RARITIES[i]]).toBeLessThan(GAME_CONFIG.DROP_RATES[RARITIES[i - 1]]);
    }
  });

  it("donne plus de poussière pour les cartes plus rares", () => {
    for (let i = 1; i < RARITIES.length; i++) {
      expect(GAME_CONFIG.DUST_VALUES[RARITIES[i]]).toBeGreaterThan(GAME_CONFIG.DUST_VALUES[RARITIES[i - 1]]);
    }
  });

  it("réserve les comptes et les achats aux 18 ans et plus", () => {
    expect(GAME_CONFIG.PURCHASES.MIN_AGE).toBe(18);
    expect(GAME_CONFIG.MIN_ACCOUNT_AGE).toBe(18);
  });
});

describe("raretés", () => {
  it("ordonne les raretés de commune à godlevel", () => {
    expect(rarityTier("commune")).toBe(0);
    expect(rarityTier("godlevel")).toBe(7);
    expect(isAtLeast("legendaire", "rare")).toBe(true);
    expect(isAtLeast("rare", "legendaire")).toBe(false);
  });

  it("reste alignée avec l'enum SQL public.rarity", () => {
    const sql = readFileSync("supabase/migrations/20261006000100_types_et_extensions.sql", "utf8");
    const match = sql.match(/create type public\.rarity as enum \(([\s\S]*?)\);/);
    const values = match?.[1].match(/'([a-z]+)'/g)?.map((v) => v.slice(1, -1));
    expect(values).toEqual([...RARITIES]);
  });
});

describe("classement", () => {
  it("utilise les mêmes poids et le même lissage que la vue SQL", () => {
    const sql = readFileSync("supabase/migrations/20261006000400_classements.sql", "utf8");
    const { POPULARITY_LIKES_WEIGHT, POPULARITY_USAGE_WEIGHT, WIN_RATE_PRIOR_WINS, WIN_RATE_PRIOR_GAMES } =
      GAME_CONFIG.RANKING;
    expect(sql).toContain(`${POPULARITY_LIKES_WEIGHT} * coalesce(b.likes`);
    expect(sql).toContain(`${POPULARITY_USAGE_WEIGHT} * coalesce(b.usage_30d`);
    expect(sql).toContain(`(b.wins + ${WIN_RATE_PRIOR_WINS})::numeric / (b.games + ${WIN_RATE_PRIOR_GAMES})`);
  });
});
