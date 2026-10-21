import { describe, expect, it } from "vitest";
import { cursorColors, cursorStyle } from "./cursor";

describe("pointeurs de souris", () => {
  it("garde la flèche jaune à contour encre dans le thème clair", () => {
    expect(cursorColors({ theme: "light", accent: null, base: null })).toEqual({ fill: "#ffd23f", stroke: "#1a1238", halo: "#ffffff" });
  });

  it("prend la couleur d'accent du thème personnalisé, avec un contour lisible", () => {
    expect(cursorColors({ theme: "custom", accent: "#2d5bff", base: "dark" })).toEqual({ fill: "#2d5bff", stroke: "#ffffff", halo: "#1a1238" });
  });

  it("suit la palette du thème aléatoire", () => {
    const a = cursorColors({ theme: "random", accent: "#12ab9f", base: null });
    const b = cursorColors({ theme: "random", accent: "#000001", base: null });
    expect(a.fill).toMatch(/^#[0-9a-f]{6}$/);
    expect(a.fill).not.toBe(b.fill);
  });

  it("produit deux variables CSS valides (image SVG + point actif)", () => {
    const style = cursorStyle({ theme: "dark", accent: null, base: null });
    expect(style["--mm-cursor-arrow"]).toMatch(/^url\("data:image\/svg\+xml,%3Csvg.*"\) 3 2$/);
    expect(style["--mm-cursor-text"]).toMatch(/^url\("data:image\/svg\+xml,%3Csvg.*"\) 16 16$/);
    expect(style["--mm-cursor-text"]).not.toMatch(/[<>"]svg/);
  });
});
