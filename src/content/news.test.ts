import { describe, expect, it } from "vitest";
import { rankBounds } from "@/config/ranks";
import { contactSchema } from "@/lib/validation/contact";
import { localized, NEWS } from "./news";

describe("news", () => {
  it("sont triées de la plus récente à la plus ancienne, avec des identifiants uniques", () => {
    const dates = NEWS.map((n) => n.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(new Set(NEWS.map((n) => n.id)).size).toBe(NEWS.length);
  });

  it("retombent sur le français quand une langue manque", () => {
    expect(localized({ fr: "Bonjour", en: "Hello" }, "en")).toEqual({ text: "Hello", lang: "en" });
    expect(localized({ fr: "Bonjour" }, "zh")).toEqual({ text: "Bonjour", lang: "fr" });
  });
});

describe("bornes de rang (classement « mon rang »)", () => {
  it("couvrent 1 000 trophées, sans maximum pour Immortel", () => {
    expect(rankBounds(0)).toEqual({ min: 0, max: 999 });
    expect(rankBounds(1)).toEqual({ min: 1000, max: 1999 });
    expect(rankBounds(9)).toEqual({ min: 9000, max: null });
  });
});

describe("formulaire de contact", () => {
  const valid = { email: "joueur@exemple.fr", category: "bug", message: "Le bouton ne répond pas." };

  it("accepte un message complet", () => {
    expect(contactSchema.safeParse(valid).success).toBe(true);
  });

  it("refuse un message trop court ou un sujet inconnu", () => {
    expect(contactSchema.safeParse({ ...valid, message: "Salut" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, category: "spam" }).success).toBe(false);
  });

  it("refuse les robots qui remplissent le champ piège", () => {
    expect(contactSchema.safeParse({ ...valid, website: "http://spam.example" }).success).toBe(false);
  });
});
