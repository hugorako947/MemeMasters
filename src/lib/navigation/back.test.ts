import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BACK_LABELS, previousFromStack, resolveBackTarget, updateStack } from "./back";

describe("lien « Retour à … »", () => {
  it("revient à la page visitée juste avant", () => {
    expect(resolveBackTarget("/connexion", "/raretes")).toEqual({ href: "/raretes", labelKey: "rarities" });
    expect(resolveBackTarget("/inscription", "/connexion")).toEqual({ href: "/connexion", labelKey: "signIn" });
  });

  it("utilise le parent logique si la page précédente est inconnue", () => {
    expect(resolveBackTarget("/mot-de-passe-oublie", null)).toEqual({ href: "/connexion", labelKey: "signIn" });
    expect(resolveBackTarget("/connexion", null)).toEqual({ href: "/", labelKey: "home" });
  });

  it("ignore une page précédente non prévue ou identique", () => {
    expect(resolveBackTarget("/connexion", "/auth/callback")).toEqual({ href: "/", labelKey: "home" });
    expect(resolveBackTarget("/connexion", "/connexion")).toEqual({ href: "/", labelKey: "home" });
  });

  it("ignore les paramètres d'adresse", () => {
    expect(resolveBackTarget("/inscription", "/connexion?suivant=/parametres").href).toBe("/connexion");
  });

  it("suit le parcours : accueil → connexion → mot de passe oublié", () => {
    let stack = updateStack([], "/");
    stack = updateStack(stack, "/connexion");
    expect(previousFromStack(stack, "/connexion")).toBe("/");
    // Premier rendu de la nouvelle page, avant mise à jour de la pile :
    expect(previousFromStack(stack, "/mot-de-passe-oublie")).toBe("/connexion");
    stack = updateStack(stack, "/mot-de-passe-oublie");
    expect(previousFromStack(stack, "/mot-de-passe-oublie")).toBe("/connexion");
  });

  it("dépile quand on revient en arrière", () => {
    const stack = ["/", "/connexion", "/mot-de-passe-oublie"];
    // Retour à la connexion : le lien doit redevenir « Retour à l'accueil ».
    expect(previousFromStack(stack, "/connexion")).toBe("/");
    expect(updateStack(stack, "/connexion")).toEqual(["/", "/connexion"]);
  });

  it("a un libellé pour chaque page de retour", () => {
    const messages = JSON.parse(readFileSync("messages/fr.json", "utf8")) as { back: Record<string, string> };
    for (const key of Object.values(BACK_LABELS)) expect(messages.back[key], key).toMatch(/^Retour /);
  });
});
