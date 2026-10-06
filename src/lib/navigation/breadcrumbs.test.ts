import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildBreadcrumbs } from "./breadcrumbs";

describe("fil d'Ariane", () => {
  it("n'apparaît pas sur l'accueil", () => {
    expect(buildBreadcrumbs("/")).toEqual([]);
  });

  it("relie l'accueil à la page courante, non cliquable", () => {
    const crumbs = buildBreadcrumbs("/parametres");
    expect(crumbs.map((c) => c.key)).toEqual(["home", "parametres"]);
    expect(crumbs[0].linked).toBe(true);
    expect(crumbs[1]).toMatchObject({ linked: false, current: true });
  });

  it("affiche le pseudo tel quel et ne lie pas « Profil », qui n'a pas de page", () => {
    const crumbs = buildBreadcrumbs("/profil/Pixel_Cat");
    expect(crumbs[1]).toMatchObject({ key: "profil", linked: false, current: false });
    expect(crumbs[2]).toMatchObject({ key: null, text: "Pixel_Cat", current: true });
  });

  it("résiste à un segment mal encodé", () => {
    expect(buildBreadcrumbs("/profil/%E0%A4%A").at(-1)?.text).toBe("%E0%A4%A");
  });

  it("a une traduction pour chaque segment connu", () => {
    const messages = JSON.parse(readFileSync("messages/fr.json", "utf8")) as { breadcrumb: Record<string, string> };
    const source = readFileSync("src/lib/navigation/breadcrumbs.ts", "utf8");
    const keys = [...source.matchAll(/^\s+"?([a-z-]+)"?: \{ hasPage/gm)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(10);
    for (const key of keys) expect(messages.breadcrumb[key], key).toBeTruthy();
  });
});
