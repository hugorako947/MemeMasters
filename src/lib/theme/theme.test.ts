import { describe, expect, it } from "vitest";
import { inkOn, parseAppearance, themeAttributes } from "./theme";

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
