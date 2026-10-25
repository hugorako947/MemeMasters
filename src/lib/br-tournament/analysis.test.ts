import { describe, expect, it } from "vitest";
import { analyse, meanInterval, ratioOfWins, THRESHOLDS, wilson } from "./analysis";
import type { GameReport } from "./game";

/** Partie fictive : 100 participants, la carte k va à l'emplacement k % cartes, le vainqueur est `winner`. */
function report(over: Partial<GameReport> & { winner: number; cardsCount?: number }): GameReport {
  const cards = Array.from({ length: 100 }, (_, i) => i % (over.cardsCount ?? 40));
  const places = Array.from({ length: 100 }, (_, i) => (i === over.winner ? 1 : i < over.winner ? i + 2 : i + 1));
  return {
    series: "standard",
    seed: 1,
    level: 50,
    minutes: 6,
    kills: 99,
    zoneKills: 5,
    cards,
    evolutions: Array.from({ length: 100 }, () => 0),
    places,
    idleBots: 0,
    stuckEpisodes: 0,
    stuckList: [],
    unstickEpisodes: 0,
    tickMsSum: 0,
    ticksTimed: 0,
    tickMsMax: 0,
    ...over,
  };
}

describe("statistiques du banc d'essai", () => {
  it("intervalle de Wilson à 95 %", () => {
    const [lo, hi] = wilson(10, 100);
    expect(lo).toBeCloseTo(0.05523, 4);
    expect(hi).toBeCloseTo(0.17437, 4);
    expect(wilson(0, 0)).toEqual([0, 1]);
  });

  it("rapport des victoires de deux groupes de même taille, avec son intervalle", () => {
    const r = ratioOfWins(565, 435);
    expect(r.ratio).toBeCloseTo(565 / 435, 6);
    expect(r.lo).toBeLessThan(r.ratio);
    expect(r.hi).toBeGreaterThan(r.ratio);
    expect(ratioOfWins(0, 0).ratio).toBe(1);
  });

  it("moyenne et intervalle", () => {
    const m = meanInterval([4, 6, 5, 7, 3]);
    expect(m.mean).toBe(5);
    expect(m.lo).toBeLessThan(5);
    expect(m.hi).toBeGreaterThan(5);
  });

  it("seuils de la conception : une partie trop courte, trop de morts par la zone ou un bot coincé font échouer", () => {
    const good = Array.from({ length: 40 }, (_, k) => report({ winner: k % 40 }));
    const ok = analyse(good, { quick: false, tickMeanMs: 0.5 });
    const blocking = ok.indicators.filter((x) => x.blocking);
    expect(blocking.every((x) => x.ok)).toBe(true);
    expect(ok.ok).toBe(true);

    const short = analyse(good.map((r) => ({ ...r, minutes: 3 })), { quick: false, tickMeanMs: 0.5 });
    expect(short.indicators.find((x) => x.key === "duration")!.ok).toBe(false);
    expect(short.ok).toBe(false);

    const zone = analyse(good.map((r) => ({ ...r, zoneKills: 20 })), { quick: false, tickMeanMs: 0.5 });
    expect(zone.indicators.find((x) => x.key === "zone")!.ok).toBe(false);

    const stuck = analyse([{ ...good[0], stuckEpisodes: 1 }, ...good.slice(1)], { quick: false, tickMeanMs: 0.5 });
    expect(stuck.indicators.find((x) => x.key === "stuck")!.ok).toBe(false);

    const slow = analyse(good, { quick: false, tickMeanMs: THRESHOLDS.tickMeanMs + 0.1 });
    expect(slow.ok).toBe(false);
  });

  it("taux de Top 1 par carte : une carte trop forte est signalée (dès qu'elle a assez de parties)", () => {
    // 4 cartes, 4 000 parties : la carte 0 gagne 9 fois sur 10 (taux 3,6 % ; attendu 1 %).
    const reports = Array.from({ length: 4000 }, (_, k) => report({ winner: k % 10 === 9 ? 1 : 0, cardsCount: 4 }));
    const a = analyse(reports, { quick: false, tickMeanMs: 0.5 });
    const card = a.cards.find((c) => c.card === 0)!;
    expect(card.plays).toBe(100_000);
    expect(card.top1Rate).toBeCloseTo(3600 / 100_000, 6);
    expect(a.indicators.find((x) => x.key === "cards")!.ok).toBe(false);
    // En mode rapide, l'indicateur est seulement indicatif.
    expect(analyse(reports, { quick: true, tickMeanMs: 0.5 }).indicators.find((x) => x.key === "cards")!.blocking).toBe(false);
  });

  it("séries de comparaison : rareté et évolution (groupe A = emplacements 0 à 49)", () => {
    const rarity = Array.from({ length: 1000 }, (_, k) => report({ series: "rarity", winner: k % 10 < 6 ? 3 : 70 }));
    const evolution = Array.from({ length: 1000 }, (_, k) => report({ series: "evolution", winner: k % 2 ? 3 : 70 }));
    const a = analyse([...rarity, ...evolution], { quick: false, tickMeanMs: 0.5 });
    const r = a.indicators.find((x) => x.key === "rarity")!;
    expect(r.value).toBeCloseTo(1.5, 6);
    expect(r.ok).toBe(false);
    const e = a.indicators.find((x) => x.key === "evolution")!;
    expect(e.value).toBeCloseTo(1, 6);
    expect(e.ok).toBe(true);
  });
});
