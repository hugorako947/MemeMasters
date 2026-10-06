import { describe, expect, it } from "vitest";
import { LEGAL, missingLegalFields } from "./legal.config";

describe("configuration juridique", () => {
  it("a une version des conditions au format date", () => {
    expect(LEGAL.TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("signale les informations obligatoires encore vides", () => {
    // Tant que l'éditeur n'a pas rempli ses coordonnées, la liste n'est pas vide
    // et les pages légales affichent un bandeau d'avertissement.
    const missing = missingLegalFields();
    if (LEGAL.PUBLISHER.name === "") expect(missing).toContain("éditeur");
    expect(Array.isArray(missing)).toBe(true);
  });
});
