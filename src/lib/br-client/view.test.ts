import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "@/config/game.config";
import type { BattleCharacter } from "@/lib/br/character";
import { BTN, packCommand } from "@/lib/br/commands";
import { advance, createMatch } from "@/lib/br/engine";
import { ITEM, TILE, type GameMap, type LootItem } from "@/lib/br/map";
import { resolveRules, type Rules } from "@/lib/br/rules";
import { damageEvents, hpTotals, hudState, newKills, pickupCandidate, viewScale, visibleParticipants } from "./view";

const BASE = resolveRules(GAME_CONFIG.BATTLE_ROYALE);
const TS = BASE.map.tileSub;
const RATE = BASE.tickRate;
const tile = (t: number) => t * TS + (TS >> 1);

function rules(participants: number): Rules {
  return { ...BASE, participants, aimAssist: 0, weapons: BASE.weapons.map((w) => ({ ...w, spread: 0 })) };
}

function character(): BattleCharacter {
  return {
    stats: { hp: 92, atk: 39, def: 36, spd: 77 },
    maxHp: 140,
    hitRadius: 18,
    damageTakenPercent: 84,
    speed: 300,
    weaponPercent: 100,
    ability: { kind: "sprint", cooldownMs: 15000, durationMs: 2000, permille: 400, effectMs: 0, hits: 0, stat: null },
    passive: { kind: "regen", permille: 0 },
  };
}

function match(opts: { spawns: number[]; map?: GameMap; loot?: LootItem[] }) {
  const n = opts.spawns.length / 2;
  return createMatch({
    seed: 1,
    rules: rules(n),
    characters: Array.from({ length: n }, character),
    map: opts.map ?? { size: 32, tileSub: TS, tiles: new Uint8Array(32 * 32), buildings: new Int32Array(0) },
    spawns: opts.spawns,
    loot: opts.loot ?? [],
  });
}

const cmd = (move: number, aim: number, buttons = 0) => packCommand({ move, aim, buttons });

describe("ce que voit le joueur (mêmes règles que les bots)", () => {
  it("un ennemi derrière un mur ou au fond d'un buisson n'est pas montré ; le joueur se voit toujours", () => {
    const map: GameMap = { size: 32, tileSub: TS, tiles: new Uint8Array(32 * 32), buildings: new Int32Array(0) };
    for (let y = 0; y < 32; y++) map.tiles[y * 32 + 12] = TILE.wall;
    map.tiles[16 * 32 + 8] = TILE.bush;
    const s = match({ map, spawns: [tile(5), tile(16), tile(15), tile(16), tile(8), tile(16), tile(7), tile(16)] });
    const seen = visibleParticipants(s, 0, new Uint8Array(s.n));
    // 1 : derrière le mur ; 2 : dans un buisson, trop loin ; 3 : à découvert, tout près.
    expect(Array.from(seen)).toEqual([1, 0, 0, 1]);
  });

  it("interface : PV, gilet, arme, chargeur (réserve illimitée pour l'arme de départ), survivants, zone", () => {
    const s = match({ spawns: [tile(5), tile(16), tile(25), tile(16)] });
    s.p.shield[0] = 20;
    const hud = hudState(s, 0);
    expect(hud).toMatchObject({ alive: true, hp: 140, maxHp: 140, shield: 20, weapon: s.rules.startWeapon, otherWeapon: -1, reserve: null, survivors: 2, kills: 0 });
    expect(hud.magazine).toBe(s.rules.weapons[s.rules.startWeapon].magazine);
    expect(hud.zone).toMatchObject({ stage: 0, phase: 0 });
    expect(hud.zone.secondsLeft).toBe(Math.ceil(s.rules.zone[0].waitTicks / RATE));
    expect(hud.abilityReady).toBe(true);
    advance(s, [cmd(0, 0, BTN.ability), 0]);
    expect(hudState(s, 0).abilityReady).toBe(false);
    expect(hudState(s, 0).abilityCooldown).toBeGreaterThan(0.9);
  });

  it("objet à ramasser : le plus proche des objets utiles à portée (un soin inutile avec tous ses PV est ignoré)", () => {
    const at = { x: tile(5), y: tile(16) };
    const loot: LootItem[] = [
      { kind: ITEM.heal, sub: 0, qty: 1, ...at },
      { kind: ITEM.vest, sub: 0, qty: 1, x: at.x + 200, y: at.y },
      { kind: ITEM.weapon, sub: 2, qty: 30, x: at.x + 5000, y: at.y },
    ];
    const s = match({ spawns: [at.x, at.y, tile(25), tile(25)], loot });
    expect(pickupCandidate(s, 0)).toEqual({ kind: ITEM.vest, sub: 0 });
    s.p.hp[0] = 50;
    expect(pickupCandidate(s, 0)).toEqual({ kind: ITEM.heal, sub: 0 });
    s.it.kind[0] = ITEM.none;
    s.it.kind[1] = ITEM.none;
    expect(pickupCandidate(s, 0)).toBeNull();
  });

  it("dégâts affichés (ceux du joueur marqués) et fil des éliminations", () => {
    const s = match({ spawns: [tile(5), tile(16), tile(10), tile(16), tile(25), tile(25)] });
    s.p.hp[1] = 5;
    const seen = visibleParticipants(s, 0, new Uint8Array(s.n));
    let before = hpTotals(s);
    advance(s, [cmd(0, 0, BTN.fire), 0, 0]);
    const events = [];
    for (let t = 0; t < 10; t++) {
      events.push(...damageEvents(before, s, 0, seen));
      before = hpTotals(s);
      advance(s, [0, 0, 0]);
    }
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toMatchObject({ slot: 1, mine: true });
    expect(events[0].amount).toBeGreaterThan(0);
    const kills = newKills(s, 0);
    expect(kills).toEqual([{ tick: s.p.deathTick[1], killer: 0, victim: 1, cause: s.rules.startWeapon }]);
    expect(newKills(s, kills.length)).toEqual([]);
    expect(hudState(s, 0)).toMatchObject({ survivors: 2, kills: 1 });
  });

  it("même champ de vision pour tous : l'écran entier montre le rectangle du moteur, bandes sur les côtés si besoin", () => {
    const { halfWidth, halfHeight } = BASE.view;
    expect(viewScale(1800, 1000, BASE.view)).toBeCloseTo(1800 / (2 * halfWidth));
    // Écran plus large que le rectangle : la hauteur décide (bandes à gauche et à droite).
    expect(viewScale(2000, 500, BASE.view)).toBeCloseTo(500 / (2 * halfHeight));
  });
});
