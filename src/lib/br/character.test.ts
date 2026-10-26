import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "@/config/game.config";
import { STARTER_SET } from "@/content/cards/starter-set";
import type { Card } from "@/lib/validation/card";
import { battleCharacter } from "./character";

const BR = GAME_CONFIG.BATTLE_ROYALE;
const BONUS = GAME_CONFIG.DUPLICATES.STAT_BONUS_PERCENT;
const bySlug = (slug: string) => STARTER_SET.find((c) => c.slug === slug)!;
const make = (over: Partial<Card>): Card => ({ ...bySlug("lundi-matin"), ...over });
/** Configuration avec une autre compression (κ, en %) : les tests ne dépendent pas de l'équilibrage en cours. */
const withKappa = (kappa: number) => ({ ...BR, CHARACTER: { ...BR.CHARACTER, COMPRESSION_PERCENT: kappa } });
const RAW = withKappa(100);

describe("carte → personnage du battle royale", () => {
  it("toutes les cartes du jeu de départ restent dans les plages prévues", () => {
    for (const card of STARTER_SET) {
      for (const level of [0, 1, 2, 3] as const) {
        const c = battleCharacter(card, level, BR, BONUS);
        expect(c.maxHp).toBeGreaterThanOrEqual(100);
        expect(c.maxHp).toBeLessThanOrEqual(200);
        expect(c.hitRadius).toBeGreaterThanOrEqual(14);
        expect(c.hitRadius).toBeLessThanOrEqual(22);
        expect(c.speed).toBeGreaterThanOrEqual(143);
        expect(c.speed).toBeLessThanOrEqual(260);
        expect(c.weaponPercent).toBeGreaterThanOrEqual(90);
        expect(c.weaponPercent).toBeLessThanOrEqual(110);
        expect(c.damageTakenPercent).toBeGreaterThanOrEqual(75);
        expect(c.damageTakenPercent).toBeLessThanOrEqual(91);
        // Recharge : 6 s + 3 s × énergie (2 à 4), réduite par le passif « recharge rapide ».
        const A = BR.ABILITY;
        expect(c.ability.cooldownMs).toBeGreaterThanOrEqual(Math.floor(((A.COOLDOWN_BASE_MS + 2 * A.COOLDOWN_PER_ENERGY_MS) * (100 - BR.PASSIVE.RECHARGE_PERCENT)) / 100));
        expect(c.ability.cooldownMs).toBeLessThanOrEqual(A.COOLDOWN_BASE_MS + 4 * A.COOLDOWN_PER_ENERGY_MS);
        for (const v of [c.maxHp, c.hitRadius, c.speed, c.weaponPercent, c.ability.permille, c.ability.durationMs, c.passive.permille]) expect(Number.isInteger(v)).toBe(true);
      }
    }
  });

  it("formules sans compression (κ = 100 %) : celles de la conception", () => {
    const raw = RAW;
    const tank = battleCharacter(make({ hp: 140, atk: 20, def: 65, spd: 10 }), 0, raw, BONUS);
    expect([tank.maxHp, tank.hitRadius, tank.speed, tank.weaponPercent, tank.damageTakenPercent]).toEqual([200, 22, 143, 90, 75]);
    const fast = battleCharacter(make({ hp: 60, atk: 65, def: 20, spd: 100 }), 0, raw, BONUS);
    expect([fast.maxHp, fast.hitRadius, fast.speed, fast.weaponPercent, fast.damageTakenPercent]).toEqual([100, 14, 260, 110, 90]);
  });

  it("avantages et inconvénients : robuste = gros et lent, rapide = fragile", () => {
    const tank = battleCharacter(bySlug("cactus-hurleur"), 0, BR, BONUS);
    const fast = battleCharacter(bySlug("wifi-une-barre"), 0, BR, BONUS);
    expect(tank.maxHp).toBeGreaterThan(fast.maxHp);
    // La compression κ rapproche les tailles : la zone de touche du robuste n'est jamais plus petite.
    expect(tank.hitRadius).toBeGreaterThanOrEqual(fast.hitRadius);
    expect(tank.speed).toBeLessThan(fast.speed);
  });

  it("compression : κ = 0 rend tous les personnages identiques ; κ = 50 % divise l'écart par deux", () => {
    const flat = withKappa(0);
    const a = battleCharacter(bySlug("l-algorithme-supreme"), 0, flat, BONUS);
    const b = battleCharacter(bySlug("chaussette-orpheline"), 0, flat, BONUS);
    expect([a.maxHp, a.speed, a.weaponPercent]).toEqual([b.maxHp, b.speed, b.weaponPercent]);
    const god = battleCharacter(bySlug("l-algorithme-supreme"), 0, withKappa(50), BONUS);
    // PV 126 → 92 + (126 − 92) / 2 = 109.
    expect(god.stats.hp).toBe(109);
  });

  it("compression : elle s'applique aussi à la puissance de la capacité et à l'intensité du passif (écart de rareté borné)", () => {
    const R = BR.CHARACTER.REFERENCE;
    // κ = 0 : la godlevel a la même capacité et le même passif qu'une carte de référence aux mêmes effets.
    const flat = withKappa(0);
    const godCard = bySlug("l-algorithme-supreme");
    const god = battleCharacter(godCard, 0, flat, BONUS);
    const reference = battleCharacter(
      make({ specialAttack: { ...godCard.specialAttack, power: R.power }, defenseAbility: { name: "d", effect: { kind: "heal", percent: R.heal } } }),
      0,
      flat,
      BONUS,
    );
    expect(god.ability.permille).toBe(reference.ability.permille);
    expect(god.passive).toEqual(reference.passive);
    // κ = 50 % : la moitié de l'écart à la référence.
    const half = withKappa(50);
    const passive = (effect: Card["defenseAbility"]["effect"]) => battleCharacter(make({ defenseAbility: { name: "d", effect } }), 0, half, BONUS).passive.permille;
    expect(passive({ kind: "heal", percent: R.heal + 8 })).toBe(R.heal + 4);
    expect(passive({ kind: "dodge", chance: R.dodge + 12 })).toBe(Math.floor(((R.dodge + 6) * 10) / BR.PASSIVE.DODGE_DIVISOR));
    expect(passive({ kind: "reflect", percent: R.reflect + 20 })).toBe(Math.floor(((R.reflect + 10) * 10) / BR.PASSIVE.REFLECT_DIVISOR));
    const power = (p: number) => battleCharacter(make({ specialAttack: { name: "x", power: p, energyCost: 3, effect: { kind: "drain", percent: 30 } } }), 0, half, BONUS).ability.permille;
    // Puissance référence + 28 → référence + 14 : intensité (référence + 14) / POWER_REFERENCE, appliquée aux 30 % de vol de vie.
    expect(power(R.power + 28)).toBe(Math.floor((300 * Math.floor(((R.power + 14) * 1000) / BR.ABILITY.POWER_REFERENCE)) / 1000));
  });

  it("évolution : bonus appliqué en partie seulement en bataille (EVOLUTION_FACTOR_PERCENT)", () => {
    const factor = BR.CHARACTER.EVOLUTION_FACTOR_PERCENT;
    const card = bySlug("le-chat-qui-juge");
    const base = battleCharacter(card, 0, BR, BONUS);
    const divine = battleCharacter(card, 3, BR, BONUS);
    expect(divine.stats.hp).toBe(base.stats.hp + Math.floor((base.stats.hp * BONUS[3] * factor) / 10000));
    expect(divine.maxHp).toBeGreaterThanOrEqual(base.maxHp);
    expect(divine.maxHp).toBeLessThanOrEqual(Math.ceil((base.maxHp * (100 + (BONUS[3] * factor) / 100 + 2)) / 100));
  });

  it("capacité active (sans compression) : chaque effet d'attaque spéciale est transposé, recharge 6 s + 3 s × énergie", () => {
    const special = (effect: Card["specialAttack"]["effect"], power = 70, energyCost = 3) =>
      battleCharacter(make({ specialAttack: { name: "x", power, energyCost, effect }, defenseAbility: { name: "d", effect: { kind: "heal", percent: 10 } } }), 0, RAW, BONUS).ability;
    const A = BR.ABILITY;
    expect(special({ kind: "none" })).toMatchObject({ kind: "sprint", cooldownMs: 15000, durationMs: A.SPRINT_MS, permille: A.SPRINT_PERCENT * 10 });
    expect(special({ kind: "stun", chance: 20 })).toMatchObject({ kind: "stun", durationMs: A.ARMED_MS, effectMs: A.STUN_BASE_MS + 20 * A.STUN_MS_PER_CHANCE });
    expect(special({ kind: "drain", percent: 30 })).toMatchObject({ kind: "drain", durationMs: A.DRAIN_MS, permille: 300 });
    expect(special({ kind: "multi", hits: 3, percent: 40 })).toMatchObject({ kind: "multi", hits: 3, permille: 400 });
    expect(special({ kind: "dot", percent: 6, turns: 2 })).toMatchObject({ kind: "burn", permille: 60, effectMs: 2000 });
    expect(special({ kind: "pierce", percent: 40 })).toMatchObject({ kind: "pierce", durationMs: A.PIERCE_MS, permille: 400 });
    expect(special({ kind: "buff", stat: "spd", stages: 1 })).toMatchObject({ kind: "buff", stat: "spd", durationMs: A.BUFF_MS, permille: A.BUFF_PERCENT * 10 });
    expect(special({ kind: "debuff", stat: "def", stages: 1 })).toMatchObject({ kind: "debuff", stat: "def", durationMs: A.ARMED_MS, effectMs: A.DEBUFF_MS, permille: A.DEBUFF_PERCENT * 10 });
    // Intensité × puissance / 70 ; recharge selon le coût d'énergie.
    expect(special({ kind: "drain", percent: 30 }, 84, 4)).toMatchObject({ permille: 360, cooldownMs: 18000 });
    expect(special({ kind: "none" }, 55, 2).cooldownMs).toBe(12000);
  });

  it("passif (sans compression) : soin, esquive, renvoi, immunité, recharge", () => {
    const passive = (effect: Card["defenseAbility"]["effect"]) => battleCharacter(make({ defenseAbility: { name: "d", effect } }), 0, RAW, BONUS);
    expect(passive({ kind: "heal", percent: 10 }).passive).toEqual({ kind: "regen", permille: 10 });
    const P = BR.PASSIVE;
    expect(passive({ kind: "dodge", chance: 15 }).passive).toEqual({ kind: "dodge", permille: Math.floor(150 / P.DODGE_DIVISOR) });
    expect(passive({ kind: "reflect", percent: 20 }).passive).toEqual({ kind: "reflect", permille: Math.floor(200 / P.REFLECT_DIVISOR) });
    expect(passive({ kind: "cleanse" }).passive).toEqual({ kind: "cleanse", permille: P.CLEANSE_PERCENT * 10 });
    const recharge = passive({ kind: "recharge", amount: 1 });
    expect(recharge.passive).toEqual({ kind: "recharge", permille: P.RECHARGE_PERCENT * 10 });
    // Lundi Matin : coût 2 → 12 s, réduite de RECHARGE_PERCENT %.
    expect(recharge.ability.cooldownMs).toBe((12000 * (100 - P.RECHARGE_PERCENT)) / 100);
  });
});
