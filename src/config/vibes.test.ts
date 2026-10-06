import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { VIBES, beatenBy, beats, matchup } from "./vibes";

describe("cycle des vibes", () => {
  it("suit Chaos → Wholesome → Rage → Ironique → Cringe → Absurde → Chaos", () => {
    expect(beats("chaos")).toBe("wholesome");
    expect(beats("wholesome")).toBe("rage");
    expect(beats("rage")).toBe("ironique");
    expect(beats("ironique")).toBe("cringe");
    expect(beats("cringe")).toBe("absurde");
    expect(beats("absurde")).toBe("chaos");
  });

  it("donne à chaque vibe exactement une force, une faiblesse et trois neutres", () => {
    for (const a of VIBES) {
      const results = VIBES.filter((d) => d !== a).map((d) => matchup(a, d));
      expect(results.filter((r) => r === "advantage")).toHaveLength(1);
      expect(results.filter((r) => r === "weakness")).toHaveLength(1);
      expect(results.filter((r) => r === "neutral")).toHaveLength(3);
      expect(matchup(a, a)).toBe("neutral");
    }
  });

  it("est cohérent : si A bat B, B est faible contre A", () => {
    for (const a of VIBES) {
      expect(beatenBy(beats(a))).toBe(a);
      expect(matchup(beats(a), a)).toBe("weakness");
    }
  });

  it("reste aligné avec l'enum SQL public.vibe", () => {
    const sql = readFileSync("supabase/migrations/20261006000100_types_et_extensions.sql", "utf8");
    const match = sql.match(/create type public\.vibe as enum \(([\s\S]*?)\);/);
    const values = match?.[1].match(/'([a-z]+)'/g)?.map((v) => v.slice(1, -1));
    expect(values).toEqual([...VIBES]);
  });
});
