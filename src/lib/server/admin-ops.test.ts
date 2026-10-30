import { describe, expect, it } from "vitest";
import { buildCard, cardPayloadSchema } from "./admin-ops";

/**
 * Chemin de données de l'éditeur de cartes : un formulaire (valeurs en texte) → `cardPayloadSchema`
 * → `buildCard` → l'effet de la capacité spéciale. Une carte neuve (sans id) ne touche pas la base.
 */
const form = (over: Record<string, string>): Record<string, string> => ({
  name: "Test",
  rarity: "commune",
  hp: "90",
  atk: "40",
  def: "35",
  spd: "70",
  attackName: "Coup",
  attackPower: "30",
  specialName: "Spéciale",
  specialPower: "60",
  specialCost: "3",
  defenseName: "Garde",
  defenseKind: "heal",
  defenseValue: "10",
  ...over,
});
const build = async (over: Record<string, string>) => {
  const p = cardPayloadSchema.parse({ ...form(over), active: true, droppable: true, announce: false, art: { mode: "auto" } });
  return (await buildCard(p)).card.specialAttack.effect;
};

describe("buildCard : effet de la capacité spéciale depuis le formulaire", () => {
  it("affaiblissement de toutes les stats, réglé", async () => {
    expect(await build({ specialKind: "debuff", specialStat: "all", specialPercent: "50", specialSeconds: "5" })).toEqual({ kind: "debuff", all: true, percent: 50, seconds: 5 });
  });

  it("sprint réglé (vitesse en plus, durée)", async () => {
    expect(await build({ specialKind: "none", specialPercent: "55", specialSeconds: "6" })).toEqual({ kind: "none", percent: 55, seconds: 6 });
  });

  it("brûlure réglée en secondes", async () => {
    expect(await build({ specialKind: "dot", specialPercent: "20", specialSeconds: "9" })).toEqual({ kind: "dot", percent: 20, seconds: 9 });
  });

  it("boost d'une seule statistique", async () => {
    expect(await build({ specialKind: "buff", specialStat: "spd", specialPercent: "40", specialSeconds: "7" })).toEqual({ kind: "buff", stat: "spd", percent: 40, seconds: 7 });
  });

  it("multi-coup : coups et % par coup, sans durée", async () => {
    expect(await build({ specialKind: "multi", specialHits: "4", specialPercent: "55" })).toEqual({ kind: "multi", hits: 4, percent: 55 });
  });

  it("les valeurs hors bornes d'un effet sont ramenées dans la plage", async () => {
    // Perce-défense : 10–80 % ; une valeur de 85 (acceptée par le champ, max 90) est ramenée à 80.
    expect(await build({ specialKind: "pierce", specialPercent: "85", specialSeconds: "4" })).toEqual({ kind: "pierce", percent: 80, seconds: 4 });
  });

  it("valeurs par défaut (aucun champ d'effet envoyé) : sprint, rétrocompatible", async () => {
    const p = cardPayloadSchema.parse({ ...form({}), active: true, droppable: true, announce: false, art: { mode: "auto" } });
    expect((await buildCard(p)).card.specialAttack.effect).toEqual({ kind: "none", percent: 40, seconds: 4 });
  });
});
