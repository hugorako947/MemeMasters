import { describe, expect, it } from "vitest";
import { onboardingSchema, passwordIsStrong, passwordSchema, PASSWORD_RULES, safeNextPath, signUpSchema } from "./auth";
import { usernameProblem } from "./username";

describe("pseudos", () => {
  it("accepte les pseudos valides", () => {
    expect(usernameProblem("Meme_Lord42")).toBeNull();
    expect(usernameProblem("abc")).toBeNull();
  });

  it("refuse les longueurs hors bornes", () => {
    expect(usernameProblem("ab")).toBe("length");
    expect(usernameProblem("a".repeat(21))).toBe("length");
  });

  it("refuse les caractères spéciaux et accents", () => {
    expect(usernameProblem("élodie")).toBe("characters");
    expect(usernameProblem("jean-paul")).toBe("characters");
    expect(usernameProblem("a b c")).toBe("characters");
  });

  it("refuse les noms réservés, même déguisés", () => {
    expect(usernameProblem("Admin")).toBe("reserved");
    expect(usernameProblem("adm1n_officiel")).toBe("reserved");
    expect(usernameProblem("M0D0")).toBe("reserved");
  });

  it("refuse les pseudos injurieux, même en l33t", () => {
    expect(usernameProblem("gros_c0nnard")).toBe("inappropriate");
  });
});

describe("mots de passe", () => {
  it("accepte un mot de passe qui respecte les 5 règles", () => {
    expect(passwordSchema.safeParse("Meme!Lord42").success).toBe(true);
  });

  it.each([
    ["trop court", "Ab1!xyz"],
    ["sans minuscule", "MEMELORD42!"],
    ["sans majuscule", "memelord42!"],
    ["sans chiffre", "MemeLord!!!"],
    ["sans caractère spécial", "MemeLord4242"],
  ])("refuse un mot de passe %s", (_, password) => {
    expect(passwordIsStrong(password)).toBe(false);
  });

  it("expose une règle par critère, pour la liste affichée en direct", () => {
    expect(PASSWORD_RULES.map((r) => r.key)).toEqual(["length", "lower", "upper", "digit", "symbol"]);
  });
});

describe("inscription", () => {
  const valid = {
    username: "pixel_cat",
    email: "Pixel@Exemple.fr",
    password: "Meme!Lord42",
    confirm: "Meme!Lord42",
    adult: "on",
    terms: "on",
    timezone: "Europe/Paris",
  };

  it("accepte un formulaire complet et normalise l'e-mail", () => {
    const parsed = signUpSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.email).toBe("pixel@exemple.fr");
  });

  it("exige que les deux mots de passe soient identiques", () => {
    const parsed = signUpSchema.safeParse({ ...valid, confirm: "Meme!Lord43" });
    expect(parsed.error?.issues[0]?.path[0]).toBe("confirm");
  });

  it("exige l'attestation de majorité", () => {
    const parsed = signUpSchema.safeParse({ ...valid, adult: undefined });
    expect(parsed.error?.issues[0]?.path[0]).toBe("adult");
  });

  it("exige l'acceptation des conditions", () => {
    const parsed = signUpSchema.safeParse({ ...valid, terms: undefined });
    expect(parsed.error?.issues[0]?.path[0]).toBe("terms");
  });
});

describe("profil créé après une connexion Google", () => {
  const base = { username: "pixel_cat", timezone: "Europe/Paris", adult: true, terms: true };

  it("valide pseudo, fuseau et attestations", () => {
    expect(onboardingSchema.safeParse(base).success).toBe(true);
    expect(onboardingSchema.safeParse({ ...base, timezone: "Nulle/Part" }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...base, adult: false }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...base, terms: false }).success).toBe(false);
  });
});

describe("redirection après connexion", () => {
  it("n'autorise que les chemins internes", () => {
    expect(safeNextPath("/profil/bob")).toBe("/profil/bob");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});

import { contactSchema } from "./contact";

describe("contact : sujet « Autre »", () => {
  const base = { email: "joueur@exemple.fr", message: "Bonjour, j'ai une question." };
  it("exige de préciser le sujet quand il est « Autre »", () => {
    expect(contactSchema.safeParse({ ...base, category: "other" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...base, category: "other", subject: "ok" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...base, category: "other", subject: "Idée de carte" }).success).toBe(true);
  });
  it("ne demande rien de plus pour les autres sujets", () => {
    expect(contactSchema.safeParse({ ...base, category: "bug" }).success).toBe(true);
  });
});
