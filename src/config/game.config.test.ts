import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GAME_CONFIG, gameConfigSchema } from "./game.config";
import { RARITIES, isAtLeast, rarityTier } from "./rarities";

describe("configuration du jeu", () => {
  it("est valide", () => {
    expect(gameConfigSchema.safeParse(GAME_CONFIG).success).toBe(true);
  });

  it("donne plus de poussière pour les cartes plus rares", () => {
    for (let i = 1; i < RARITIES.length; i++) {
      expect(GAME_CONFIG.DUST_VALUES[RARITIES[i]]).toBeGreaterThan(GAME_CONFIG.DUST_VALUES[RARITIES[i - 1]]);
    }
  });

  it("donne 3 boosters gratuits par jour, de 10 cartes", () => {
    expect(GAME_CONFIG.DAILY_FREE_BOOSTERS).toBe(3);
    expect(GAME_CONFIG.BOOSTER_SIZE).toBe(10);
  });

  it("garde une taille de booster compatible avec la base de données", () => {
    const sql = readFileSync("supabase/migrations/20261006000200_tables.sql", "utf8");
    const max = Number(sql.match(/cardinality\(card_ids\) between 1 and (\d+)\)/)?.[1]);
    expect(GAME_CONFIG.BOOSTER_SIZE).toBeLessThanOrEqual(max);
  });

  it("réserve les comptes et les achats aux 18 ans et plus", () => {
    expect(GAME_CONFIG.PURCHASES.MIN_AGE).toBe(18);
    expect(GAME_CONFIG.MIN_ACCOUNT_AGE).toBe(18);
  });
});

describe("raretés", () => {
  it("ordonne les raretés de commune à godlevel", () => {
    expect(rarityTier("commune")).toBe(0);
    expect(rarityTier("godlevel")).toBe(6);
    expect(isAtLeast("legendaire", "rare")).toBe(true);
    expect(isAtLeast("rare", "legendaire")).toBe(false);
  });

  it("reste alignée avec l'enum SQL public.rarity (dernière définition)", () => {
    const sql = readFileSync("supabase/migrations/20261008000700_nouvelles_raretes.sql", "utf8");
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
