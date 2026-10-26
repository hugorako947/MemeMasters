import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "@/config/game.config";
import { bulletDamage, type BattleCharacter } from "./character";
import { BTN, packCommand } from "./commands";
import { advance, createMatch, matchResult, step } from "./engine";
import { angleDiff, idiv } from "./fixed";
import { ITEM, TILE, type GameMap, type LootItem } from "./map";
import { KNIFE, resolveRules, SUB, type Rules } from "./rules";
import { C, cloneState, KILL_KNIFE, KILL_ZONE, stateHash, weaponInHand, type MatchState } from "./state";
import { canSee } from "./vision";

const BASE = resolveRules(GAME_CONFIG.BATTLE_ROYALE);
const TS = BASE.map.tileSub;
const RATE = BASE.tickRate;
/** Dégâts d'une balle de l'arme de départ (lus dans la configuration : ils changent avec l'équilibrage). */
const START_DAMAGE = BASE.weapons[BASE.startWeapon].damage;

/** Règles de test : sans dispersion ni aide à la visée, pour des tirs exacts. */
function rules(over: Partial<Rules> = {}): Rules {
  return { ...BASE, aimAssist: 0, weapons: BASE.weapons.map((w) => ({ ...w, spread: 0 })), ...over };
}

function openMap(size = 32): GameMap {
  return { size, tileSub: TS, tiles: new Uint8Array(size * size), buildings: new Int32Array(0) };
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

function match(opts: { chars?: BattleCharacter[]; spawns?: number[]; map?: GameMap; loot?: LootItem[]; rules?: Rules; seed?: number }) {
  const chars = opts.chars ?? [character(), character()];
  return createMatch({
    seed: opts.seed ?? 1,
    rules: opts.rules ?? rules({ participants: chars.length }),
    characters: chars,
    map: opts.map ?? openMap(),
    spawns: opts.spawns ?? [tile(5), tile(16), tile(10), tile(16)],
    loot: opts.loot ?? [],
  });
}

const cmd = (move: number, aim: number, buttons = 0) => packCommand({ move, aim, buttons });

function run(s: MatchState, ticks: number, commands: (i: number, t: number) => number) {
  for (let t = 0; t < ticks; t++) advance(s, Array.from({ length: s.n }, (_, i) => commands(i, s.tick)));
}

/** Règle du couteau. */
const s0Knife = () => BASE.weapons[KNIFE];

/** Dégâts attendus d'une balle : arme × ATQ (%), puis armure 200 / (200 + DÉF) ; la même formule sert à l'affichage. */
const expectedHit = (damage: number, weaponPercent: number, def: number) => {
  const hit = Math.max(1, idiv(Math.max(1, idiv(damage * weaponPercent * 1000, 100_000)) * 200, 200 + def));
  expect(bulletDamage(damage, weaponPercent, def).hit).toBe(hit);
  return hit;
};

describe("moteur : déplacement et visée", () => {
  it("16 directions, vitesse du personnage, pas de bonus en diagonale", () => {
    const s = match({});
    const speed = idiv(300 * SUB, RATE);
    const x0 = s.p.x[0];
    run(s, RATE, (i) => (i === 0 ? cmd(1, 0) : 0));
    expect(s.p.x[0] - x0).toBe(RATE * speed);
    const d = match({});
    const [dx0, dy0] = [d.p.x[0], d.p.y[0]];
    run(d, RATE, (i) => (i === 0 ? cmd(3, 0) : 0)); // direction 3 = 45°
    const dist = Math.hypot(d.p.x[0] - dx0, d.p.y[0] - dy0);
    expect(Math.abs(dist - RATE * speed)).toBeLessThan(RATE * 2);
    // Les participants sont libres de se croiser ; un participant immobile ne bouge pas.
    expect([d.p.x[1], d.p.y[1]]).toEqual([tile(10), tile(16)]);
  });

  it("les murs et l'eau arrêtent le déplacement ; on glisse le long d'un mur", () => {
    const map = openMap();
    for (let y = 0; y < 32; y++) map.tiles[y * 32 + 8] = TILE.wall;
    map.tiles[20 * 32 + 3] = TILE.water;
    const s = match({ map, spawns: [tile(6), tile(10), tile(3), tile(18)] });
    run(s, 40, (i) => (i === 0 ? cmd(2, 0) : cmd(5, 0))); // 0 : droite-bas (22,5°) ; 1 : vers le bas
    const r = 18 * SUB;
    expect(s.p.x[0]).toBe(8 * TS - r); // collé au mur, sans le chevaucher
    expect(s.p.y[0]).toBeGreaterThan(tile(10)); // a glissé vers le bas
    expect(s.p.y[1] + r).toBeLessThanOrEqual(20 * TS); // arrêté par l'eau
  });

  it("la visée tourne d'au plus 32 pas par tick (même règle pour tous)", () => {
    const s = match({});
    // Au départ, chacun regarde vers le centre de la carte ; on part ici de 0.
    s.p.aim[0] = 0;
    advance(s, [cmd(0, 100), 0]);
    expect(s.p.aim[0]).toBe(32);
    run(s, 3, (i) => (i === 0 ? cmd(0, 100) : 0));
    expect(s.p.aim[0]).toBe(100);
    advance(s, [cmd(0, 90), 0]);
    expect(s.p.aim[0]).toBe(90);
  });
});

describe("moteur : armes et dégâts", () => {
  it("tir, cadence, chargeur et rechargement automatique (arme de départ : réserve illimitée)", () => {
    const s = match({ spawns: [tile(5), tile(5), tile(25), tile(25)] });
    const pop = s.rules.weapons[s.rules.startWeapon];
    advance(s, [cmd(0, 0, BTN.fire), 0]);
    expect(s.shotCount).toBe(1);
    expect(s.p.mag0[0]).toBe(pop.magazine - 1);
    run(s, pop.fireTicks - 1, (i) => (i === 0 ? cmd(0, 0, BTN.fire) : 0));
    expect(s.p.mag0[0]).toBe(pop.magazine - 1);
    run(s, 1, (i) => (i === 0 ? cmd(0, 0, BTN.fire) : 0));
    expect(s.p.mag0[0]).toBe(pop.magazine - 2);
    run(s, pop.fireTicks * pop.magazine, (i) => (i === 0 ? cmd(0, 0, BTN.fire) : 0));
    expect(s.p.mag0[0]).toBe(0);
    expect(s.p.reload[0]).toBeGreaterThan(0);
    run(s, pop.reloadTicks, () => 0);
    expect(s.p.mag0[0]).toBe(pop.magazine);
  });

  it("dégâts : arme × ATQ, armure, gilet consommé avant les PV, crédit au tireur", () => {
    const shooter = character({ weaponPercent: 106 });
    const target = character({ stats: { hp: 92, atk: 39, def: 50, spd: 77 } });
    const s = match({ chars: [shooter, target] });
    const per = expectedHit(START_DAMAGE, 106, 50);
    advance(s, [cmd(0, 0, BTN.fire), 0]);
    run(s, 10, () => 0);
    expect(s.p.hp[1]).toBe(140 - per);
    expect(s.p.damage[0]).toBe(per);
    s.p.shield[1] = 5;
    run(s, 12, (i, t) => (i === 0 && t % 20 === 0 ? cmd(0, 0, BTN.fire) : 0));
    expect(s.p.shield[1]).toBe(0);
    expect(s.p.hp[1]).toBe(140 - 2 * per + 5);
  });

  it("les murs et les caisses arrêtent les balles, pas l'eau ni les buissons", () => {
    for (const [obstacle, blocked] of [
      [TILE.wall, true],
      [TILE.crate, true],
      [TILE.water, false],
      [TILE.bush, false],
    ] as const) {
      const map = openMap();
      map.tiles[16 * 32 + 7] = obstacle;
      const s = match({ map });
      advance(s, [cmd(0, 0, BTN.fire), 0]);
      run(s, 15, () => 0);
      expect(s.p.hp[1] < 140).toBe(!blocked);
    }
  });

  it("élimination : place, journal, arme et objets lâchés ; le dernier en vie gagne", () => {
    const s = match({ chars: [character(), character(), character()], spawns: [tile(5), tile(16), tile(10), tile(16), tile(25), tile(25)] });
    s.p.hp[1] = 1;
    s.p.weapon1[1] = 2;
    s.p.mag1[1] = 7;
    s.m.ammo[4 * 1 + 1] = 30;
    advance(s, [cmd(0, 0, BTN.fire), 0, 0]);
    run(s, 10, () => 0);
    expect(s.p.alive[1]).toBe(0);
    expect(s.p.place[1]).toBe(3);
    expect(s.p.killedBy[1]).toBe(0);
    expect(s.p.kills[0]).toBe(1);
    expect(s.aliveCount).toBe(2);
    expect(Array.from(s.log.slice(0, 4))).toEqual([s.p.deathTick[1], 0, 1, s.rules.startWeapon]);
    const dropped = Array.from({ length: s.itemCount }, (_, k) => [s.it.kind[k], s.it.sub[k], s.it.qty[k]]);
    expect(dropped).toEqual(expect.arrayContaining([[ITEM.weapon, 2, 7], [ITEM.ammo, 1, 30]]));
    s.p.hp[2] = 1;
    s.p.x[0] = tile(20);
    s.p.y[0] = tile(25);
    advance(s, [cmd(0, 0, BTN.fire), 0, 0]);
    run(s, 10, () => 0);
    expect(s.finished).toBe(true);
    const result = matchResult(s);
    expect(result.places).toEqual([1, 3, 2]);
  });
});

describe("moteur : objets", () => {
  it("ramasser : arme (échange sur place), munitions (plafond), soins, gilet", () => {
    const at = { x: tile(5), y: tile(16) };
    const loot: LootItem[] = [
      { kind: ITEM.weapon, sub: 2, qty: 30, ...at },
      { kind: ITEM.ammo, sub: 1, qty: 200, x: at.x + 100, y: at.y },
      { kind: ITEM.heal, sub: 0, qty: 1, x: at.x + 200, y: at.y },
      { kind: ITEM.vest, sub: 0, qty: 1, x: at.x + 300, y: at.y },
      { kind: ITEM.weapon, sub: 3, qty: 4, x: at.x, y: at.y + 50 },
    ];
    const s = match({ loot });
    const press = () => {
      advance(s, [cmd(0, 0, BTN.pickup), 0]);
      advance(s, [0, 0]);
    };
    press(); // la plus proche : la Rafaleuse
    expect([s.p.weapon1[0], s.p.mag1[0], s.p.active[0], s.it.kind[0]]).toEqual([2, 30, 1, ITEM.none]);
    press(); // la Lunette, à 50 : échange, la Rafaleuse est posée au sol
    expect([s.p.weapon1[0], s.p.mag1[0]]).toEqual([3, 4]);
    expect([s.it.kind[4], s.it.sub[4], s.it.qty[4]]).toEqual([ITEM.weapon, 2, 30]);
    s.it.kind[4] = ITEM.none;
    press(); // munitions légères : plafonnées, le reste reste au sol
    expect(s.m.ammo[1]).toBe(s.rules.items.ammoMax[1]);
    expect(s.it.qty[1]).toBe(200 - s.rules.items.ammoMax[1]);
    s.it.kind[1] = ITEM.none;
    press(); // PV pleins : le soin, inutile, reste au sol ; le gilet (plus loin) est ramassé
    expect(s.p.shield[0]).toBe(s.rules.items.vestShield);
    expect(s.it.kind[2]).toBe(ITEM.heal);
    s.p.hp[0] = 50;
    press(); // soin immédiat
    expect(s.p.hp[0]).toBe(50 + s.rules.items.healHp);
    expect(s.it.kind[2]).toBe(ITEM.none);
  });

  it("soin : immédiat au ramassage, surplus perdu au-delà des PV max, jamais ramassé avec tous ses PV", () => {
    const s = match({ loot: [{ kind: ITEM.heal, sub: 0, qty: 2, x: tile(5), y: tile(16) }] });
    const max = s.fighters[0].maxHp;
    const press = () => {
      advance(s, [cmd(0, 0, BTN.pickup), 0]);
      advance(s, [0, 0]);
    };
    press();
    expect([s.p.hp[0], s.it.qty[0], s.counters[C.usedHeals]]).toEqual([max, 2, 0]);
    s.p.hp[0] = max - 10;
    press();
    expect([s.p.hp[0], s.it.qty[0], s.counters[C.usedHeals]]).toEqual([max, 1, 1]);
    // Ni ralentissement ni attente : on avance à pleine vitesse juste après.
    s.p.hp[0] = 20;
    const x0 = s.p.x[0];
    advance(s, [cmd(1, 0, BTN.pickup), 0]);
    expect(s.p.hp[0]).toBe(20 + s.rules.items.healHp);
    expect(s.p.x[0] - x0).toBe(idiv(300 * SUB, RATE));
    expect(s.it.kind[0]).toBe(ITEM.none);
  });

  it("une caisse a toujours deux cases libres autour d'elle (aucun passage d'une seule case)", () => {
    for (let seed = 1; seed <= 5; seed++) {
      const s = createMatch({ seed, rules: BASE, characters: Array.from({ length: 4 }, () => character()) });
      const { size, tiles } = s.map;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (tiles[y * size + x] !== TILE.crate) continue;
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const t = tiles[(y + dy) * size + x + dx];
              if (dx || dy) expect(t === TILE.floor || t === TILE.bush).toBe(true);
            }
          }
        }
      }
    }
  });
});

describe("moteur : capacités et passifs", () => {
  const withAbility = (ability: Partial<BattleCharacter["ability"]>) => character({ ability: { ...character().ability, ...ability } });

  it("sprint : +40 % de vitesse pendant 2 s, puis recharge", () => {
    const s = match({ chars: [withAbility({ kind: "sprint" }), character()] });
    advance(s, [cmd(1, 0, BTN.ability), 0]);
    const x0 = s.p.x[0];
    run(s, RATE, (i) => (i === 0 ? cmd(1, 0) : 0));
    expect(s.p.x[0] - x0).toBe(RATE * idiv(idiv(300 * SUB, RATE) * 1400, 1000));
    expect(s.p.abilityCd[0]).toBeGreaterThan(0);
  });

  it("étourdissement : la prochaine balle immobilise la cible", () => {
    const s = match({ chars: [withAbility({ kind: "stun", durationMs: 3000, effectMs: 600 }), character()] });
    advance(s, [cmd(0, 0, BTN.ability), 0]);
    advance(s, [cmd(0, 0, BTN.fire), 0]);
    run(s, 8, () => 0);
    expect(s.p.stun[1]).toBeGreaterThan(0);
    const y0 = s.p.y[1];
    run(s, 3, (i) => (i === 1 ? cmd(5, 64) : 0));
    expect(s.p.y[1]).toBe(y0);
  });

  it("vol de vie, rafale, brûlure, perce-armure, boost et affaiblissement", () => {
    // Vol de vie : 50 % des dégâts rendus en PV.
    const d = match({ chars: [withAbility({ kind: "drain", durationMs: 4000, permille: 500 }), character()] });
    d.p.hp[0] = 100;
    advance(d, [cmd(0, 0, BTN.ability), 0]);
    advance(d, [cmd(0, 0, BTN.fire), 0]);
    run(d, 8, () => 0);
    const dealt = 140 - d.p.hp[1];
    expect(d.p.hp[0]).toBe(100 + idiv(dealt * 500, 1000));
    // Rafale : 3 balles à 40 % des dégâts, sans munitions.
    const m = match({ chars: [withAbility({ kind: "multi", hits: 3, permille: 400 }), character()] });
    advance(m, [cmd(0, 0, BTN.ability), 0]);
    expect(m.shotCount).toBe(3);
    expect(m.p.mag0[0]).toBe(m.rules.weapons[m.rules.startWeapon].magazine);
    // Brûlure : 10 % des PV max par seconde pendant 2 s.
    const b = match({ chars: [withAbility({ kind: "burn", permille: 100, effectMs: 2000 }), character()] });
    advance(b, [cmd(0, 0, BTN.ability), 0]);
    run(b, 10, () => 0);
    const afterImpact = b.p.hp[1];
    expect(b.p.burnLeft[1]).toBeGreaterThan(0);
    run(b, 2 * RATE, () => 0);
    expect(afterImpact - b.p.hp[1]).toBe(2 * 14);
    // Perce-armure : 100 % de l'armure ignorée ; boost d'ATQ ; affaiblissement de la cible.
    const p = match({ chars: [withAbility({ kind: "pierce", durationMs: 4000, permille: 1000 }), character({ stats: { hp: 92, atk: 39, def: 60, spd: 77 } })] });
    advance(p, [cmd(0, 0, BTN.ability), 0]);
    advance(p, [cmd(0, 0, BTN.fire), 0]);
    run(p, 8, () => 0);
    expect(140 - p.p.hp[1]).toBe(START_DAMAGE);
    const f = match({ chars: [withAbility({ kind: "buff", stat: "atk", durationMs: 5000, permille: 250 }), character()] });
    advance(f, [cmd(0, 0, BTN.ability), 0]);
    advance(f, [cmd(0, 0, BTN.fire), 0]);
    run(f, 8, () => 0);
    expect(140 - f.p.hp[1]).toBe(expectedHit(START_DAMAGE, 125, 36));
    const w = match({ chars: [withAbility({ kind: "debuff", stat: "spd", durationMs: 3000, effectMs: 4000, permille: 200 }), character()] });
    advance(w, [cmd(0, 0, BTN.ability), 0]);
    advance(w, [cmd(0, 0, BTN.fire), 0]);
    run(w, 8, () => 0);
    expect(w.m.debuffLeft[3 * 1 + 2]).toBeGreaterThan(0);
    expect(w.m.debuffPermille[3 * 1 + 2]).toBe(200);
  });

  it("passifs : régénération après quelques secondes sans dégâts (jusqu'au plafond), esquive, renvoi, immunité", () => {
    const r = match({ chars: [character(), character({ passive: { kind: "regen", permille: 20 } })] });
    const cap = Math.floor((140 * BASE.regenCapPercent) / 100);
    r.p.hp[1] = 1;
    run(r, BASE.regenDelayTicks - RATE, () => 0);
    expect(r.p.hp[1]).toBe(1);
    run(r, 20 * RATE, () => 0);
    expect(r.p.hp[1]).toBe(cap);
    // Esquive certaine (1000 ‰) : aucune balle ne touche.
    const d = match({ chars: [character(), character({ passive: { kind: "dodge", permille: 1000 } })] });
    advance(d, [cmd(0, 0, BTN.fire), 0]);
    run(d, 10, () => 0);
    expect(d.p.hp[1]).toBe(140);
    // Renvoi : 50 % des dégâts reçus reviennent au tireur.
    const f = match({ chars: [character(), character({ passive: { kind: "reflect", permille: 500 } })] });
    advance(f, [cmd(0, 0, BTN.fire), 0]);
    run(f, 10, () => 0);
    expect(140 - f.p.hp[0]).toBe(idiv((140 - f.p.hp[1]) * 500, 1000));
    // Immunité : étourdissement deux fois plus court.
    const stunner = character({ ability: { ...character().ability, kind: "stun", durationMs: 3000, effectMs: 1000 } });
    const a = match({ chars: [stunner, character()] });
    const c = match({ chars: [stunner, character({ passive: { kind: "cleanse", permille: 500 } })] });
    for (const s of [a, c]) {
      advance(s, [cmd(0, 0, BTN.ability), 0]);
      advance(s, [cmd(0, 0, BTN.fire), 0]);
      run(s, 8, () => 0);
    }
    expect(c.p.stun[1] * 2).toBeLessThanOrEqual(a.p.stun[1] + 2);
  });
});

describe("moteur : zone et fin de partie", () => {
  it("la zone rétrécit par phases, reste incluse dans la précédente et blesse hors du cercle chaque seconde", () => {
    const zoneRules = rules({ participants: 2, zone: [{ waitTicks: RATE, shrinkTicks: 4 * RATE, radiusPercent: 40, dps: 30 }, { waitTicks: RATE, shrinkTicks: 4 * RATE, radiusPercent: 0, dps: 60 }] });
    const s = match({ rules: zoneRules, map: openMap(64), spawns: [tile(1), tile(1), tile(32), tile(32)] });
    let prev = [s.zone[3], s.zone[4], s.zone[5]];
    let hurt = false;
    for (let t = 0; t < 12 * RATE && !s.finished; t++) {
      const hp = s.p.hp[0];
      advance(s, [0, 0]);
      const [cx, cy, r] = [s.zone[3], s.zone[4], s.zone[5]];
      expect(r).toBeLessThanOrEqual(prev[2]);
      expect((cx - prev[0]) ** 2 + (cy - prev[1]) ** 2).toBeLessThanOrEqual((prev[2] - r) ** 2);
      if (s.p.alive[0] && s.p.hp[0] < hp) {
        hurt = true;
        expect(s.tick % RATE).toBe(0);
      }
      prev = [cx, cy, r];
    }
    expect(hurt).toBe(true);
    expect(s.finished).toBe(true);
    expect(matchResult(s).killedBy).toEqual([-1, -1].map((v, i) => (s.p.place[i] === 1 ? -2 : v)));
    expect(Array.from(s.log.slice(3, 4))).toEqual([KILL_ZONE]);
  });
});

describe("moteur : couteau, caisses, lunettes et boisson énergisante", () => {
  const settle = (s: MatchState) => run(s, BASE.switchTicks + 1, () => 0);

  it("trois armes : arme de départ → arme ramassée → couteau → arme de départ (sans arme ramassée : directement le couteau)", () => {
    const s = match({});
    advance(s, [cmd(0, 0, BTN.nextWeapon), 0]);
    expect(weaponInHand(s, 0)).toBe(KNIFE);
    advance(s, [0, 0]);
    advance(s, [cmd(0, 0, BTN.nextWeapon), 0]);
    expect(weaponInHand(s, 0)).toBe(s.rules.startWeapon);
    advance(s, [0, 0]);
    s.p.weapon1[0] = 2;
    s.p.mag1[0] = 10;
    const order: number[] = [];
    for (let k = 0; k < 3; k++) {
      advance(s, [cmd(0, 0, BTN.nextWeapon), 0]);
      advance(s, [0, 0]);
      order.push(weaponInHand(s, 0));
    }
    expect(order).toEqual([2, KNIFE, s.rules.startWeapon]);
  });

  it("couteau : frappe ce qui est devant, à courte portée (armure comprise), sans munitions ; élimination au couteau", () => {
    const knife = s0Knife();
    const s = match({ chars: [character(), character(), character()], spawns: [tile(10), tile(16), tile(12), tile(16), tile(10), tile(22)] });
    advance(s, [cmd(0, 0, BTN.nextWeapon), 0, 0]);
    settle(s);
    advance(s, [cmd(0, 0, BTN.fire), 0, 0]);
    expect(s.p.hp[1]).toBe(140 - expectedHit(knife.damage, 100, 36));
    expect(s.p.hp[2]).toBe(140);
    expect(s.shotCount).toBe(0);
    // Cadence : un seul coup tant que le couteau n'est pas prêt.
    advance(s, [cmd(0, 0, BTN.fire), 0, 0]);
    expect(s.p.hp[1]).toBe(140 - expectedHit(knife.damage, 100, 36));
    s.p.hp[1] = 1;
    run(s, knife.fireTicks + 1, (i) => (i === 0 ? cmd(0, 0, BTN.fire) : 0));
    expect(s.p.alive[1]).toBe(0);
    expect(s.log[3]).toBe(KILL_KNIFE);
  });

  it("caisses : les balles les abîment ; brisée, la caisse devient du sol et lâche un objet ; le couteau aussi", () => {
    const map = openMap();
    map.tiles[16 * 32 + 8] = TILE.crate;
    map.tiles[16 * 32 + 6] = TILE.crate;
    const s = match({ map, spawns: [tile(4), tile(16), tile(16), tile(16)] });
    expect(s.crates[16 * 32 + 6]).toBe(s.rules.crate.hp);
    // La caisse d'à côté, au couteau.
    advance(s, [cmd(0, 0, BTN.nextWeapon), 0]);
    settle(s);
    const before = s.itemCount;
    run(s, 10 * RATE, (i) => (i === 0 ? cmd(0, 0, BTN.fire) : 0));
    expect(s.map.tiles[16 * 32 + 6]).toBe(TILE.floor);
    expect(s.itemCount).toBe(before + 1);
    expect(s.counters[C.cratesBroken]).toBe(1);
    // La suivante, à l'arme de départ : les balles s'arrêtent sur la caisse tant qu'elle tient.
    advance(s, [cmd(0, 0, BTN.nextWeapon), 0]);
    settle(s);
    run(s, 15 * RATE, (i) => (i === 0 ? cmd(0, 0, BTN.fire) : 0));
    expect(s.map.tiles[16 * 32 + 8]).toBe(TILE.floor);
    expect(s.counters[C.cratesBroken]).toBe(2);
    expect(s.crates[16 * 32 + 8]).toBe(0);
    // L'état copié garde sa propre carte : la copie et l'original ne se mélangent pas.
    const copy = cloneState(s);
    copy.map.tiles[5] = TILE.wall;
    expect(s.map.tiles[5]).toBe(TILE.floor);
  });

  it("couteau collé à une caisse : la lame touche la première caisse sur sa trajectoire, pas au-delà d'un mur", () => {
    const map = openMap();
    map.tiles[16 * 32 + 8] = TILE.crate;
    map.tiles[20 * 32 + 8] = TILE.wall;
    map.tiles[20 * 32 + 9] = TILE.crate;
    const s = match({ map, spawns: [8 * TS - 300, tile(16), 8 * TS - 300, tile(20)] });
    run(s, 1, () => cmd(0, 0, BTN.nextWeapon));
    settle(s);
    run(s, 1, () => cmd(0, 0, BTN.fire));
    expect(s.crates[16 * 32 + 8]).toBeLessThan(s.rules.crate.hp);
    expect(s.crates[20 * 32 + 9]).toBe(s.rules.crate.hp);
  });

  it("lunette ×2 puis ×4 : champ de vision agrandi (jamais réduit) ; boisson énergisante : +20 % de vitesse pendant 15 s", () => {
    const far = tile(5) + idiv(3 * BASE.view.halfWidth, 2);
    const at = { x: tile(5), y: tile(16) };
    const loot: LootItem[] = [
      { kind: ITEM.scope, sub: 2, qty: 1, ...at },
      { kind: ITEM.speed, sub: 0, qty: 1, x: at.x, y: at.y + 200 },
    ];
    const s = match({ loot, map: openMap(200), spawns: [at.x, at.y, far, at.y] });
    expect(canSee(s, 0, 1)).toBe(false);
    advance(s, [cmd(0, 0, BTN.pickup), 0]);
    advance(s, [0, 0]);
    expect(s.p.scope[0]).toBe(2);
    expect(canSee(s, 0, 1)).toBe(true);
    // Une lunette moins forte que la sienne reste au sol.
    s.p.scope[0] = 4;
    s.it.kind[0] = ITEM.scope;
    s.it.sub[0] = 2;
    advance(s, [cmd(0, 0, BTN.pickup), 0]);
    advance(s, [0, 0]);
    expect(s.p.scope[0]).toBe(4);
    expect(s.p.boostLeft[0]).toBeGreaterThan(s.rules.crate.boostTicks - 4);
    const x0 = s.p.x[0];
    advance(s, [cmd(1, 0), 0]);
    expect(s.p.x[0] - x0).toBe(idiv(idiv(300 * SUB, RATE) * (1000 + s.rules.crate.boostPermille), 1000));
    run(s, s.rules.crate.boostTicks, () => 0);
    expect(s.p.boostLeft[0]).toBe(0);
  });
});

describe("moteur : fonction pure", () => {
  it("step ne modifie pas l'état reçu, et donne le même résultat que advance", () => {
    const a = match({ seed: 9 });
    const b = cloneState(a);
    const before = stateHash(a);
    const commands = (t: number) => [cmd(1 + (t % 16), t % 256, t % 3 === 0 ? BTN.fire : 0), cmd(16 - (t % 16), (3 * t) % 256, BTN.fire)];
    let pure = a;
    for (let t = 0; t < 200; t++) pure = step(pure, commands(t));
    expect(stateHash(a)).toBe(before);
    for (let t = 0; t < 200; t++) advance(b, commands(t));
    expect(stateHash(pure)).toBe(stateHash(b));
    expect(Math.abs(angleDiff(b.p.aim[0], 0))).toBeLessThanOrEqual(128);
  });
});
