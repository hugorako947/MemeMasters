import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "@/config/game.config";
import { STARTER_SET } from "@/content/cards/starter-set";
import { botLevelForTrophies } from "@/lib/br/bot";
import { createMatch } from "@/lib/br/engine";
import { resolveRules } from "@/lib/br/rules";
import { trainingMatch, type Difficulty } from "./training";

const BR = GAME_CONFIG.BATTLE_ROYALE;
const RULES = resolveRules(BR);
const card = STARTER_SET.find((c) => c.slug === "mamie-wifi") ?? STARTER_SET[0];
const make = (difficulty: Difficulty, trophies = 1800, seed = 42) =>
  trainingMatch({ seed, player: { name: "HugoTest", card, level: 2 }, cards: STARTER_SET, trophies, difficulty });

describe("partie d'Entraînement", () => {
  it("le joueur à l'emplacement 0 (piloté par ses commandes), 99 bots clairement marqués", () => {
    const { setup, roster } = make("normal");
    expect(setup.characters).toHaveLength(BR.PARTICIPANTS);
    expect(roster).toHaveLength(BR.PARTICIPANTS);
    expect(roster[0]).toMatchObject({ name: "HugoTest", bot: false, level: 2 });
    expect(roster[0].card.id).toBe(card.id);
    expect(setup.botLevels?.[0]).toBeNull();
    for (const r of roster.slice(1)) {
      expect(r.bot).toBe(true);
      expect(r.name).toBe(r.card.name);
      expect(STARTER_SET.map((c) => c.id)).toContain(r.card.id);
    }
    // Plusieurs cartes différentes parmi les bots.
    expect(new Set(roster.slice(1).map((r) => r.card.id)).size).toBeGreaterThan(10);
  });

  it("difficulté : Facile = débutants, Normal = selon les trophées (comme en classé), Difficile = quelques niveaux de plus", () => {
    const normal = botLevelForTrophies(1800, RULES);
    const levels = (d: Difficulty) => new Set(make(d).setup.botLevels!.slice(1));
    expect(levels("easy")).toEqual(new Set([0]));
    expect(levels("normal")).toEqual(new Set([normal]));
    expect(levels("hard")).toEqual(new Set([Math.min(RULES.bots.maxLevel, normal + 10 * BR.TRAINING.HARD_BONUS_LEVELS)]));
    // Plafonné au niveau maximal.
    expect(new Set(make("hard", 50_000).setup.botLevels!.slice(1))).toEqual(new Set([RULES.bots.maxLevel]));
  });

  it("même graine → même partie ; autre graine → autres adversaires ; la partie se crée", () => {
    expect(make("normal", 1800, 7).roster.map((r) => r.card.id)).toEqual(make("normal", 1800, 7).roster.map((r) => r.card.id));
    expect(make("normal", 1800, 7).roster.map((r) => r.card.id)).not.toEqual(make("normal", 1800, 8).roster.map((r) => r.card.id));
    const s = createMatch(make("normal").setup);
    expect(s.n).toBe(BR.PARTICIPANTS);
    expect(s.botCount).toBe(BR.PARTICIPANTS - 1);
  });
});
