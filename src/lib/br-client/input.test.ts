import { describe, expect, it } from "vitest";
import { BTN, unpackAim, unpackButtons, unpackMove } from "@/lib/br/commands";
import { aimFromVector, CommandBuilder, moveFromKeys, moveFromVector } from "./input";

describe("commandes du joueur → commande du moteur", () => {
  it("déplacement : 16 directions comme le moteur (1 = droite, 5 = bas, 9 = gauche, 13 = haut), zone morte", () => {
    expect(moveFromVector(1, 0)).toBe(1);
    expect(moveFromVector(0, 1)).toBe(5);
    expect(moveFromVector(-1, 0)).toBe(9);
    expect(moveFromVector(0, -1)).toBe(13);
    expect(moveFromVector(1, 1)).toBe(3);
    expect(moveFromVector(1, -1)).toBe(15);
    expect(moveFromVector(0, 0)).toBe(0);
    expect(moveFromVector(0.1, 0.05, 0.2)).toBe(0);
    expect(moveFromVector(0.5, 0, 0.2)).toBe(1);
    // Juste sous la limite entre deux directions : la plus proche.
    expect(moveFromVector(Math.cos(0.19), Math.sin(0.19))).toBe(1);
    expect(moveFromVector(Math.cos(0.21), Math.sin(0.21))).toBe(2);
  });

  it("clavier : les touches opposées s'annulent, les diagonales donnent 8 directions", () => {
    expect(moveFromKeys({ up: false, down: false, left: false, right: false })).toBe(0);
    expect(moveFromKeys({ up: true, down: true, left: false, right: false })).toBe(0);
    expect(moveFromKeys({ up: true, down: false, left: false, right: true })).toBe(15);
    expect(moveFromKeys({ up: false, down: true, left: true, right: false })).toBe(7);
  });

  it("visée : 256 angles (0 = droite, 64 = bas, 128 = gauche, 192 = haut)", () => {
    expect(aimFromVector(1, 0)).toBe(0);
    expect(aimFromVector(0, 1)).toBe(64);
    expect(aimFromVector(-1, 0)).toBe(128);
    expect(aimFromVector(0, -1)).toBe(192);
    expect(aimFromVector(1, -0.001)).toBe(0);
  });

  it("un appui bref part sur un seul tick, puis le bouton est relâché (le moteur ne compte que les nouveaux appuis)", () => {
    const b = new CommandBuilder();
    b.move = 5;
    b.aim = 64;
    b.press(BTN.ability);
    const first = b.next();
    expect([unpackMove(first), unpackAim(first), unpackButtons(first)]).toEqual([5, 64, BTN.ability]);
    expect(unpackButtons(b.next())).toBe(0);
    // Deux appuis rapprochés : le second attend que le premier ait été relâché.
    b.press(BTN.reload);
    expect(unpackButtons(b.next())).toBe(BTN.reload);
    b.press(BTN.reload);
    expect(unpackButtons(b.next())).toBe(0);
    expect(unpackButtons(b.next())).toBe(BTN.reload);
  });

  it("le tir est maintenu tant que le bouton est enfoncé ; reset() lâche tout (perte de focus)", () => {
    const b = new CommandBuilder();
    b.fire = true;
    b.move = 3;
    b.press(BTN.pickup);
    expect(unpackButtons(b.next())).toBe(BTN.fire | BTN.pickup);
    expect(unpackButtons(b.next())).toBe(BTN.fire);
    b.reset();
    const after = b.next();
    expect([unpackMove(after), unpackButtons(after)]).toEqual([0, 0]);
  });
});
