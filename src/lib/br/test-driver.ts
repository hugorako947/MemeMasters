/**
 * Pilote de test : produit, à partir de l'état, des commandes plausibles pour les emplacements
 * pilotés par des commandes (rejoindre la zone, ramasser du butin, viser et tirer sur l'ennemi
 * le plus proche, se soigner, utiliser sa capacité). Il joue le rôle du joueur humain dans les
 * tests de déterminisme, de rejeu et de performance ; ce n'est PAS l'IA des bots (bot.ts), qui
 * fait partie du moteur. Il n'est importé par aucun code de production.
 *
 * Il ne lit que l'état et son propre générateur : ses commandes sont des entrées comme
 * celles d'un joueur, enregistrées puis rejouées par les tests.
 */
import { GAME_CONFIG } from "@/config/game.config";
import { STARTER_SET } from "@/content/cards/starter-set";
import { battleCharacter, type BattleCharacter, type BrConfig, type EvolutionLevel } from "./character";
import { BTN, packCommand } from "./commands";
import { advance, createMatch, weaponInHand, type MatchSetup } from "./engine";
import { iatan2 } from "./fixed";
import { ITEM } from "./map";
import { createStreams, nextBelow } from "./rng";
import { resolveRules, type Rules } from "./rules";
import { Z, type MatchState } from "./state";

/** Personnages tirés du jeu de départ, avec des niveaux d'évolution variés (déterministe). */
export function sampleCharacters(count: number, seed: number, br: BrConfig = GAME_CONFIG.BATTLE_ROYALE): BattleCharacter[] {
  const rng = createStreams(seed, 1);
  return Array.from({ length: count }, () => {
    const card = STARTER_SET[nextBelow(rng, 0, STARTER_SET.length)];
    return battleCharacter(card, nextBelow(rng, 0, 4) as EvolutionLevel, br, GAME_CONFIG.DUPLICATES.STAT_BONUS_PERCENT);
  });
}

/**
 * Partie « classée » de test : `humans` emplacements pilotés par des commandes (les premiers),
 * les autres joués par des bots de niveaux variés (déterministe).
 */
export function botSetup(seed: number, rules: Rules, count: number, humans = 1): MatchSetup {
  const rng = createStreams(seed ^ 0x5bd1e995, 1);
  const botLevels = Array.from({ length: count }, (_, i) => (i < humans ? null : nextBelow(rng, 0, rules.bots.maxLevel + 1)));
  return { seed, rules, characters: sampleCharacters(count, seed), botLevels };
}

/** Petites parties rapides (16 participants, carte de 40 tuiles, zone en 28 s) pour les tests en nombre. */
export function smallRules(): Rules {
  const br = GAME_CONFIG.BATTLE_ROYALE;
  return resolveRules({
    ...br,
    PARTICIPANTS: 16,
    MAX_DURATION_S: 90,
    MAP: { ...br.MAP, TILES: 40, BUILDINGS: [3, 5], BUILDING_SIZE_TILES: [5, 8], LAKES: [0, 1], LAKE_RADIUS_TILES: [2, 3], CRATES: 15, BUSH_CLUSTERS: 4, BUSH_CLUSTER_SIZE: [2, 5] },
    ZONE: {
      PHASES: [
        { waitS: 4, shrinkS: 8, radiusPercent: 50, dps: 5 },
        { waitS: 3, shrinkS: 6, radiusPercent: 40, dps: 10 },
        { waitS: 2, shrinkS: 5, radiusPercent: 0, dps: 25 },
      ],
    },
  });
}

/**
 * Joue une partie : le pilote commande les emplacements sans bot, le moteur joue les bots.
 * Renvoie l'état final et les commandes enregistrées des seuls emplacements pilotés (ce que
 * le serveur recevra) ; `onTick` est appelé après chaque tick (invariants, mesure du temps…).
 */
export function playWithDriver(setup: MatchSetup, driverSeed: number, options: { maxTicks?: number; onTick?: (s: MatchState) => void; timer?: () => number; times?: number[] } = {}) {
  const state = createMatch(setup);
  const limit = options.maxTicks ?? state.rules.maxTicks;
  const driver = createDriver(driverSeed, state.n);
  const driven = Array.from({ length: state.n }, (_, i) => i).filter((i) => state.b.level[i] < 0);
  const streams = driven.map(() => new Uint32Array(limit));
  const commands = new Uint32Array(state.n);
  while (!state.finished && state.tick < limit) {
    const t = state.tick;
    driverCommands(state, driver, commands);
    driven.forEach((slot, k) => (streams[k][t] = commands[slot]));
    const t0 = options.timer?.();
    advance(state, commands);
    if (options.timer && options.times) options.times.push(options.timer() - (t0 ?? 0));
    options.onTick?.(state);
  }
  const inputs = new Map(driven.map((slot, k) => [slot, streams[k].subarray(0, state.tick)] as const));
  return { state, inputs };
}

export interface Driver {
  rng: Uint32Array;
  wander: Int32Array;
  goal: Int32Array;
}

export function createDriver(seed: number, participants: number): Driver {
  return { rng: createStreams(seed, 1), wander: new Int32Array(participants), goal: new Int32Array(participants).fill(-1) };
}

/** Direction de déplacement (1…16) la plus proche d'un angle. */
const toDirection = (angle: number) => ((((angle + 8) & 255) >> 4) % 16) + 1;

/** Remplit `out` avec une commande par participant pour le prochain tick. */
export function driverCommands(s: MatchState, d: Driver, out: Uint32Array): void {
  const P = s.p;
  const zx = s.zone[Z.tx];
  const zy = s.zone[Z.ty];
  const zr = s.zone[Z.r];
  for (let i = 0; i < s.n; i++) {
    out[i] = 0;
    // Les bots jouent eux-mêmes (le moteur remplace leurs commandes).
    if (!P.alive[i] || s.b.level[i] >= 0) continue;
    const W = s.rules.weapons[weaponInHand(s, i)];
    // Ennemi le plus proche.
    let enemy = -1;
    let enemyD = Infinity;
    for (let j = 0; j < s.n; j++) {
      if (j === i || !P.alive[j]) continue;
      const dd = (P.x[j] - P.x[i]) ** 2 + (P.y[j] - P.y[i]) ** 2;
      if (dd < enemyD) {
        enemyD = dd;
        enemy = j;
      }
    }
    const inRange = enemy >= 0 && enemyD <= W.range * W.range;
    // Butin visé, réévalué de temps en temps (pas à chaque tick : coûteux).
    if ((s.tick + i) % 20 === 0) {
      let best = -1;
      let bestD = (8 * s.map.tileSub) ** 2;
      for (let k = 0; k < s.itemCount; k++) {
        if (s.it.kind[k] === ITEM.none) continue;
        const dd = (s.it.x[k] - P.x[i]) ** 2 + (s.it.y[k] - P.y[i]) ** 2;
        if (dd < bestD) {
          bestD = dd;
          best = k;
        }
      }
      d.goal[i] = best;
    }
    const goal = d.goal[i];
    const zoneD = (P.x[i] - zx) ** 2 + (P.y[i] - zy) ** 2;
    let move: number;
    if (zoneD > ((zr * 3) >> 2) ** 2) move = toDirection(iatan2(zy - P.y[i], zx - P.x[i]));
    else if (inRange) move = toDirection(iatan2(P.y[enemy] - P.y[i], P.x[enemy] - P.x[i]) + (nextBelow(d.rng, 0, 2) ? 64 : 192));
    else if (goal >= 0 && s.it.kind[goal] !== ITEM.none) move = toDirection(iatan2(s.it.y[goal] - P.y[i], s.it.x[goal] - P.x[i]));
    else {
      if (d.wander[i] === 0 || nextBelow(d.rng, 0, 40) === 0) d.wander[i] = 1 + nextBelow(d.rng, 0, 16);
      move = d.wander[i];
    }
    const aim = enemy >= 0 && enemyD <= 4 * W.range * W.range ? iatan2(P.y[enemy] - P.y[i], P.x[enemy] - P.x[i]) : (move - 1) * 16;
    let buttons = 0;
    if (inRange) buttons |= BTN.fire;
    if (inRange && P.abilityCd[i] === 0 && (s.tick + i) % 15 === 0) buttons |= BTN.ability;
    if ((s.tick + i) % 25 === 0) buttons |= BTN.pickup;
    if (P.active[i] === 0 && P.weapon1[i] >= 0 && (s.tick + i) % 30 === 0) buttons |= BTN.nextWeapon;
    out[i] = packCommand({ move, aim, buttons });
  }
}
