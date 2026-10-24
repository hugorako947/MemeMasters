import { describe, expect, it } from "vitest";
import { BR_WEAPONS, GAME_CONFIG } from "@/config/game.config";
import { STARTER_SET } from "@/content/cards/starter-set";
import { ACTION, basePersona, botLevelForTrophies, PERSONA } from "./bot";
import { battleCharacter, type BattleCharacter } from "./character";
import { advance, createMatch } from "./engine";
import { ITEM, TILE, type GameMap, type LootItem } from "./map";
import { resolveRules, type Rules } from "./rules";
import { Z, type MatchState } from "./state";
import { canSee, canSeePoint } from "./vision";

const BASE = resolveRules(GAME_CONFIG.BATTLE_ROYALE);
const TS = BASE.map.tileSub;
const RATE = BASE.tickRate;
const RAFALEUSE = BR_WEAPONS.indexOf("rafaleuse");

/** Règles de test : une zone qui ne bouge pas pendant le test (sauf mention). */
function rules(participants: number, over: Partial<Rules> = {}): Rules {
  return { ...BASE, participants, zone: [{ waitTicks: 100_000, shrinkTicks: 100, radiusPercent: 0, dps: 1 }], ...over };
}

/** Carte ouverte de 40 × 40 tuiles, bordée d'eau. */
function openMap(size = 40): GameMap {
  const tiles = new Uint8Array(size * size);
  for (let i = 0; i < size; i++) for (const [x, y] of [[i, 0], [i, size - 1], [0, i], [size - 1, i]]) tiles[y * size + x] = TILE.water;
  return { size, tileSub: TS, tiles, buildings: new Int32Array(0) };
}

function character(over: Partial<BattleCharacter> = {}): BattleCharacter {
  return {
    stats: { hp: 92, atk: 39, def: 36, spd: 77 },
    maxHp: 140,
    hitRadius: 18,
    damageTakenPercent: 84,
    speed: 300,
    weaponPercent: 100,
    ability: { kind: "sprint", cooldownMs: 15000, durationMs: 2000, permille: 400, effectMs: 0, hits: 0, stat: null },
    passive: { kind: "regen", permille: 0 },
    ...over,
  };
}

const tile = (t: number) => t * TS + (TS >> 1);

function match(opts: { botLevels: (number | null)[]; spawns: number[]; chars?: BattleCharacter[]; map?: GameMap; loot?: LootItem[]; seed?: number; rules?: Rules }): MatchState {
  const chars = opts.chars ?? opts.botLevels.map(() => character());
  return createMatch({
    seed: opts.seed ?? 1,
    rules: opts.rules ?? rules(chars.length),
    characters: chars,
    map: opts.map ?? openMap(),
    spawns: opts.spawns,
    loot: opts.loot ?? [],
    botLevels: opts.botLevels,
  });
}

/** Avance de `ticks` calculs ; les emplacements sans bot (mannequins) restent immobiles. */
function run(s: MatchState, ticks: number, each?: (s: MatchState) => void) {
  const idle = new Uint32Array(s.n);
  for (let t = 0; t < ticks && !s.finished; t++) {
    advance(s, idle);
    each?.(s);
  }
}

const dist = (s: MatchState, i: number, x: number, y: number) => Math.hypot(s.p.x[i] - x, s.p.y[i] - y);

describe("vision : la même règle pour le joueur, l'aide à la visée et les bots", () => {
  it("rectangle de vision, murs, buissons (visible seulement de tout près)", () => {
    const map = openMap();
    for (let y = 1; y < 39; y++) map.tiles[y * 40 + 20] = TILE.wall;
    map.tiles[10 * 40 + 8] = TILE.bush;
    const s = match({ map, botLevels: [null, null, null, null], spawns: [tile(5), tile(10), tile(8), tile(10), tile(25), tile(10), tile(5), tile(30)] });
    expect(canSee(s, 0, 1)).toBe(false); // dans un buisson, à 96 unités
    s.p.x[0] = tile(7);
    expect(canSee(s, 0, 1)).toBe(true); // à 32 unités
    expect(canSee(s, 0, 2)).toBe(false); // derrière le mur
    expect(canSee(s, 0, 3)).toBe(false); // 640 unités plus bas : hors du champ (± 250)
    s.p.y[3] = tile(16);
    expect(canSee(s, 0, 3)).toBe(true);
    expect(canSeePoint(s, 0, tile(25), tile(10))).toBe(false);
    expect(canSeePoint(s, 0, tile(12), tile(10))).toBe(true);
  });
});

describe("bots : réglages", () => {
  it("niveau selon les trophées du joueur (en dixièmes) : un niveau tous les 600 trophées, 10 au plus", () => {
    expect(botLevelForTrophies(0, BASE)).toBe(0);
    expect(botLevelForTrophies(599, BASE)).toBe(9);
    expect(botLevelForTrophies(600, BASE)).toBe(10);
    expect(botLevelForTrophies(3000, BASE)).toBe(50);
    expect(botLevelForTrophies(6000, BASE)).toBe(100);
    expect(botLevelForTrophies(25_000, BASE)).toBe(100);
    expect(botLevelForTrophies(-5, BASE)).toBe(0);
  });

  it("personnalité tirée du personnage : prudent, agressif, mobile, tireur de loin", () => {
    const ref = BASE.bots.reference;
    const of = (slug: string) => basePersona(battleCharacter(STARTER_SET.find((c) => c.slug === slug)!, 0, GAME_CONFIG.BATTLE_ROYALE, GAME_CONFIG.DUPLICATES.STAT_BONUS_PERCENT), ref);
    expect(of("tata-barbecue")).toBe(PERSONA.cautious); // PV hauts, régénération
    expect(of("micro-ondes-rebelle")).toBe(PERSONA.aggressive); // ATQ haute
    expect(of("wifi-une-barre")).toBe(PERSONA.mobile); // VIT haute
    expect(of("clavier-en-rage")).toBe(PERSONA.sniper); // perce-armure
  });

  it("chaque bot reçoit ses réglages de difficulté ; un emplacement de joueur n'en a pas", () => {
    const s = match({ botLevels: [100, 0, null], spawns: [tile(5), tile(5), tile(30), tile(5), tile(5), tile(30)] });
    expect(s.botCount).toBe(2);
    expect(s.b.level[2]).toBe(-1);
    expect(s.b.react[0]).toBeLessThan(s.b.react[1]);
    expect(s.b.aimErr[0]).toBeLessThan(s.b.aimErr[1]);
    expect(s.b.noise[0]).toBeLessThan(s.b.noise[1]);
    expect(Math.abs(s.b.level[0] - 100)).toBeLessThanOrEqual(10);
    expect(Math.abs(s.b.level[1] - 0)).toBeLessThanOrEqual(10);
  });
});

describe("bots : comportement", () => {
  it("tire sur un ennemi visible et lui fait perdre des PV", () => {
    const s = match({ botLevels: [100, null], spawns: [tile(10), tile(20), tile(18), tile(20)] });
    run(s, 5 * RATE);
    expect(s.p.hp[1]).toBeLessThan(s.fighters[1].maxHp);
    expect(s.p.damage[0]).toBeGreaterThan(0);
  });

  it("ne voit pas et ne tire pas à travers un mur", () => {
    const map = openMap();
    for (let y = 1; y < 39; y++) map.tiles[y * 40 + 20] = TILE.wall;
    const s = match({ map, botLevels: [100, null], spawns: [tile(16), tile(20), tile(24), tile(20)] });
    run(s, 10 * RATE);
    expect(s.p.lastShot[0]).toBeLessThan(0);
    expect(s.p.hp[1]).toBe(s.fighters[1].maxHp);
  });

  it("ramasse une meilleure arme qu'il voit", () => {
    const loot = [{ kind: ITEM.weapon, sub: RAFALEUSE, qty: 30, x: tile(14), y: tile(20) }];
    const s = match({ botLevels: [50, null], spawns: [tile(10), tile(20), tile(36), tile(36)], loot });
    run(s, 5 * RATE);
    expect(s.p.weapon1[0]).toBe(RAFALEUSE);
  });

  it("se soigne quand il est blessé et hors de danger", () => {
    const s = match({ botLevels: [50, null], spawns: [tile(10), tile(20), tile(36), tile(36)] });
    s.p.hp[0] = 50;
    s.p.heals[0] = 2;
    run(s, 3 * RATE);
    expect(s.p.heals[0]).toBeLessThan(2);
    expect(s.p.hp[0]).toBeGreaterThan(50);
  });

  it("rejoint la zone à temps, en contournant un mur par son ouverture", () => {
    const map = openMap();
    for (let y = 1; y < 39; y++) if (y !== 30 && y !== 31) map.tiles[y * 40 + 20] = TILE.wall;
    // Le mannequin est enfermé (invisible et hors d'atteinte) : le bot n'a que la zone à gérer.
    for (let k = 34; k <= 38; k++) for (const [x, y] of [[k, 34], [k, 38], [34, k], [38, k]]) map.tiles[y * 40 + x] = TILE.wall;
    const zoneRules = rules(2, { zone: [{ waitTicks: 5 * RATE, shrinkTicks: 20 * RATE, radiusPercent: 10, dps: 50 }] });
    const s = match({ map, rules: zoneRules, botLevels: [30, null], spawns: [tile(10), tile(10), tile(36), tile(36)] });
    s.zone[Z.tx] = tile(32);
    s.zone[Z.ty] = tile(10);
    s.zone[Z.tr] = 4 * TS;
    run(s, 25 * RATE);
    expect(s.p.alive[0]).toBe(1);
    expect(dist(s, 0, tile(32), tile(10))).toBeLessThan(4 * TS);
  });

  it("contourne un obstacle pour atteindre un objet visible (recherche de chemin), sans rester coincé", () => {
    const map = openMap();
    // Bassin en U (l'eau laisse voir mais pas passer) autour de l'objet, ouvert vers la droite.
    for (let y = 14; y <= 26; y++) map.tiles[y * 40 + 18] = TILE.water;
    for (let x = 18; x <= 28; x++) {
      map.tiles[14 * 40 + x] = TILE.water;
      map.tiles[26 * 40 + x] = TILE.water;
    }
    const loot = [{ kind: ITEM.weapon, sub: RAFALEUSE, qty: 30, x: tile(22), y: tile(20) }];
    const s = match({ map, botLevels: [60, null], spawns: [tile(12), tile(20), tile(3), tile(36)], loot });
    run(s, 15 * RATE);
    expect(s.p.weapon1[0]).toBe(RAFALEUSE);
  });

  it("fuit un ennemi quand il lui reste peu de PV", () => {
    const s = match({ botLevels: [80, null], spawns: [tile(16), tile(20), tile(24), tile(20)] });
    s.p.hp[0] = 20;
    s.p.heals[0] = 0;
    const before = dist(s, 0, s.p.x[1], s.p.y[1]);
    let fled = false;
    run(s, 2 * RATE, (st) => (fled ||= st.b.action[0] === ACTION.flee));
    expect(fled).toBe(true);
    expect(dist(s, 0, s.p.x[1], s.p.y[1])).toBeGreaterThan(before + 4 * TS);
  });

  it("utilise sa capacité en combat", () => {
    const stunner = character({ ability: { kind: "stun", cooldownMs: 15000, durationMs: 3000, permille: 0, effectMs: 600, hits: 0, stat: null } });
    const s = match({ botLevels: [100, null], chars: [stunner, character()], spawns: [tile(10), tile(20), tile(17), tile(20)] });
    let used = false;
    run(s, 8 * RATE, (st) => (used ||= st.p.abilityCd[0] > 0));
    expect(used).toBe(true);
  });

  it("temps de réaction : le premier tir d'un bot de niveau 10 part bien avant celui d'un bot de niveau 0", () => {
    const firstShot = (level: number) => {
      const s = match({ botLevels: [level, null], spawns: [tile(10), tile(20), tile(16), tile(20)] });
      let t = -1;
      run(s, 3 * RATE, (st) => {
        if (t < 0 && st.p.lastShot[0] >= 0) t = st.tick;
      });
      return t;
    };
    const fast = firstShot(100);
    const slow = firstShot(0);
    expect(fast).toBeGreaterThan(0);
    expect(slow).toBeGreaterThan(fast + 6);
  });

  it("en duel, le niveau 10 bat le niveau 0 presque toujours", () => {
    // Avec la seule arme de départ, aucun des deux ne cherche le combat : le duel peut prendre une minute ou deux.
    let wins = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const [a, b] = seed % 2 ? [tile(10), tile(22)] : [tile(22), tile(10)];
      const s = match({ seed, botLevels: [100, 0], spawns: [a, tile(20), b, tile(20)] });
      run(s, 120 * RATE);
      if (s.finished && s.p.place[0] === 1) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(10);
  }, 60_000);
});
