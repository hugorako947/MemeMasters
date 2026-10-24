import { describe, expect, it } from "vitest";
import { createStreams, nextBelow, nextU32, STREAM } from "./rng";

describe("générateur à graine du moteur (xoshiro128**, flux séparés)", () => {
  it("même graine → même suite ; graine différente → autre suite", () => {
    const a = createStreams(12345, 8);
    const b = createStreams(12345, 8);
    const c = createStreams(12346, 8);
    const sa = Array.from({ length: 20 }, () => nextU32(a, STREAM.combat));
    const sb = Array.from({ length: 20 }, () => nextU32(b, STREAM.combat));
    const sc = Array.from({ length: 20 }, () => nextU32(c, STREAM.combat));
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
    for (const v of sa) expect(Number.isInteger(v) && v >= 0 && v < 2 ** 32).toBe(true);
  });

  it("un tirage dans un flux ne décale jamais les autres", () => {
    const a = createStreams(99, 8);
    const b = createStreams(99, 8);
    for (let i = 0; i < 37; i++) nextU32(a, STREAM.loot);
    const za = Array.from({ length: 10 }, () => nextU32(a, STREAM.zone));
    const zb = Array.from({ length: 10 }, () => nextU32(b, STREAM.zone));
    expect(za).toEqual(zb);
    // Les flux d'une même graine sont différents entre eux.
    expect(nextU32(createStreams(99, 8), STREAM.map)).not.toBe(nextU32(createStreams(99, 8), STREAM.loot));
  });

  it("tirage uniforme borné, sans biais visible", () => {
    const s = createStreams(7, 8);
    const counts = new Array(6).fill(0);
    for (let i = 0; i < 60_000; i++) {
      const v = nextBelow(s, STREAM.combat, 6);
      expect(v >= 0 && v < 6).toBe(true);
      counts[v]++;
    }
    for (const c of counts) expect(Math.abs(c - 10_000)).toBeLessThan(400);
    expect(nextBelow(s, STREAM.combat, 1)).toBe(0);
  });

  it("conforme à l'algorithme de référence xoshiro128** (état 1, 2, 3, 4)", () => {
    const s = new Uint32Array([1, 2, 3, 4]);
    expect(Array.from({ length: 6 }, () => nextU32(s, 0))).toEqual([11520, 0, 5927040, 70819200, 2031721883, 1637235492]);
  });

  it("dérivation des flux figée (toute modification change les parties : ENGINE_VERSION)", () => {
    const s = createStreams(20261024, 8);
    expect([nextU32(s, STREAM.map), nextU32(s, STREAM.map), nextU32(s, STREAM.bot0 + 3)]).toMatchInlineSnapshot(`
      [
        1882163225,
        1357576334,
        1117654478,
      ]
    `);
  });
});
