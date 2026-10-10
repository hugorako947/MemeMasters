import { describe, expect, it } from "vitest";
import { inkOn, newSeed, parseAppearance, randomIsDark, randomPalette, themeAttributes } from "./theme";

describe("thèmes", () => {
  it("prend le thème clair par défaut, et ignore les valeurs inconnues", () => {
    expect(parseAppearance({})).toEqual({ theme: "light", accent: null, base: null });
    expect(parseAppearance({ theme: "rose-fluo" }).theme).toBe("light");
  });

  it("complète un thème personnalisé incomplet", () => {
    expect(parseAppearance({ theme: "custom" })).toEqual({ theme: "custom", accent: "#ff3d7f", base: "light" });
    expect(parseAppearance({ theme: "custom", accent: "#123456" }).accent).toBe("#ff3d7f");
  });

  it("choisit un texte lisible sur la couleur d'accent", () => {
    expect(inkOn("#f5a400")).toBe("#1a1238");
    expect(inkOn("#2d5bff")).toBe("#ffffff");
  });

  it("produit les attributs du thème personnalisé", () => {
    expect(themeAttributes({ theme: "custom", accent: "#8b3dff", base: "dark" })).toEqual({
      "data-theme": "custom",
      "data-base": "dark",
      style: { "--color-candy": "#8b3dff", "--mm-accent-ink": "#ffffff" },
    });
    expect(themeAttributes({ theme: "dark", accent: null, base: null })).toEqual({ "data-theme": "dark" });
  });
});

describe("thème aléatoire", () => {
  const luminance = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const c = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * c((n >> 16) & 255) + 0.7152 * c((n >> 8) & 255) + 0.0722 * c(n & 255);
  };
  const contrast = (a: string, b: string) => {
    const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };

  it("garde la graine et donne toujours la même palette pour la même graine", () => {
    expect(parseAppearance({ theme: "random", accent: "#12ab9f" })).toEqual({ theme: "random", accent: "#12ab9f", base: null });
    expect(randomPalette("#12ab9f")).toEqual(randomPalette("#12ab9f"));
    expect(randomPalette("#12ab9f")).not.toEqual(randomPalette("#000001"));
  });

  it("produit des graines valides", () => {
    for (const v of [0, 0.5, 0.999999]) expect(newSeed(() => v)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("reste lisible : texte contrasté sur le fond et la surface (WCAG AA), pour 300 tirages", () => {
    for (let n = 0; n < 300; n++) {
      const p = randomPalette(newSeed());
      expect(contrast(p["--color-ink"], p["--color-paper"])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p["--color-ink"], p["--color-surface"])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p["--mm-accent-ink"], p["--color-candy"])).toBeGreaterThanOrEqual(3);
    }
  });

  it("pose la palette sur <html>", () => {
    const attrs = themeAttributes({ theme: "random", accent: "#12ab9f", base: null });
    expect(attrs["data-theme"]).toBe("random");
    expect(attrs.style?.["--color-paper"]).toMatch(/^#[0-9a-f]{6}$/);
  });
});


describe("thème aléatoire : palette valide pour React et pour le navigateur", () => {
  it("ne contient que des variables CSS (--…), jamais de propriété comme color-scheme", () => {
    for (const seed of ["#000001", "#5ec0de", "#abcdef", "#123456"]) {
      expect(Object.keys(randomPalette(seed)).every((k) => k.startsWith("--"))).toBe(true);
    }
  });

  it("passe l'ambiance claire ou sombre par data-base, cohérente avec la palette", () => {
    for (const seed of ["#000001", "#5ec0de", "#abcdef", "#123456"]) {
      const attrs = themeAttributes({ theme: "random", accent: seed, base: null });
      expect(attrs["data-base"]).toBe(randomIsDark(seed) ? "dark" : "light");
    }
  });
});
