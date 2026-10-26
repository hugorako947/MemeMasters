import { describe, expect, it } from "vitest";
import { assignBinding, bindingOfMouse, DEFAULT_BR_SETTINGS, parseBrSettings } from "./br-settings";

describe("réglages du Battle Royale (enregistrés sur l'appareil)", () => {
  it("valeurs d'origine : ZQSD/WASD (touches physiques), clic gauche tir, clic droit ramasser, C capacité, R recharger, Tab arme", () => {
    expect(DEFAULT_BR_SETTINGS.keys).toEqual({ up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", fire: "Mouse0", ability: "KeyC", pickup: "Mouse2", reload: "KeyR", weapon: "Tab" });
    expect(DEFAULT_BR_SETTINGS.sfx).toBeGreaterThan(0);
  });

  it("lecture prudente : un réglage abîmé ou incomplet retombe sur les valeurs d'origine", () => {
    expect(parseBrSettings(null)).toEqual(DEFAULT_BR_SETTINGS);
    expect(parseBrSettings("n'importe quoi")).toEqual(DEFAULT_BR_SETTINGS);
    const partial = parseBrSettings({ keys: { ability: "KeyF", up: 42 }, sfx: 140, music: -3 });
    expect(partial.keys.ability).toBe("KeyF");
    expect(partial.keys.up).toBe("KeyW");
    expect([partial.sfx, partial.music]).toEqual([100, 0]);
    // Deux actions sur la même touche : la seconde reprend sa valeur d'origine.
    const clash = parseBrSettings({ keys: { ability: "KeyR" } });
    expect(clash.keys.ability).toBe("KeyR");
    expect(clash.keys.reload).not.toBe("KeyR");
  });

  it("changer une touche déjà utilisée échange les deux actions (jamais deux actions sur la même touche)", () => {
    const s = assignBinding(DEFAULT_BR_SETTINGS, "ability", "KeyR");
    expect(s.keys.ability).toBe("KeyR");
    expect(s.keys.reload).toBe("KeyC");
    const free = assignBinding(DEFAULT_BR_SETTINGS, "pickup", "KeyE");
    expect(free.keys.pickup).toBe("KeyE");
    expect(Object.values(free.keys).filter((k) => k === "KeyE")).toHaveLength(1);
    // Échap est réservé au menu.
    expect(assignBinding(DEFAULT_BR_SETTINGS, "fire", "Escape")).toEqual(DEFAULT_BR_SETTINGS);
  });

  it("boutons de la souris", () => {
    expect([bindingOfMouse(0), bindingOfMouse(1), bindingOfMouse(2)]).toEqual(["Mouse0", "Mouse1", "Mouse2"]);
  });
});
