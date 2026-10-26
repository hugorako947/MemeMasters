import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "@/config/game.config";
import { chunkCommands, assembleChunks } from "./commands";
import { createMatch, ENGINE_VERSION, step } from "./engine";
import { replayMatch } from "./replay";
import { resolveRules } from "./rules";
import { stateHash } from "./state";
import { botSetup, playWithDriver, smallRules } from "./test-driver";

describe("déterminisme et rejeu", () => {
  it("300 parties (1 joueur piloté + 15 bots, graines différentes), rejouées avec les seules commandes du joueur : état final identique octet pour octet", () => {
    const rules = smallRules();
    const hashes = new Set<string>();
    let finished = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const setup = { ...botSetup(seed, rules, 16), seed: seed * 7919 };
      const played = playWithDriver(setup, seed);
      expect([...played.inputs.keys()]).toEqual([0]);
      const replay = replayMatch(setup, played.inputs);
      expect(replay.hash).toBe(stateHash(played.state));
      expect(replay.result.places).toEqual(Array.from(played.state.p.place));
      hashes.add(replay.hash);
      if (played.state.finished) finished++;
    }
    // Toutes différentes, et toutes menées à leur terme par la zone.
    expect(hashes.size).toBe(300);
    expect(finished).toBe(300);
  }, 300_000);

  it("tick par tick (copie à chaque tick) ou rejeu d'un bloc : même résultat", () => {
    const rules = smallRules();
    for (let seed = 1; seed <= 10; seed++) {
      const setup = { ...botSetup(1000 + seed, rules, 16), seed };
      const played = playWithDriver(setup, seed, { maxTicks: 300 });
      let pure = createMatch(setup);
      const commands = new Uint32Array(pure.n);
      for (let t = 0; t < played.state.tick; t++) {
        for (const [slot, stream] of played.inputs) commands[slot] = stream[t];
        pure = step(pure, commands);
      }
      expect(stateHash(pure)).toBe(stateHash(played.state));
    }
  }, 120_000);

  it("commandes envoyées par tranches : réassemblées puis rejouées, même partie", () => {
    const rules = smallRules();
    const setup = botSetup(4242, rules, 16);
    const played = playWithDriver(setup, 4242);
    const inputs = new Map<number, Uint32Array>();
    for (const [slot, stream] of played.inputs) {
      const assembled = assembleChunks(chunkCommands(stream, 400));
      expect(assembled.ok).toBe(true);
      if (assembled.ok) inputs.set(slot, assembled.commands);
    }
    expect(replayMatch(setup, inputs).hash).toBe(stateHash(played.state));
  });

  it("empreinte de référence : toute modification du résultat d'une partie impose d'augmenter ENGINE_VERSION", () => {
    const setup = { ...botSetup(1, resolveRules(GAME_CONFIG.BATTLE_ROYALE), 100), seed: 20261024 };
    const played = playWithDriver(setup, 7, { maxTicks: 400 });
    // Si ce test échoue après une modification du moteur : augmenter ENGINE_VERSION (engine.ts),
    // puis mettre à jour l'empreinte ci-dessous (npx vitest run -u).
    expect({ engine: ENGINE_VERSION, hash: stateHash(played.state) }).toMatchInlineSnapshot(`
      {
        "engine": 4,
        "hash": "71485d765799eb28",
      }
    `);
  });
});
