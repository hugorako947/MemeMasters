import { describe, expect, it } from "vitest";
import { applyBattleResult, newRankRewards, progressToNextRank, RANK_REWARDS, RANKS, rankFor } from "./ranks";

describe("rangs et trophées", () => {
  it("compte 10 rangs, de bronze à immortel", () => {
    expect(RANKS).toHaveLength(10);
    expect(RANKS[0]).toBe("bronze");
    expect(RANKS[9]).toBe("immortel");
  });

  it("change de rang tous les 1 000 trophées", () => {
    expect(rankFor(0)).toBe("bronze");
    expect(rankFor(999)).toBe("bronze");
    expect(rankFor(1000)).toBe("argent");
    expect(rankFor(2000)).toBe("fer");
    expect(rankFor(9000)).toBe("immortel");
    expect(rankFor(25_000)).toBe("immortel");
  });

  it("donne +25 pour une victoire, −25 pour une défaite, 0 pour un nul, jamais sous 0", () => {
    expect(applyBattleResult(100, "win")).toBe(125);
    expect(applyBattleResult(100, "loss")).toBe(75);
    expect(applyBattleResult(100, "draw")).toBe(100);
    expect(applyBattleResult(10, "loss")).toBe(0);
  });

  it("indique la progression vers le rang suivant", () => {
    expect(progressToNextRank(1250)).toEqual({ current: 250, needed: 1000, next: "fer" });
    expect(progressToNextRank(9500)).toBeNull();
  });

  it("récompense chaque nouveau rang une seule fois", () => {
    expect(newRankRewards(0, 1000)).toEqual({ ranks: ["argent"], total: { boosters: 3, memeMoney: 10 } });
    // Redescendu puis remonté en argent : déjà récompensé.
    expect(newRankRewards(1, 1000).ranks).toEqual([]);
  });

  it("rend les récompenses de plus en plus généreuses", () => {
    for (let i = 2; i < RANKS.length; i++) {
      const prev = RANK_REWARDS[RANKS[i - 1]];
      const cur = RANK_REWARDS[RANKS[i]];
      expect(cur.memeMoney).toBeGreaterThan(prev.memeMoney);
      expect(cur.boosters).toBeGreaterThanOrEqual(prev.boosters);
    }
    expect(RANK_REWARDS.argent).toEqual({ boosters: 3, memeMoney: 10 });
  });
});
