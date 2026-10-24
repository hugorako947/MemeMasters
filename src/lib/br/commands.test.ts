import { describe, expect, it } from "vitest";
import { assembleChunks, BTN, chunkCommands, decodeRuns, encodeRuns, isValidCommand, packCommand, unpackAim, unpackButtons, unpackMove } from "./commands";

describe("commandes du joueur (3 octets par tick)", () => {
  it("déplacement (16 directions), visée (256 angles) et boutons", () => {
    const c = packCommand({ move: 16, aim: 255, buttons: BTN.fire | BTN.pickup });
    expect([unpackMove(c), unpackAim(c), unpackButtons(c)]).toEqual([16, 255, BTN.fire | BTN.pickup]);
    expect(c).toBeLessThan(2 ** 24);
    expect(packCommand({ move: 0, aim: 0, buttons: 0 })).toBe(0);
  });

  it("refuse les commandes impossibles", () => {
    expect(isValidCommand(packCommand({ move: 3, aim: 10, buttons: BTN.heal }))).toBe(true);
    expect(isValidCommand(16)).toBe(true);
    expect(isValidCommand(17)).toBe(false); // déplacement 17 : réservé (marche lente)
    expect(isValidCommand(31)).toBe(false); // déplacement 31 : réservé
    expect(isValidCommand(1 << 19)).toBe(false); // bits réservés
    expect(isValidCommand(-1)).toBe(false);
    expect(isValidCommand(2 ** 24)).toBe(false);
    expect(isValidCommand(1.5)).toBe(false);
    expect(() => packCommand({ move: 17, aim: 0, buttons: 0 })).toThrow();
  });

  it("codage en plages : aller-retour exact et taille d'une partie de 8 minutes", () => {
    // 9 600 ticks, la commande change en moyenne tous les 3 ticks.
    let seed = 1;
    const rand = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) >>> 8) / 2 ** 24;
    const commands = new Uint32Array(9600);
    let current = 0;
    for (let t = 0; t < commands.length; t++) {
      if (rand() < 1 / 3) current = packCommand({ move: Math.floor(rand() * 17), aim: Math.floor(rand() * 256), buttons: Math.floor(rand() * 64) });
      commands[t] = current;
    }
    const bytes = encodeRuns(commands);
    expect(bytes.length).toBeLessThan(14_000);
    expect(decodeRuns(bytes)).toEqual(commands);
    // Longues séries identiques : coupées tous les 255 ticks.
    const still = new Uint32Array(1000).fill(packCommand({ move: 0, aim: 64, buttons: 0 }));
    expect(encodeRuns(still).length).toBe(4 * 4);
    expect(decodeRuns(encodeRuns(still))).toEqual(still);
  });

  it("refuse des données de plages malformées", () => {
    expect(decodeRuns(new Uint8Array([1, 0, 0]))).toBeNull(); // longueur non multiple de 4
    expect(decodeRuns(new Uint8Array([1, 0, 0, 0]))).toBeNull(); // répétition nulle
    expect(decodeRuns(new Uint8Array([31, 0, 0, 1]))).toBeNull(); // commande impossible
  });

  it("tranches de 400 ticks : réassemblage, trous et chevauchements refusés", () => {
    const commands = Uint32Array.from({ length: 1000 }, (_, t) => packCommand({ move: t % 17, aim: t % 256, buttons: t % 64 }));
    const chunks = chunkCommands(commands, 400);
    expect(chunks.map((c) => [c.idx, c.fromTick, c.toTick])).toEqual([
      [0, 0, 400],
      [1, 400, 800],
      [2, 800, 1000],
    ]);
    const ok = assembleChunks(chunks);
    expect(ok.ok && ok.commands).toEqual(commands);
    expect(assembleChunks([chunks[0], chunks[2]])).toEqual({ ok: false, reason: "gap" });
    expect(assembleChunks([chunks[0], { ...chunks[1], fromTick: 390 }])).toEqual({ ok: false, reason: "gap" });
    expect(assembleChunks([chunks[0], { ...chunks[1], toTick: 799 }])).toEqual({ ok: false, reason: "length" });
    expect(assembleChunks([chunks[0], { ...chunks[1], data: new Uint8Array([31, 0, 0, 1]) }])).toEqual({ ok: false, reason: "invalid" });
    expect(assembleChunks([])).toEqual({ ok: true, commands: new Uint32Array(0) });
  });
});
