import { describe, expect, it } from "vitest";
import { ageOn, daysBetween, gameDate, isValidTimeZone, nextLocalMidnight } from "./game-day";

describe("jour de jeu", () => {
  const instant = new Date("2026-10-06T22:30:00Z");

  it("dépend du fuseau du joueur", () => {
    expect(gameDate("Europe/Paris", instant)).toBe("2026-10-07");
    expect(gameDate("America/Montreal", instant)).toBe("2026-10-06");
    expect(gameDate("Asia/Tokyo", instant)).toBe("2026-10-07");
  });

  it("reconnaît les fuseaux IANA valides", () => {
    expect(isValidTimeZone("Europe/Paris")).toBe(true);
    expect(isValidTimeZone("Africa/Abidjan")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });

  it("trouve le prochain minuit local", () => {
    const midnight = nextLocalMidnight("Europe/Paris", new Date("2026-10-06T12:00:00Z"));
    expect(midnight.toISOString()).toBe("2026-10-06T22:00:00.000Z");
  });

  it("gère le passage à l'heure d'hiver", () => {
    // En France, la nuit du 25 octobre 2026 dure 25 heures.
    const midnight = nextLocalMidnight("Europe/Paris", new Date("2026-10-25T12:00:00Z"));
    expect(midnight.toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });

  it("compte les jours écoulés", () => {
    expect(daysBetween(new Date("2026-09-01T00:00:00Z"), new Date("2026-10-01T00:00:00Z"))).toBe(30);
  });
});

describe("âge", () => {
  it("compte les années révolues", () => {
    const on = new Date("2026-10-06T12:00:00Z");
    expect(ageOn("2008-10-06", on)).toBe(18);
    expect(ageOn("2008-10-07", on)).toBe(17);
    expect(ageOn("2000-01-01", on)).toBe(26);
  });
});
