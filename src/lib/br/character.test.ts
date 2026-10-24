import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "@/config/game.config";
import { STARTER_SET } from "@/content/cards/starter-set";
import type { Card } from "@/lib/validation/card";
import { battleCharacter } from "./character";

const BR = GAME_CONFIG.BATTLE_ROYALE;
const BONUS = GAME_CONFIG.DUPLICATES.STAT_BONUS_PERCENT;
const bySlug = (slug: string) => STARTER_SET.find((c) => c.slug === slug)!;
const make = (over: Partial<Card>): Card => ({ ...bySlug("lundi-matin"), ...over });

describe("carte → personnage du battle royale", () => {
  it("toutes les cartes du jeu de départ restent dans les plages prévues", () => {
    for (const card of STARTER_SET) {
      for (const level of [0, 1, 2, 3] as const) {
        const c = battleCharacter(card, level, BR, BONUS);
        expect(c.maxHp).toBeGreaterThanOrEqual(100);
        expect(c.maxHp).toBeLessThanOrEqual(200);
        expect(c.hitRadius).toBeGreaterThanOrEqual(14);
        expect(c.hitRadius).toBeLessThanOrEqual(22);
        expect(c.speed).toBeGreaterThanOrEqual(220);
        expect(c.speed).toBeLessThanOrEqual(400);
        expect(c.weaponPercent).toBeGreaterThanOrEqual(90);
        expect(c.weaponPercent).toBeLessThanOrEqual(110);
        expect(c.damageTakenPercent).toBeGreaterThanOrEqual(75);
        expect(c.damageTakenPercent).toBeLessThanOrEqual(91);
        expect(c.ability.cooldownMs).toBeGreaterThanOrEqual(9000);
        expect(c.ability.cooldownMs).toBeLessThanOrEqual(18000);
        for (const v of [c.maxHp, c.hitRadius, c.speed, c.weaponPercent, c.ability.permille, c.ability.durationMs, c.passive.permille]) expect(Number.isInteger(v)).toBe(true);
      }
    }
  });

  it("formules sans compression (κ = 100 %) : celles de la conception", () => {
    const raw = { ...BR, CHARACTER: { ...BR.CHARACTER, COMPRESSION_PERCENT: 100 } };
    const tank = battleCharacter(make({ hp: 140, atk: 20, def: 65, spd: 10 }), 0, raw, BONUS);
    expect([tank.maxHp, tank.hitRadius, tank.speed, tank.weaponPercent, tank.damageTakenPercent]).toEqual([200, 22, 220, 90, 75]);
    const fast = battleCharacter(make({ hp: 60, atk: 65, def: 20, spd: 100 }), 0, raw, BONUS);
    expect([fast.maxHp, fast.hitRadius, fast.speed, fast.weaponPercent, fast.damageTakenPercent]).toEqual([100, 14, 400, 110, 90]);
  });

  it("avantages et inconvénients : robuste = gros et lent, rapide = fragile", () => {
    const tank = battleCharacter(bySlug("cactus-hurleur"), 0, BR, BONUS);
    const fast = battleCharacter(bySlug("wifi-une-barre"), 0, BR, BONUS);
    expect(tank.maxHp).toBeGreaterThan(fast.maxHp);
    expect(tank.hitRadius).toBeGreaterThan(fast.hitRadius);
    expect(tank.speed).toBeLessThan(fast.speed);
  });

  it("compression : κ = 0 rend tous les personnages identiques ; κ = 50 % divise l'écart par deux", () => {
    const flat = { ...BR, CHARACTER: { ...BR.CHARACTER, COMPRESSION_PERCENT: 0 } };
    const a = battleCharacter(bySlug("l-algorithme-supreme"), 0, flat, BONUS);
    const b = battleCharacter(bySlug("chaussette-orpheline"), 0, flat, BONUS);
    expect([a.maxHp, a.speed, a.weaponPercent]).toEqual([b.maxHp, b.speed, b.weaponPercent]);
    const god = battleCharacter(bySlug("l-algorithme-supreme"), 0, BR, BONUS);
    // PV 126 → 92 + (126 − 92) / 2 = 109.
    expect(god.stats.hp).toBe(109);
  });

  it("évolution : bonus appliqué à moitié en bataille (★★★ : +5 %)", () => {
    const card = bySlug("le-chat-qui-juge");
    const base = battleCharacter(card, 0, BR, BONUS);
    const divine = battleCharacter(card, 3, BR, BONUS);
    expect(divine.stats.hp).toBe(base.stats.hp + Math.floor((base.stats.hp * 10 * 50) / 10000));
    expect(divine.maxHp).toBeGreaterThan(base.maxHp);
    expect(divine.maxHp).toBeLessThanOrEqual(Math.ceil(base.maxHp * 1.07));
  });

  it("capacité active : chaque effet d'attaque spéciale est transposé, recharge 6 s + 3 s × énergie", () => {
    const special = (effect: Card["specialAttack"]["effect"], power = 70, energyCost = 3) =>
      battleCharacter(make({ specialAttack: { name: "x", power, energyCost, effect }, defenseAbility: { name: "d", effect: { kind: "heal", percent: 10 } } }), 0, BR, BONUS).ability;
    expect(special({ kind: "none" })).toMatchObject({ kind: "sprint", cooldownMs: 15000, durationMs: 2000, permille: 400 });
    expect(special({ kind: "stun", chance: 20 })).toMatchObject({ kind: "stun", durationMs: 3000, effectMs: 600 });
    expect(special({ kind: "drain", percent: 30 })).toMatchObject({ kind: "drain", durationMs: 4000, permille: 300 });
    expect(special({ kind: "multi", hits: 3, percent: 40 })).toMatchObject({ kind: "multi", hits: 3, permille: 400 });
    expect(special({ kind: "dot", percent: 6, turns: 2 })).toMatchObject({ kind: "burn", permille: 60, effectMs: 2000 });
    expect(special({ kind: "pierce", percent: 40 })).toMatchObject({ kind: "pierce", durationMs: 4000, permille: 400 });
    expect(special({ kind: "buff", stat: "spd", stages: 1 })).toMatchObject({ kind: "buff", stat: "spd", durationMs: 5000, permille: 250 });
    expect(special({ kind: "debuff", stat: "def", stages: 1 })).toMatchObject({ kind: "debuff", stat: "def", durationMs: 3000, effectMs: 4000, permille: 200 });
    // Intensité × puissance / 70 ; recharge selon le coût d'énergie.
    expect(special({ kind: "drain", percent: 30 }, 84, 4)).toMatchObject({ permille: 360, cooldownMs: 18000 });
    expect(special({ kind: "none" }, 55, 2).cooldownMs).toBe(12000);
  });

  it("passif : soin, esquive, renvoi, immunité, recharge", () => {
    const passive = (effect: Card["defenseAbility"]["effect"]) => battleCharacter(make({ defenseAbility: { name: "d", effect } }), 0, BR, BONUS);
    expect(passive({ kind: "heal", percent: 10 }).passive).toEqual({ kind: "regen", permille: 10 });
    expect(passive({ kind: "dodge", chance: 15 }).passive).toEqual({ kind: "dodge", permille: 50 });
    expect(passive({ kind: "reflect", percent: 20 }).passive).toEqual({ kind: "reflect", permille: 50 });
    expect(passive({ kind: "cleanse" }).passive).toEqual({ kind: "cleanse", permille: 500 });
    const recharge = passive({ kind: "recharge", amount: 1 });
    expect(recharge.passive).toEqual({ kind: "recharge", permille: 250 });
    // Lundi Matin : coût 2 → 12 s, −25 % → 9 s.
    expect(recharge.ability.cooldownMs).toBe(9000);
  });
});
