import { describe, expect, it } from "vitest";
import { STARTER_SET } from "@/content/cards/starter-set";
import { botAct, createBot } from "./bot";
import { canDeployAt, createBattle, deploy, fingerprint, isqrt, replay, step, unitTemplate, type RecordedInput } from "./engine";
import { ARENA, RULES } from "./rules";

const deckA = STARTER_SET.slice(0, 8);
const deckB = STARTER_SET.slice(8, 16);
const decks = { a: deckA, b: deckB };

/** Partie bot contre bot, en notant les poses de cartes. */
function botVsBot(seed: number) {
  const state = createBattle(seed, decks);
  const bots = [createBot("a", seed + 1), createBot("b", seed + 2)];
  const inputs: RecordedInput[] = [];
  while (state.phase !== "ended") {
    for (const bot of bots) {
      const before = state.sides[bot.side].hand.join();
      const pending = state.pending.length;
      botAct(state, bot);
      if (state.pending.length > pending) {
        const p = state.pending[state.pending.length - 1];
        inputs.push({ tick: state.tick, side: bot.side, slot: before.split(",").indexOf(p.cardId), x: p.x, y: p.y });
      }
    }
    step(state);
  }
  return { state, inputs };
}

describe("outils", () => {
  it("calcule une racine carrée entière exacte", () => {
    expect(isqrt(0)).toBe(0);
    expect(isqrt(15)).toBe(3);
    expect(isqrt(16)).toBe(4);
    expect(isqrt(2_000_000_000)).toBe(44721);
  });
});

describe("cartes en unités", () => {
  it("rend les cartes rares plus chères et plus puissantes", () => {
    const com = unitTemplate(STARTER_SET.find((c) => c.rarity === "commune")!);
    const god = unitTemplate(STARTER_SET.find((c) => c.rarity === "godlevel")!);
    expect(com.cost).toBe(2);
    expect(god.cost).toBe(8);
    expect(god.hp).toBeGreaterThan(com.hp * 2);
  });

  it("donne un style à chaque vibe", () => {
    const tank = unitTemplate(STARTER_SET.find((c) => c.vibe === "wholesome")!);
    const archer = unitTemplate(STARTER_SET.find((c) => c.vibe === "ironique")!);
    expect(tank.targets).toBe("buildings");
    expect(archer.range).toBeGreaterThan(3_000);
  });
});

describe("pose des cartes", () => {
  it("dépense l'énergie, fait tourner la main et fait apparaître l'unité après 1 seconde", () => {
    const state = createBattle(42, decks);
    const card = state.sides.a.hand[0];
    const cost = state.templates[card].cost * 1_000;
    expect(deploy(state, "a", 0, 9_000, 24_000)).toEqual({ ok: true });
    expect(state.sides.a.energy).toBe(RULES.ENERGY_START - cost);
    expect(state.sides.a.hand[0]).not.toBe(card);
    for (let i = 0; i < RULES.DEPLOY_DELAY; i++) step(state);
    expect(state.units).toHaveLength(0);
    step(state);
    expect(state.units).toHaveLength(1);
  });

  it("refuse le camp adverse, la rivière et le manque d'énergie", () => {
    const state = createBattle(42, decks);
    expect(deploy(state, "a", 0, 9_000, 8_000)).toEqual({ ok: false, reason: "zone" });
    expect(deploy(state, "a", 0, 9_000, 16_000)).toEqual({ ok: false, reason: "zone" });
    state.sides.a.energy = 1_000;
    expect(deploy(state, "a", 0, 9_000, 24_000)).toEqual({ ok: false, reason: "energy" });
  });

  it("ouvre le couloir adverse quand sa tour est détruite", () => {
    const state = createBattle(42, decks);
    expect(canDeployAt(state, "a", 3_500, 13_000)).toBe(false);
    state.towers.find((t) => t.side === "b" && t.kind === "princess" && t.x < ARENA.W / 2)!.hp = 0;
    expect(canDeployAt(state, "a", 3_500, 13_000)).toBe(true);
    expect(canDeployAt(state, "a", 14_500, 13_000)).toBe(false);
  });

  it("recharge l'énergie, deux fois plus vite pendant la dernière minute", () => {
    const state = createBattle(42, decks);
    state.sides.a.energy = 0;
    step(state);
    expect(state.sides.a.energy).toBe(RULES.ENERGY_REGEN);
    state.tick = RULES.DOUBLE_ENERGY_AT;
    state.sides.a.energy = 0;
    step(state);
    expect(state.sides.a.energy).toBe(RULES.ENERGY_REGEN * 2);
  });
});

describe("combat", () => {
  it("fait traverser la rivière par un pont et attaquer la tour ennemie", () => {
    const state = createBattle(7, decks);
    deploy(state, "a", 0, 3_500, 24_000);
    const tower = state.towers.find((t) => t.side === "b" && t.kind === "princess" && t.x < ARENA.W / 2)!;
    const start = tower.hp;
    let crossed = false;
    for (let i = 0; i < 20 * 40 && state.phase !== "ended"; i++) {
      step(state);
      const u = state.units.find((x) => x.side === "a");
      if (u && u.y < ARENA.RIVER_TOP) crossed = true;
    }
    expect(crossed).toBe(true);
    expect(tower.hp).toBeLessThan(start);
  });

  it("donne une couronne par tour détruite et la victoire en détruisant le roi", () => {
    const state = createBattle(7, decks);
    state.towers.find((t) => t.id === 4)!.hp = 0;
    step(state);
    expect(state.sides.a.crowns).toBe(1);
    state.towers.find((t) => t.id === 6)!.hp = 0;
    step(state);
    expect(state.phase).toBe("ended");
    expect(state.result).toMatchObject({ winner: "a", reason: "king", crowns: { a: 3, b: 0 } });
  });

  it("termine sur un match nul ou un départage à la fin de la prolongation", () => {
    const state = createBattle(7, decks);
    while (state.phase !== "ended") step(state);
    expect(state.tick).toBe(RULES.MATCH_TICKS + RULES.OVERTIME_TICKS);
    expect(state.result?.reason).toBe("draw");
  });
});

describe("déterminisme (indispensable pour vérifier les parties classées)", () => {
  it("rejoue une partie complète à l'identique à partir de la graine et des poses", () => {
    const { state, inputs } = botVsBot(1234);
    expect(inputs.length).toBeGreaterThan(10);
    const again = replay(1234, decks, inputs);
    expect(fingerprint(again)).toBe(fingerprint(state));
    expect(again.result).toEqual(state.result);
  });

  it("donne des parties différentes avec des graines différentes", () => {
    expect(fingerprint(botVsBot(1).state)).not.toBe(fingerprint(botVsBot(2).state));
  });

  it("finit toujours une partie bot contre bot", () => {
    for (const seed of [3, 4, 5]) {
      const { state } = botVsBot(seed);
      expect(state.phase).toBe("ended");
      expect(state.result).not.toBeNull();
    }
  });
});
