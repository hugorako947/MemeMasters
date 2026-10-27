/**
 * Une partie du banc d'essai des bots (npm run bots:tournament) : rules.participants bots (50), sans joueur ni affichage.
 * Mesure ce que demande la conception (§7.7) : durée, éliminations par la zone, bots immobiles ou
 * coincés, place de chaque personnage. Hors du moteur : ce module observe la partie sans jamais la modifier.
 *
 * Trois séries :
 * - « standard » : cartes du jeu de départ et niveaux d'évolution tirés au hasard ;
 * - « rarity » : une moitié de godlevel (premiers emplacements) contre une moitié de communes, sans évolution ;
 * - « evolution » : une moitié de cartes Divines (premiers emplacements) contre les mêmes cartes sans évolution.
 * Tous les bots d'une partie ont le même niveau (tiré au hasard pour chaque partie), à leur variation personnelle près.
 */
import { GAME_CONFIG } from "@/config/game.config";
import { STARTER_SET } from "@/content/cards/starter-set";
import { ACTION } from "@/lib/br/bot";
import { battleCharacter, type EvolutionLevel } from "@/lib/br/character";
import { MAX_LEVEL } from "@/lib/economy/duplicates";
import { unpackMove } from "@/lib/br/commands";
import { advance, createMatch, type MatchSetup } from "@/lib/br/engine";
import { createStreams, nextBelow } from "@/lib/br/rng";
import { resolveRules, SUB, type Rules } from "@/lib/br/rules";
import { KILL_ZONE } from "@/lib/br/state";

export type Series = "standard" | "rarity" | "evolution";

export interface GameReport {
  series: Series;
  seed: number;
  /** Niveau des bots, en dixièmes. */
  level: number;
  minutes: number;
  kills: number;
  zoneKills: number;
  /** Par emplacement : carte (indice dans le jeu de départ), niveau d'évolution, place finale. */
  cards: number[];
  evolutions: number[];
  places: number[];
  /** Bots restés plus de 10 s sans bouger ni tirer, hors couverture et soin (comptés une fois chacun). */
  idleBots: number;
  /** Épisodes de blocage non résolus : 3 s sans avancer de 16 unités en voulant avancer. */
  stuckEpisodes: number;
  /** Détail de chaque blocage non résolu (pour rejouer la partie) : « série numéro tick bot action ». */
  stuckList: string[];
  /** Blocages d'au moins une seconde (l'anti-blocage des bots s'en charge). */
  unstickEpisodes: number;
  /** Mesure du temps (si un chronomètre est fourni) : somme et maximum, en ms, sur ticksTimed ticks. */
  tickMsSum: number;
  ticksTimed: number;
  tickMsMax: number;
}

const SERIES_SEED: Record<Series, number> = { standard: 0x1000_0000, rarity: 0x2000_0000, evolution: 0x3000_0000 };
const GODLEVEL = STARTER_SET.findIndex((c) => c.rarity === "godlevel");
const COMMUNES = STARTER_SET.flatMap((c, i) => (c.rarity === "commune" ? [i] : []));

/** Composition d'une partie (déterministe : même série et même numéro → même partie). */
export function composeGame(series: Series, index: number, rules: Rules): { seed: number; level: number; cards: number[]; evolutions: number[] } {
  const seed = (SERIES_SEED[series] + index * 7919) >>> 0;
  const rng = createStreams(seed ^ 0x9e3779b9, 1);
  const n = rules.participants;
  const half = n >> 1;
  const level = nextBelow(rng, 0, rules.bots.maxLevel + 1);
  const cards = new Array<number>(n);
  const evolutions = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (series === "standard") {
      cards[i] = nextBelow(rng, 0, STARTER_SET.length);
      evolutions[i] = nextBelow(rng, 0, MAX_LEVEL + 1);
    } else if (series === "rarity") {
      cards[i] = i < half ? GODLEVEL : COMMUNES[nextBelow(rng, 0, COMMUNES.length)];
    } else if (i < half) {
      cards[i] = nextBelow(rng, 0, STARTER_SET.length);
      evolutions[i] = MAX_LEVEL;
      if (i + half < n) cards[i + half] = cards[i];
    } else if (cards[i] === undefined) cards[i] = nextBelow(rng, 0, STARTER_SET.length);
  }
  return { seed, level, cards, evolutions };
}

/** Réglages de la partie (moteur) pour cette composition. */
export function gameSetup(series: Series, index: number, br = GAME_CONFIG.BATTLE_ROYALE): { setup: MatchSetup; level: number; cards: number[]; evolutions: number[] } {
  const rules = resolveRules(br);
  const { seed, level, cards, evolutions } = composeGame(series, index, rules);
  const characters = cards.map((c, i) => battleCharacter(STARTER_SET[c], evolutions[i] as EvolutionLevel, br, GAME_CONFIG.DUPLICATES.STAT_BONUS_PERCENT));
  return { setup: { seed, rules, characters, botLevels: cards.map(() => level) }, level, cards, evolutions };
}

const IDLE_TICKS = 10 * 20;
const STUCK_TICKS = 3 * 20;

/** Joue une partie complète et mesure ses indicateurs. `timer` (ms) : chronomètre facultatif pour le coût des ticks. */
export function playGame(series: Series, index: number, timer?: () => number): GameReport {
  const { setup, level, cards, evolutions } = gameSetup(series, index);
  const s = createMatch(setup);
  const P = s.p;
  const n = s.n;
  const idle = new Uint32Array(n);
  // Immobile : position et tick de référence (remis à zéro dès qu'il bouge de 32 unités, tire ou se couvre).
  const idleX = Int32Array.from(P.x);
  const idleY = Int32Array.from(P.y);
  const idleSince = new Int32Array(n);
  const wasIdle = new Uint8Array(n);
  // Coincé : veut avancer, mais reste à moins de 16 unités de sa position de référence.
  const stuckX = Int32Array.from(P.x);
  const stuckY = Int32Array.from(P.y);
  const stuckSince = new Int32Array(n);
  const stuckCounted = new Uint8Array(n);
  const unstickCounted = new Uint8Array(n);
  let stuckEpisodes = 0;
  const stuckList: string[] = [];
  let unstickEpisodes = 0;
  let tickMsSum = 0;
  let tickMsMax = 0;
  const idleD = 32 * SUB;
  const stuckD = 16 * SUB;
  while (!s.finished) {
    const t0 = timer?.() ?? 0;
    advance(s, idle);
    if (timer) {
      const dt = timer() - t0;
      tickMsSum += dt;
      if (dt > tickMsMax) tickMsMax = dt;
    }
    const tick = s.tick;
    for (let i = 0; i < n; i++) {
      if (!P.alive[i]) continue;
      const action = s.b.action[i];
      const busy = P.lastShot[i] === tick || action === ACTION.cover || P.stun[i] > 0;
      if (busy || (P.x[i] - idleX[i]) ** 2 + (P.y[i] - idleY[i]) ** 2 >= idleD * idleD) {
        idleX[i] = P.x[i];
        idleY[i] = P.y[i];
        idleSince[i] = tick;
      } else if (tick - idleSince[i] >= IDLE_TICKS) wasIdle[i] = 1;
      const wantsToMove = unpackMove(s.b.cmd[i]) !== 0 && P.stun[i] === 0;
      if (!wantsToMove || (P.x[i] - stuckX[i]) ** 2 + (P.y[i] - stuckY[i]) ** 2 >= stuckD * stuckD) {
        stuckX[i] = P.x[i];
        stuckY[i] = P.y[i];
        stuckSince[i] = tick;
        stuckCounted[i] = 0;
        unstickCounted[i] = 0;
      } else {
        const blocked = tick - stuckSince[i];
        if (blocked >= 20 && !unstickCounted[i]) {
          unstickCounted[i] = 1;
          unstickEpisodes++;
        }
        if (blocked >= STUCK_TICKS && !stuckCounted[i]) {
          stuckCounted[i] = 1;
          stuckEpisodes++;
          stuckList.push(`${series} ${index} tick ${tick} bot ${i} action ${s.b.action[i]}`);
        }
      }
    }
  }
  let zoneKills = 0;
  for (let e = 0; e < s.logCount; e++) if (s.log[4 * e + 3] === KILL_ZONE) zoneKills++;
  return {
    series,
    seed: setup.seed,
    level,
    minutes: s.tick / (s.rules.tickRate * 60),
    kills: s.logCount,
    zoneKills,
    cards,
    evolutions,
    places: Array.from(P.place),
    idleBots: wasIdle.reduce((a, v) => a + v, 0),
    stuckEpisodes,
    stuckList,
    unstickEpisodes,
    tickMsSum,
    ticksTimed: timer ? s.tick : 0,
    tickMsMax,
  };
}
