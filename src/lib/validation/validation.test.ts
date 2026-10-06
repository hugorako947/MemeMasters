import { describe, expect, it } from "vitest";
import { onboardingSchema, passwordSchema, safeNextPath } from "./auth";
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
  it("exige 8 caractères, une lettre et un chiffre", () => {
    expect(passwordSchema.safeParse("abcdefg1").success).toBe(true);
    expect(passwordSchema.safeParse("abcdefgh").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(false);
    expect(passwordSchema.safeParse("ab1").success).toBe(false);
  });
});

describe("inscription du profil", () => {
  it("valide pseudo et fuseau", () => {
    expect(onboardingSchema.safeParse({ username: "pixel_cat", timezone: "Europe/Paris" }).success).toBe(true);
    expect(onboardingSchema.safeParse({ username: "pixel_cat", timezone: "Nulle/Part" }).success).toBe(false);
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
