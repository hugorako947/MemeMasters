import { describe, expect, it } from "vitest";
import { ANGLE_STEPS, angleDiff, floorDiv, iatan2, icos, idiv, isin, isqrt, Q14 } from "./fixed";

const TAU = 2 * Math.PI;

describe("mathématiques entières du moteur", () => {
  it("sinus et cosinus sur 256 pas, en Q14, fidèles à ±1", () => {
    for (let a = -300; a < 600; a++) {
      expect(Math.abs(isin(a) - Math.round(Math.sin((a * TAU) / ANGLE_STEPS) * Q14))).toBeLessThanOrEqual(1);
      expect(Math.abs(icos(a) - Math.round(Math.cos((a * TAU) / ANGLE_STEPS) * Q14))).toBeLessThanOrEqual(1);
      expect(Number.isInteger(isin(a)) && Number.isInteger(icos(a))).toBe(true);
    }
    expect([isin(0), isin(64), isin(128), isin(192)]).toEqual([0, Q14, 0, -Q14]);
    expect([icos(0), icos(64), icos(128), icos(192)]).toEqual([Q14, 0, -Q14, 0]);
  });

  it("arc tangente : l'angle le plus proche, à un pas près, dans les 8 octants", () => {
    for (let i = 0; i < 4000; i++) {
      const t = (i * 0.61803398875) % 1;
      const r = 100 + ((i * 7919) % 60000);
      const dx = Math.round(Math.cos(t * TAU) * r);
      const dy = Math.round(Math.sin(t * TAU) * r);
      const exact = (((Math.atan2(dy, dx) * ANGLE_STEPS) / TAU) % ANGLE_STEPS + ANGLE_STEPS) % ANGLE_STEPS;
      const got = iatan2(dy, dx);
      expect(got).toBeGreaterThanOrEqual(0);
      expect(got).toBeLessThan(ANGLE_STEPS);
      const err = Math.abs(((got - exact + 384) % 256) - 128);
      expect(err).toBeLessThanOrEqual(0.51);
    }
    expect([iatan2(0, 5), iatan2(5, 0), iatan2(0, -5), iatan2(-5, 0), iatan2(0, 0)]).toEqual([0, 64, 128, 192, 0]);
    expect([iatan2(7, 7), iatan2(7, -7), iatan2(-7, -7), iatan2(-7, 7)]).toEqual([32, 96, 160, 224]);
  });

  it("aller-retour angle → vecteur → angle", () => {
    for (let a = 0; a < 256; a++) expect(iatan2(isin(a) * 4, icos(a) * 4)).toBe(a);
  });

  it("écart d'angle le plus court, signé", () => {
    expect(angleDiff(10, 250)).toBe(16);
    expect(angleDiff(250, 10)).toBe(-16);
    expect(angleDiff(0, 128)).toBe(-128);
    expect(angleDiff(64, 64)).toBe(0);
  });

  it("racine carrée entière exacte (méthode de Newton)", () => {
    for (let n = 0; n < 5000; n++) {
      const r = isqrt(n);
      expect(r * r).toBeLessThanOrEqual(n);
      expect((r + 1) * (r + 1)).toBeGreaterThan(n);
    }
    for (const n of [2 ** 31 - 1, 2 ** 32, 8_589_934_592, 4_000_000_000_000, 2 ** 52 - 3]) {
      const r = isqrt(n);
      expect(r * r).toBeLessThanOrEqual(n);
      expect((r + 1) * (r + 1)).toBeGreaterThan(n);
    }
  });

  it("divisions entières exactes (troncature et partie entière)", () => {
    expect([idiv(7, 2), idiv(-7, 2), idiv(7, -2), idiv(-7, -2)]).toEqual([3, -3, -3, 3]);
    expect([floorDiv(7, 2), floorDiv(-7, 2), floorDiv(-8, 2)]).toEqual([3, -4, -4]);
    // Cas où la division flottante arrondit au-dessus de l'entier : la correction le rattrape.
    const b = 2 ** 30 + 3;
    const a = b * 1_000_003 - 1;
    expect(idiv(a, b)).toBe(1_000_002);
    expect(floorDiv(-a, b)).toBe(-1_000_003);
  });
});
