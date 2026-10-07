import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AVAILABLE_LOCALES, LOCALES, negotiateLocale, parseAcceptLanguage } from "./locales";

describe("langues", () => {
  it("propose les 7 langues demandées, dans l'ordre des plus parlées", () => {
    expect(LOCALES.map((l) => l.code)).toEqual(["en", "zh", "es", "ar", "fr", "pt", "de"]);
    expect(LOCALES.find((l) => l.code === "ar")?.dir).toBe("rtl");
  });

  it("lit l'en-tête Accept-Language par préférence", () => {
    expect(parseAcceptLanguage("de-DE,de;q=0.9,fr;q=0.95,en;q=0.5")).toEqual(["de", "fr", "de", "en"]);
    expect(parseAcceptLanguage(null)).toEqual([]);
  });

  it("respecte d'abord le choix du joueur", () => {
    expect(negotiateLocale({ cookie: "en", acceptLanguage: "fr-FR", country: "FR" })).toBe("en");
  });

  it("utilise ensuite la langue du navigateur", () => {
    expect(negotiateLocale({ acceptLanguage: "en-US,en;q=0.9", country: "FR" })).toBe("en");
    expect(negotiateLocale({ acceptLanguage: "fr-CA", country: "US" })).toBe("fr");
  });

  it("puis la langue du pays", () => {
    expect(negotiateLocale({ country: "FR" })).toBe("fr");
    expect(negotiateLocale({ country: "SN" })).toBe("fr");
  });

  it("passe à l'anglais si la langue détectée n'est pas encore traduite", () => {
    if (!AVAILABLE_LOCALES.includes("ja" as never)) {
      expect(negotiateLocale({ acceptLanguage: "ja-JP" })).toBe("en");
    }
  });

  it("garde le français sans aucune information", () => {
    expect(negotiateLocale({})).toBe("fr");
  });

  it("a un fichier de traduction complet pour chaque langue disponible", () => {
    const flatten = (o: object, prefix = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
    const reference = flatten(JSON.parse(readFileSync("messages/fr.json", "utf8"))).sort();
    for (const code of AVAILABLE_LOCALES) {
      const keys = flatten(JSON.parse(readFileSync(`messages/${code}.json`, "utf8"))).sort();
      expect(keys, code).toEqual(reference);
    }
  });
});
