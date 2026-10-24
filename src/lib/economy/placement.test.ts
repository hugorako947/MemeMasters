import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "@/config/game.config";
import { abandonReward, battleReward, memeMoneyForPlace, scaledPlace, trophiesForPlace } from "./placement";

const ECO = GAME_CONFIG.BATTLE_ROYALE.ECONOMY;

describe("récompenses d'une partie classée selon la place", () => {
  it("place ramenée sur 100 participants (la 1re place reste toujours la 1re)", () => {
    expect([1, 2, 50, 100].map((p) => scaledPlace(p, 100))).toEqual([1, 2, 50, 100]);
    expect([1, 2, 30, 60].map((p) => scaledPlace(p, 60))).toEqual([1, 4, 50, 100]);
    expect(scaledPlace(2, 2)).toBe(100);
  });

  it("table de base pour 100 participants (rang Bronze, sans élimination)", () => {
    const table = [1, 2, 3, 4, 5, 6, 10, 11, 20, 21, 30, 31, 40, 41, 50, 51, 70, 71, 90, 91, 100].map((p) => trophiesForPlace({ place: p, participants: 100, kills: 0, trophies: 0 }, ECO).delta);
    expect(table).toEqual([40, 30, 30, 24, 24, 18, 18, 12, 12, 6, 6, 2, 2, 0, 0, -4, -4, -8, -8, -12, -12]);
  });

  it("bonus d'élimination : +1 chacune, au plus +5, seulement dans la première moitié", () => {
    expect(trophiesForPlace({ place: 10, participants: 100, kills: 3, trophies: 0 }, ECO).delta).toBe(18 + 3);
    expect(trophiesForPlace({ place: 1, participants: 100, kills: 12, trophies: 0 }, ECO).delta).toBe(40 + 5);
    expect(trophiesForPlace({ place: 50, participants: 100, kills: 2, trophies: 0 }, ECO).delta).toBe(2);
    expect(trophiesForPlace({ place: 51, participants: 100, kills: 4, trophies: 0 }, ECO).delta).toBe(-4);
  });

  it("selon le rang : gains réduits de 5 % et pertes augmentées de 10 % par rang (arrondi)", () => {
    // Rang 3 (Or, 3 000 trophées) : gains × 0,85, pertes × 1,3.
    expect(trophiesForPlace({ place: 1, participants: 100, kills: 0, trophies: 3000 }, ECO).delta).toBe(34);
    expect(trophiesForPlace({ place: 100, participants: 100, kills: 0, trophies: 3000 }, ECO).delta).toBe(-16);
    // Immortel (rang 9) : gains × 0,55, pertes × 1,9.
    expect(trophiesForPlace({ place: 1, participants: 100, kills: 5, trophies: 9500 }, ECO).delta).toBe(25);
    expect(trophiesForPlace({ place: 95, participants: 100, kills: 0, trophies: 9500 }, ECO).delta).toBe(-23);
  });

  it("jamais sous 0 trophée", () => {
    expect(battleReward({ place: 100, participants: 100, kills: 0, trophies: 5 }, ECO).trophiesAfter).toBe(0);
    expect(battleReward({ place: 100, participants: 100, kills: 0, trophies: 5 }, ECO).trophyDelta).toBe(-5);
  });

  it("MemeMoney : Top 1 = 5, Top 2–5 = 3, Top 6–10 = 2, Top 11–25 = 1, au-delà rien", () => {
    expect([1, 2, 5, 6, 10, 11, 25, 26, 100].map((p) => memeMoneyForPlace(p, 100, ECO))).toEqual([5, 3, 3, 2, 2, 1, 1, 0, 0]);
  });

  it("plafond quotidien de MemeMoney gagnée en bataille", () => {
    expect(battleReward({ place: 1, participants: 100, kills: 0, trophies: 0, memeMoneyEarnedToday: 0 }, ECO).memeMoney).toBe(5);
    expect(battleReward({ place: 1, participants: 100, kills: 0, trophies: 0, memeMoneyEarnedToday: 13 }, ECO).memeMoney).toBe(2);
    expect(battleReward({ place: 1, participants: 100, kills: 0, trophies: 0, memeMoneyEarnedToday: 15 }, ECO).memeMoney).toBe(0);
  });

  it("abandon : élimination à la place du moment, 5 trophées de moins, aucune MemeMoney", () => {
    const r = abandonReward({ place: 40, participants: 100, kills: 1, trophies: 1000 }, ECO);
    // Place 40 (+2) + 1 élimination = +3 ; rang 1 : × 0,95 → 3 ; puis −5.
    expect(r.trophyDelta).toBe(-2);
    expect(r.memeMoney).toBe(0);
    expect(abandonReward({ place: 90, participants: 100, kills: 0, trophies: 2 }, ECO).trophiesAfter).toBe(0);
  });
});
