import { describe, expect, it } from "vitest";
import { buildTrophySeries } from "./trophy-series";
import { winStreaks } from "@/lib/server/players";

const now = Date.parse("2026-10-07T12:00:00Z");
const day = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

describe("graphique des trophées", () => {
  it("affiche une courbe plate pour un nouveau joueur", () => {
    const s = buildTrophySeries([{ at: iso(now - 2 * day), trophies: 0 }], 0, iso(now - 2 * day), "30d", now);
    expect(s.changes).toBe(0);
    expect(s.yMax).toBe(1000);
    expect(s.points.at(-1)).toEqual({ at: now, trophies: 0 });
  });

  it("reprend la valeur d'avant la période et marque les nouveaux rangs", () => {
    const history = [
      { at: iso(now - 60 * day), trophies: 0 },
      { at: iso(now - 40 * day), trophies: 975 },
      { at: iso(now - 5 * day), trophies: 1000 },
      { at: iso(now - 2 * day), trophies: 1025 },
    ];
    const s = buildTrophySeries(history, 1025, iso(now - 60 * day), "30d", now);
    expect(s.points[0].trophies).toBe(975);
    expect(s.rankUps).toEqual([{ at: now - 5 * day, trophies: 1000 }]);
    expect(s.yMax).toBe(2000);
  });

  it("couvre toute l'histoire avec la période « tout »", () => {
    const s = buildTrophySeries([{ at: iso(now - 400 * day), trophies: 0 }], 0, iso(now - 400 * day), "all", now);
    expect(s.from).toBe(now - 400 * day);
  });
});

describe("séries de victoires", () => {
  it("compte la série en cours et la meilleure (un nul interrompt)", () => {
    // Du plus récent au plus ancien.
    expect(winStreaks([true, true, false, true, true, true, null, true])).toEqual({ current: 2, best: 3 });
    expect(winStreaks([])).toEqual({ current: 0, best: 0 });
  });
});
