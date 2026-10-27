/**
 * Bots du battle royale (conception §7). Ils font partie du moteur : à chaque tick, avant les
 * commandes, chaque bot produit une commande du même format que celle d'un joueur, soumise aux
 * mêmes règles (rotation de visée plafonnée, même aide à la visée, mêmes armes). Ils ne lisent
 * que l'état de la partie et leur propre flux aléatoire (bot0 + emplacement) : le rejeu d'une
 * partie à partir des seules commandes du joueur redonne exactement les mêmes bots.
 *
 * - Perception honnête (vision.ts) : champ de vision, murs, buissons ; ouïe des tirs proches
 *   (position approximative) ; mémoire des derniers ennemis vus. Comme le joueur, ils voient la
 *   barre de vie et l'arme des ennemis visibles, le cercle de zone suivant et le fil des éliminations.
 * - Décision (4 fois par seconde, bots répartis sur les calculs) : scores de 0 à 1 000 pour
 *   ramasser (un soin compris : il est immédiat), ouvrir une caisse, combattre, fuir, se couvrir, rejoindre la zone,
 *   chasser, explorer ;
 *   un bruit à graine, plus fort aux bas niveaux, rend les choix moins bons et moins identiques.
 * - Contrôle (à chaque tick) : suivi de chemin, visée (réaction, erreur, anticipation), tir,
 *   rechargement, changement d'arme, capacité, pas de côté, anti-blocage.
 * - Difficulté : réglages interpolés selon le niveau (trophées du joueur), personnalité ±1 niveau.
 */
import { ABILITY_KINDS, BOOST_STATS, type BattleCharacter } from "./character";
import { BTN, packCommand } from "./commands";
import { angleDiff, clamp, iatan2, icos, idiv, isin, isqrt, Q14 } from "./fixed";
import { forEachNear } from "./grid";
import { circleHitsSolid, isPassable, ITEM, lineOfSight } from "./map";
import { clearPath, FAR, fieldNext, findPath, nearestVertex, vertexX, vertexY, zoneField } from "./nav";
import { chance, nextBelow, nextRange, STREAM } from "./rng";
import { BURN_SHOT, KNIFE, msToTicks, SUB, type BotRules } from "./rules";
import { BOT_MEMORY, BOT_MEMORY_FIELDS as MF, BOT_PATH, canTake, weaponInHand, Z, type MatchState } from "./state";
import { canSee, canSeePoint, inView } from "./vision";

/** Personnalités (conception §7.5). */
export const PERSONA = { cautious: 0, aggressive: 1, mobile: 2, sniper: 3 } as const;
/** Décisions possibles. */
export const ACTION = { roam: 0, zone: 1, loot: 2, fight: 3, flee: 4, cover: 5, hunt: 6, crate: 7 } as const;
const ACTIONS = 8;

/**
 * Valeur d'une caisse à ouvrir (avant la distance, comme un objet) : fort quand on n'a que le couteau, plus faible quand
 * on est déjà armé. Une caisse à portée vaut alors un peu plus qu'explorer (350 / 150) ; à une demi-largeur d'écran, nettement moins.
 */
const CRATE_VALUE_UNARMED = 450;
const CRATE_VALUE = 250;

const kindIndex = <K extends string>(list: readonly K[]) => Object.fromEntries(list.map((k, i) => [k, i])) as Record<K, number>;
const AB = kindIndex(ABILITY_KINDS);
const ST = kindIndex(BOOST_STATS);

/** Tick « jamais » (bien avant le début de la partie). */
const NEVER = -1_000_000;

/**
 * Goût du risque, le même pour toutes les personnalités (avec une petite variation par bot) : envie d'attaquer (‰),
 * seuil de PV pour se soigner ou fuir (‰ des PV max), distance de combat (‰). Les tournois de bots ont montré qu'un
 * écart ici (plus d'envie d'attaquer, combat plus rapproché…) change nettement les chances de gagner : une personnalité
 * ne change donc que la façon de jouer (arme préférée, pas de côté pour le mobile).
 */
const TRAITS = [500, 450, 1000] as const;
/** Pas de côté en plus pour la personnalité « mobile » (‰). */
const MOBILE_STRAFE = 150;

/**
 * Préférence d'arme par personnalité, sur 1 000 (indices de rules.weapons) : pistolet, fusil à pompe, mitraillette,
 * fusil de précision, puis leurs versions supérieures (3A, préférées), le projectile de brûlure (jamais choisi) et le couteau.
 */
const WEAPON_PREF = [
  [200, 600, 800, 650, 360, 720, 880, 760, 0, 120],
  [200, 800, 750, 450, 360, 880, 840, 560, 0, 140],
  [200, 700, 800, 500, 360, 800, 880, 620, 0, 130],
  [200, 500, 650, 850, 360, 620, 740, 920, 0, 110],
] as const;

/** Distance de combat voulue selon l'arme en main, en unités : [au moins, au plus] (mêmes indices que WEAPON_PREF). */
const WEAPON_BAND = [
  [200, 420],
  [50, 170],
  [140, 360],
  [260, 440],
  [220, 460],
  [60, 200],
  [160, 400],
  [300, 500],
  [200, 420],
  [0, 30],
] as const;

/** Marge (en unités) au-delà de la portée du couteau avant de reprendre une arme à feu. */
const KNIFE_KEEP = 40;

/** Niveau des bots (en dixièmes) pour un joueur qui a ce nombre de trophées. */
export function botLevelForTrophies(trophies: number, rules: { bots: BotRules }): number {
  return clamp(idiv(trophies * 10, rules.bots.trophiesPerLevel), 0, rules.bots.maxLevel);
}

const lerp = (pair: readonly [number, number], level: number, max: number) => pair[0] + idiv((pair[1] - pair[0]) * level, max);

/**
 * Personnalité tirée du personnage (par rapport à la commune moyenne) : prudent (PV hauts, régénération),
 * agressif (ATQ haute), mobile (VIT haute), tireur de loin (perce-armure ou affaiblissement).
 */
export function basePersona(c: BattleCharacter, reference: BotRules["reference"]): number {
  const scores = [
    (c.stats.hp - reference.hp) * 2 + (c.passive.kind === "regen" ? 12 : 0),
    (c.stats.atk - reference.atk) * 3,
    c.stats.spd - reference.spd,
    c.ability.kind === "pierce" || c.ability.kind === "debuff" ? 20 : -1000,
  ];
  let best = 0;
  for (let k = 1; k < scores.length; k++) if (scores[k] > scores[best]) best = k;
  return best;
}

/** Prépare les bots à la création de la partie. `levels[i]` : niveau en dixièmes, null pour un emplacement de joueur. */
export function initBots(s: MatchState, characters: readonly BattleCharacter[], levels: readonly (number | null)[]): void {
  const R = s.rules.bots;
  const B = s.b;
  for (let i = 0; i < s.n; i++) {
    const asked = levels[i];
    if (asked === null || asked === undefined) continue;
    const st = STREAM.bot0 + i;
    let persona = basePersona(characters[i], R.reference);
    // Une part de hasard : deux bots du même personnage ne jouent pas toujours pareil.
    if (chance(s.rng, st, 250)) persona = nextBelow(s.rng, st, 4);
    const level = clamp(clamp(asked, 0, R.maxLevel) + nextRange(s.rng, st, -R.levelSpread, R.levelSpread), 0, R.maxLevel);
    const [aggro, caution, rangeMod] = TRAITS;
    B.level[i] = level;
    B.persona[i] = persona;
    B.aggro[i] = aggro + nextRange(s.rng, st, -60, 60);
    B.caution[i] = caution + nextRange(s.rng, st, -40, 40);
    B.rangeMod[i] = rangeMod + nextRange(s.rng, st, -50, 50);
    B.react[i] = msToTicks(lerp(R.reactionMs, level, R.maxLevel), s.rules.tickRate);
    B.aimErr[i] = lerp(R.aimError, level, R.maxLevel);
    B.lead[i] = lerp(R.leadPermille, level, R.maxLevel);
    B.noise[i] = lerp(R.noise, level, R.maxLevel);
    B.strafe[i] = Math.min(1000, lerp(R.strafePermille, level, R.maxLevel) + (persona === PERSONA.mobile ? MOBILE_STRAFE : 0));
    B.action[i] = ACTION.roam;
    B.target[i] = -1;
    B.item[i] = -1;
    B.building[i] = -1;
    B.crate[i] = -1;
    B.goalX[i] = B.anchorX[i] = s.p.x[i];
    B.goalY[i] = B.anchorY[i] = s.p.y[i];
    B.seenTick[i] = B.visTick[i] = B.heardTick[i] = B.threatTick[i] = NEVER;
  }
}

/** Commandes des bots pour le tick en cours (écrites dans `commands` aux emplacements des bots). */
export function runBots(s: MatchState, commands: Uint32Array): void {
  servePaths(s);
  const think = s.rules.bots.thinkTicks;
  for (let i = 0; i < s.n; i++) {
    if (s.b.level[i] < 0 || !s.p.alive[i]) continue;
    if ((s.tick + i) % think === 0) decide(s, i);
    const c = control(s, i);
    commands[i] = c;
    s.b.cmd[i] = c;
  }
}

// ---------------------------------------------------------------- petits calculs

const sq = (dx: number, dy: number) => dx * dx + dy * dy;
/** Direction de déplacement (1…16) la plus proche d'un angle. */
const toDirection = (angle: number) => (((angle + 8) & 255) >> 4) + 1;
const directionAngle = (move: number) => (move - 1) * 16;

/** L'arme à feu de l'emplacement `slot` (0 ou 1) a-t-elle de quoi tirer (chargeur ou réserve de munitions) ? */
function gunUsable(s: MatchState, i: number, slot: number): boolean {
  const w = slot === 0 ? s.p.weapon0[i] : s.p.weapon1[i];
  if (w < 0) return false;
  const mag = slot === 0 ? s.p.mag0[i] : s.p.mag1[i];
  return mag > 0 || s.rules.weapons[w].ammo === 0 || s.p.ammo[i] > 0;
}

/**
 * Meilleur emplacement d'arme à feu utilisable (0 ou 1) pour une distance `d` (−1 : sans cible, choix par préférence) ;
 * −1 si aucune arme à feu n'est utilisable (il ne reste que le couteau).
 */
function bestGunSlot(s: MatchState, i: number, d: number): number {
  const pref = WEAPON_PREF[s.b.persona[i]];
  let best = -1;
  let bestSc = 0;
  for (let slot = 0; slot < 2; slot++) {
    if (!gunUsable(s, i, slot)) continue;
    const w = slot === 0 ? s.p.weapon0[i] : s.p.weapon1[i];
    const W = s.rules.weapons[w];
    let sc = pref[w] + 1;
    if (d >= 0) sc += W.range >= d ? 300 : -idiv((d - W.range) * 300, Math.max(1, W.range));
    if (best < 0 || sc > bestSc) {
      best = slot;
      bestSc = sc;
    }
  }
  return best;
}

/** Arme à feu utilisable (indice), ou le couteau (KNIFE) s'il n'en reste aucune ; `d` : distance de la cible (−1 : sans cible). */
function usableWeapon(s: MatchState, i: number, d = -1): number {
  const slot = bestGunSlot(s, i, d);
  return slot < 0 ? KNIFE : slot === 0 ? s.p.weapon0[i] : s.p.weapon1[i];
}

/** Distance entre les centres à laquelle un coup de couteau de i atteint t. */
function knifeReach(s: MatchState, i: number, t: number): number {
  return s.rules.weapons[KNIFE].range + s.fighters[i].radius + s.fighters[t].radius;
}

/** Le couteau frappe-t-il plus fort que cette arme au contact ? (dégâts par tick, tous les plombs touchant) */
function knifeBeats(s: MatchState, w: number): boolean {
  const K = s.rules.weapons[KNIFE];
  const W = s.rules.weapons[w];
  return K.damage * W.fireTicks > W.damage * Math.max(1, W.pellets) * K.fireTicks;
}

function magazineInHand(s: MatchState, i: number): number {
  return s.p.active[i] === 1 ? s.p.mag1[i] : s.p.mag0[i];
}

function insideCircle(x: number, y: number, cx: number, cy: number, r: number): boolean {
  return r > 0 && sq(x - cx, y - cy) <= r * r;
}

/**
 * L'ennemi j menace i : il vient de le toucher, ou il tire dans sa direction, à portée (le joueur le voit aussi :
 * l'arme est dessinée à côté de la bulle, dans la direction visée, et les balles sont visibles).
 */
function hostile(s: MatchState, i: number, j: number, d: number): boolean {
  const P = s.p;
  if (P.lastHitBy[i] === j && s.tick - P.lastHit[i] <= 2 * s.rules.tickRate) return true;
  if (d > s.rules.weapons[weaponInHand(s, j)].range || s.tick - P.lastShot[j] > s.rules.tickRate) return false;
  return Math.abs(angleDiff(iatan2(P.y[i] - P.y[j], P.x[i] - P.x[j]), P.aim[j])) <= 16;
}

/** Un pas dans cette direction (1…16) avance d'au moins un demi-pas, glissement le long des obstacles compris (comme le moteur). */
function stepMoves(s: MatchState, i: number, move: number): boolean {
  const speed = s.fighters[i].speed;
  const r = s.fighters[i].radius;
  const a = directionAngle(move);
  const dx = idiv(speed * icos(a), Q14);
  const dy = idiv(speed * isin(a), Q14);
  let x = s.p.x[i];
  let y = s.p.y[i];
  if (dx !== 0 && !circleHitsSolid(s.map, x + dx, y, r)) x += dx;
  if (dy !== 0 && !circleHitsSolid(s.map, x, y + dy, r)) y += dy;
  return 2 * (Math.abs(x - s.p.x[i]) + Math.abs(y - s.p.y[i])) >= speed;
}

/** Le dernier appel à steer n'a trouvé aucune direction qui avance. */
let steerBlocked = false;

/**
 * Direction de marche vers un angle, avec évitement local : si le pas suivant n'avance pas (16 directions seulement :
 * devant une porte, la plus proche du but peut buter sur le coin du mur), on essaie les directions voisines, d'abord
 * du côté de l'angle exact, jusqu'à 90°.
 */
function steer(s: MatchState, i: number, angle: number): number {
  const move = toDirection(angle);
  steerBlocked = false;
  if (stepMoves(s, i, move)) return move;
  const side = angleDiff(angle & 255, directionAngle(move)) >= 0 ? 1 : -1;
  for (const off of [side, -side, 2 * side, -2 * side, 3 * side, -3 * side, 4 * side, -4 * side]) {
    const d = ((move - 1 + off + 32) % 16) + 1;
    if (stepMoves(s, i, d)) return d;
  }
  steerBlocked = true;
  return move;
}

/** Appui ponctuel : relâché un tick sur deux, pour que le moteur voie un nouvel appui. */
const press = (prev: number, button: number) => (prev & button ? 0 : button);

// ---------------------------------------------------------------- perception

const seen = new Int32Array(256);
let seenCount = 0;

function isSeen(j: number): boolean {
  for (let k = 0; k < seenCount; k++) if (seen[k] === j) return true;
  return false;
}

/** Note la position d'un ennemi vu (à la place du même ennemi, d'une case libre ou du plus ancien souvenir). */
function remember(s: MatchState, i: number, j: number): void {
  const M = s.bmem;
  const base = MF * BOT_MEMORY * i;
  let found = -1;
  let empty = -1;
  let oldest = -1;
  for (let k = 0; k < BOT_MEMORY; k++) {
    const e = base + MF * k;
    if (M[e] === j) {
      found = e;
      break;
    }
    if (M[e] < 0) {
      if (empty < 0) empty = e;
    } else if (oldest < 0 || M[e + 3] < M[oldest + 3]) oldest = e;
  }
  const e = found >= 0 ? found : empty >= 0 ? empty : oldest;
  M[e] = j;
  M[e + 1] = s.p.x[j];
  M[e + 2] = s.p.y[j];
  M[e + 3] = s.tick;
  M[e + 4] = s.p.hp[j] + s.p.shield[j];
}

/** Ce que le bot voit, entend et subit (à chaque décision). */
function perceive(s: MatchState, i: number): void {
  const P = s.p;
  const B = s.b;
  const R = s.rules;
  const x = P.x[i];
  const y = P.y[i];
  const st = STREAM.bot0 + i;
  // Champ de vision, agrandi par la lunette (la même règle que pour le joueur, voir vision.ts).
  const zoom = Math.max(1, P.scope[i]);
  const halfWidth = R.view.halfWidth * zoom;
  const halfHeight = R.view.halfHeight * zoom;
  seenCount = 0;
  forEachNear(x - halfWidth, y - halfHeight, x + halfWidth, y + halfHeight, (j) => {
    if (j !== i && seenCount < seen.length && canSee(s, i, j)) seen[seenCount++] = j;
  });
  for (let k = 0; k < seenCount; k++) remember(s, i, seen[k]);
  // Ouïe : le tir le plus proche depuis la dernière décision, d'un tireur qu'on ne voit pas.
  const hearing = R.bots.hearing;
  let heard = -1;
  let heardD = 0;
  forEachNear(x - hearing, y - hearing, x + hearing, y + hearing, (j) => {
    if (j === i || s.tick - P.lastShot[j] > R.bots.thinkTicks) return;
    const d = sq(P.x[j] - x, P.y[j] - y);
    if (d > hearing * hearing || isSeen(j)) return;
    if (heard < 0 || d < heardD) {
      heard = j;
      heardD = d;
    }
  });
  if (heard >= 0) {
    const spread = idiv(isqrt(heardD), 4);
    B.heardX[i] = P.x[heard] + nextRange(s.rng, st, -spread, spread);
    B.heardY[i] = P.y[heard] + nextRange(s.rng, st, -spread, spread);
    B.heardTick[i] = s.tick;
  }
  // Menace : d'où venaient les balles reçues (position exacte si le tireur est visible, approximative sinon).
  const a = P.lastHitBy[i];
  if (a >= 0 && s.tick - P.lastHit[i] <= R.bots.thinkTicks) {
    if (isSeen(a)) {
      B.threatX[i] = P.x[a];
      B.threatY[i] = P.y[a];
    } else {
      const spread = idiv(isqrt(sq(P.x[a] - x, P.y[a] - y)), 4);
      B.threatX[i] = P.x[a] + nextRange(s.rng, st, -spread, spread);
      B.threatY[i] = P.y[a] + nextRange(s.rng, st, -spread, spread);
    }
    B.threatTick[i] = s.tick;
  }
}

// ---------------------------------------------------------------- décision

const scores = new Int32Array(ACTIONS);
let itemScore = 0;
let goalX = 0;
let goalY = 0;
/** PV (gilet compris) de l'ennemi chassé, vus en dernier ; −1 pour un tir seulement entendu. */
let huntHp = -1;

function decide(s: MatchState, i: number): void {
  perceive(s, i);
  const P = s.p;
  const B = s.b;
  const st = STREAM.bot0 + i;
  const hp1000 = idiv(P.hp[i] * 1000, s.fighters[i].maxHp);
  const use = usableWeapon(s, i);
  B.aimOff[i] = nextRange(s.rng, st, -B.aimErr[i], B.aimErr[i]);

  // Ennemis visibles : meilleure cible, menaces à portée, le plus proche, et leur centre (pour fuir).
  let target = -1;
  let targetScore = -1;
  let threats = 0;
  let nearest = -1;
  let nearestD = 0;
  let sumX = 0;
  let sumY = 0;
  // Retard de PV (gilet compris) sur l'ennemi le mieux portant parmi ceux qui nous menacent : un combat qu'on perd.
  let deficit = 0;
  for (let k = 0; k < seenCount; k++) {
    const j = seen[k];
    const d = isqrt(sq(P.x[j] - P.x[i], P.y[j] - P.y[i]));
    const sc = fightScore(s, i, j, d, use, hp1000);
    if (sc > targetScore) {
      target = j;
      targetScore = sc;
    }
    if (hostile(s, i, j, d)) {
      threats++;
      deficit = Math.max(deficit, P.hp[j] + P.shield[j] - P.hp[i] - P.shield[i]);
    }
    if (nearest < 0 || d < nearestD) {
      nearest = j;
      nearestD = d;
    }
    sumX += P.x[j];
    sumY += P.y[j];
  }

  scores.fill(0);
  // Explorer (pour trouver du butin) vaut plus tant qu'on n'a que le couteau.
  scores[ACTION.roam] = use === KNIFE ? 350 : 150;
  scores[ACTION.zone] = zoneScore(s, i);
  const item = bestItem(s, i);
  // S'équiper d'abord : le butin compte davantage tant qu'on n'a que le couteau.
  if (item >= 0) scores[ACTION.loot] = (nearest >= 0 && nearestD < 300 * SUB ? idiv(itemScore, 2) : itemScore) + (use === KNIFE ? 150 : 0);
  // Ouvrir une caisse : seulement sans ennemi en vue.
  const crate = seenCount === 0 ? bestCrate(s, i, use) : -1;
  if (crate >= 0) scores[ACTION.crate] = crateScore;
  if (target >= 0) scores[ACTION.fight] = targetScore;
  if (nearest >= 0) scores[ACTION.flee] = fleeScore(s, i, hp1000, threats, nearest, nearestD, deficit);
  scores[ACTION.cover] = coverScore(s, i, hp1000, deficit);
  // Chasse : bien armé et en forme, ou pour achever un ennemi enfui nettement plus faible.
  if (seenCount === 0 && huntGoal(s, i)) {
    const weakPrey = huntHp >= 0 && 2 * huntHp < P.hp[i] + P.shield[i];
    if (weakPrey || (use !== KNIFE && hp1000 >= 700)) scores[ACTION.hunt] = 50 + idiv(B.aggro[i], 2) + (weakPrey ? 250 : 0);
  }

  // Bruit (moins bon choix aux bas niveaux) et constance (+100 pour la décision en cours).
  let best = ACTION.roam as number;
  let bestScore = NEVER;
  for (let a = 0; a < ACTIONS; a++) {
    if (scores[a] <= 0) continue;
    let sc = scores[a] + nextRange(s.rng, st, -B.noise[i], B.noise[i]);
    if (a === B.action[i]) sc += 100;
    if (sc > bestScore) {
      best = a;
      bestScore = sc;
    }
  }

  // La meilleure cible visible reste suivie quelle que soit la décision (riposte en fuyant, en ramassant…).
  if (target >= 0) setTarget(s, i, target);
  else B.target[i] = -1;
  B.action[i] = best;
  switch (best) {
    case ACTION.fight:
      setGoal(s, i, P.x[target], P.y[target]);
      if (chance(s.rng, st, B.strafe[i])) {
        B.strafeDir[i] = chance(s.rng, st, 500) ? 1 : -1;
        B.strafeUntil[i] = s.tick + nextRange(s.rng, st, 10, 30);
      } else B.strafeDir[i] = 0;
      break;
    case ACTION.loot:
      B.item[i] = item;
      setGoal(s, i, s.it.x[item], s.it.y[item]);
      break;
    case ACTION.crate:
      B.crate[i] = crate;
      setGoal(s, i, crateGX, crateGY);
      break;
    case ACTION.zone:
      B.goalX[i] = s.zone[Z.tx];
      B.goalY[i] = s.zone[Z.ty];
      B.needPath[i] = 0;
      B.pathLen[i] = 0;
      break;
    case ACTION.flee:
      // Au loin (8 tuiles) : un abri tout proche laisse le fuyard à portée de son poursuivant (tournois de bots).
      fleeGoal(s, i, idiv(sumX, seenCount), idiv(sumY, seenCount));
      setGoal(s, i, goalX, goalY);
      break;
    case ACTION.cover:
      coverGoal(s, i);
      setGoal(s, i, goalX, goalY);
      break;
    case ACTION.hunt:
      setGoal(s, i, goalX, goalY);
      break;
    default:
      exploreGoal(s, i);
      setGoal(s, i, goalX, goalY);
  }
}

/** Nouvelle cible, ou cible réapparue après plus d'une seconde : le temps de réaction repart. */
function setTarget(s: MatchState, i: number, j: number): void {
  const B = s.b;
  if (B.target[i] !== j || s.tick - B.visTick[i] > s.rules.tickRate) B.seenTick[i] = s.tick;
  B.target[i] = j;
  B.visTick[i] = s.tick;
  B.tgtX[i] = s.p.x[j];
  B.tgtY[i] = s.p.y[j];
}

/**
 * Nouveau but : on garde le chemin s'il mène presque au même endroit (moins d'une case d'écart, ou moins d'un quart de
 * la distance restante : un ennemi entendu n'a qu'une position approximative, qui change à chaque décision ; sans cela,
 * le bot recalculait sans cesse son chemin et piétinait) ; sinon ligne droite, ou chemin à calculer.
 */
function setGoal(s: MatchState, i: number, gx: number, gy: number): void {
  const B = s.b;
  const ts = s.map.tileSub;
  B.goalX[i] = gx;
  B.goalY[i] = gy;
  if (B.pathLen[i] > 0) {
    const moved = sq(B.pathGX[i] - gx, B.pathGY[i] - gy);
    if (moved <= ts * ts || 16 * moved <= sq(gx - s.p.x[i], gy - s.p.y[i])) return;
  }
  B.pathLen[i] = 0;
  const far = sq(gx - s.p.x[i], gy - s.p.y[i]) > 144 * ts * ts;
  const need = far || !clearPath(s.map, s.p.x[i], s.p.y[i], gx, gy, s.fighters[i].radius) ? 1 : 0;
  // Une demande prioritaire (bot coincé) le reste tant qu'un chemin est nécessaire.
  B.needPath[i] = need && B.needPath[i] === 2 ? 2 : need;
}

/** Envie de combattre l'ennemi visible j (0 à 1 000). */
function fightScore(s: MatchState, i: number, j: number, d: number, use: number, hp1000: number): number {
  const P = s.p;
  const B = s.b;
  const range = s.rules.weapons[use].range;
  const forced = hostile(s, i, j, d);
  let sc = B.aggro[i];
  sc += d <= range ? 150 : -idiv((d - range) * 300, range);
  // Avantage visible : barre de vie (gilet compris), arme, cible déjà occupée par un autre (« troisième homme »).
  const pref = WEAPON_PREF[B.persona[i]];
  let edge = clamp((P.hp[i] + P.shield[i] - P.hp[j] - P.shield[j]) * 2, -300, 300) + idiv(pref[use] - pref[weaponInHand(s, j)], 4);
  if (P.lastHitBy[j] >= 0 && P.lastHitBy[j] !== i && s.tick - P.lastHit[j] <= 2 * s.rules.tickRate) edge += 150;
  sc += edge;
  // Avec le seul couteau, on évite un combat qu'on n'a pas cherché (mieux vaut s'équiper d'abord),
  // sauf pour achever un ennemi nettement affaibli.
  if (use === KNIFE && !forced && edge < 150) sc -= 450;
  // Un bon joueur choisit ses combats : sans avantage net et sans y être forcé, il passe son chemin (plus le niveau est haut).
  if (!forced && edge < 100) sc -= idiv(B.level[i] * 300, s.rules.bots.maxLevel);
  if (hp1000 < B.caution[i]) sc -= 250;
  sc -= idiv(d * 150, s.rules.view.halfWidth);
  return clamp(sc, 0, 1000);
}

/** Ticks avant que la zone n'atteigne ce point (attente comprise), estimés sur 8 moments du rétrécissement. */
function zoneDeadline(s: MatchState, x: number, y: number): number {
  const Zs = s.zone;
  const phase = s.rules.zone[Math.min(Zs[Z.phase], s.rules.zone.length - 1)];
  const waitLeft = Zs[Z.stage] === 0 ? Math.max(0, phase.waitTicks - Zs[Z.t]) : 0;
  const S = phase.shrinkTicks;
  const k0 = Zs[Z.stage] === 0 ? 0 : Zs[Z.t];
  for (let step = 1; step <= 8; step++) {
    const k = k0 + idiv((S - k0) * step, 8);
    const cx = Zs[Z.fx] + idiv((Zs[Z.tx] - Zs[Z.fx]) * k, S);
    const cy = Zs[Z.fy] + idiv((Zs[Z.ty] - Zs[Z.fy]) * k, S);
    const r = Zs[Z.fr] - idiv((Zs[Z.fr] - Zs[Z.tr]) * k, S);
    if (!insideCircle(x, y, cx, cy, r)) return waitLeft + k - k0;
  }
  return waitLeft + S - k0;
}

/** Ticks de marche jusqu'au cercle suivant, par la carte des distances (chemin réel, pas la ligne droite). */
function zoneTravelTicks(s: MatchState, i: number): number {
  const Zs = s.zone;
  const nav = s.nav!;
  const field = zoneField(nav, Zs[Z.tx], Zs[Z.ty], Zs[Z.tr]);
  const v = nearestVertex(nav, s.p.x[i], s.p.y[i]);
  const distance = v >= 0 && field[v] < FAR ? idiv(field[v] * s.map.tileSub, 10) : isqrt(sq(s.p.x[i] - Zs[Z.tx], s.p.y[i] - Zs[Z.ty]));
  return idiv(distance, Math.max(1, s.fighters[i].speed));
}

/** Urgence de rejoindre la zone : hors du cercle, ou temps de marche (avec marge) proche du temps restant. */
function zoneScore(s: MatchState, i: number): number {
  const Zs = s.zone;
  const x = s.p.x[i];
  const y = s.p.y[i];
  if (Zs[Z.stage] === 2) return 0;
  if (!insideCircle(x, y, Zs[Z.cx], Zs[Z.cy], Zs[Z.r])) return 950;
  const inner = Zs[Z.tr] - s.fighters[i].radius - s.map.tileSub;
  if (insideCircle(x, y, Zs[Z.tx], Zs[Z.ty], inner)) return 0;
  const need = idiv(zoneTravelTicks(s, i) * (1200 + s.b.caution[i]), 1000) + s.rules.tickRate;
  const deadline = zoneDeadline(s, x, y);
  if (need >= deadline) return 900;
  return idiv(need * 900, Math.max(1, deadline));
}

/** Intérêt d'un objet pour ce bot (0 : inutile). */
function itemValue(s: MatchState, i: number, k: number): number {
  const P = s.p;
  const I = s.it;
  const items = s.rules.items;
  switch (I.kind[k]) {
    case ITEM.weapon: {
      // Une arme vide, sans munitions, ne sert à rien. Un emplacement libre : toujours bon à prendre ; sinon, seulement mieux armé.
      const w = I.sub[k];
      const ammo = s.rules.weapons[w].ammo;
      if (I.qty[k] === 0 && ammo > 0 && s.p.ammo[i] === 0) return 0;
      const pref = WEAPON_PREF[s.b.persona[i]];
      if (P.weapon0[i] === w || P.weapon1[i] === w) return 0;
      if (P.weapon0[i] < 0 || P.weapon1[i] < 0) return pref[w] + 100;
      const usable = usableWeapon(s, i);
      const v = pref[w] - pref[usable];
      return v > 80 ? v + 150 : 0;
    }
    case ITEM.ammo: {
      const have = s.p.ammo[i];
      const max = items.ammoMax[I.sub[k]];
      if (have >= max) return 0;
      // Des munitions valent beaucoup si on a une arme à feu, un peu sinon (on en trouvera une).
      const armed = (P.weapon0[i] >= 0 && s.rules.weapons[P.weapon0[i]].ammo > 0) || (P.weapon1[i] >= 0 && s.rules.weapons[P.weapon1[i]].ammo > 0);
      if (armed) return 150 + idiv((max - have) * 500, max);
      return 2 * have < max ? 60 : 0;
    }
    case ITEM.heal: {
      // Soin immédiat : il vaut ce qu'il rend, davantage quand les PV sont bas (rien avec tous ses PV).
      const max = s.fighters[i].maxHp;
      const useful = Math.min(max - P.hp[i], items.healHp);
      if (useful <= 0) return 0;
      return 100 + idiv(useful * 500, items.healHp) + (idiv(P.hp[i] * 1000, max) < s.b.caution[i] ? 250 : 0);
    }
    case ITEM.vest: {
      const max = items.armorShield[items.armorShield.length - 1];
      return P.shield[i] >= max ? 0 : 100 + idiv((max - P.shield[i]) * 450, max);
    }
    case ITEM.speed:
      return P.boostLeft[i] > 0 ? 80 : 260;
    case ITEM.scope:
      return I.sub[k] > P.scope[i] ? 300 : 0;
  }
  return 0;
}

/** Le moteur ramasserait bien cet objet : à portée, et le plus proche des objets utiles (à égalité, le plus ancien). */
function pickable(s: MatchState, i: number, k: number): boolean {
  const I = s.it;
  const range = s.rules.items.pickupRange;
  const d = sq(I.x[k] - s.p.x[i], I.y[k] - s.p.y[i]);
  if (d > range * range) return false;
  for (let m = 0; m < s.itemCount; m++) {
    if (m === k || I.kind[m] === ITEM.none || !canTake(s, i, m)) continue;
    const dm = sq(I.x[m] - s.p.x[i], I.y[m] - s.p.y[i]);
    if (dm < d || (dm === d && m < k)) return false;
  }
  return true;
}

/** Meilleur objet visible (ou déjà visé), valeur moins distance ; son score est rangé dans itemScore. */
function bestItem(s: MatchState, i: number): number {
  const P = s.p;
  const I = s.it;
  const hw = s.rules.view.halfWidth;
  const range = s.rules.items.pickupRange;
  let best = -1;
  itemScore = 0;
  const consider = (k: number, bonus: number, needSight: boolean) => {
    const v = itemValue(s, i, k);
    if (v <= 0) return;
    const d2 = sq(I.x[k] - P.x[i], I.y[k] - P.y[i]);
    // À portée mais un autre objet passerait avant : on le laisse (il serait impossible à prendre).
    if (d2 <= range * range && !pickable(s, i, k)) return;
    const sc = v - idiv(isqrt(d2) * 400, hw) + bonus;
    if (sc <= itemScore || (needSight && !canSeePoint(s, i, I.x[k], I.y[k]))) return;
    best = k;
    itemScore = sc;
  };
  const current = s.b.item[i];
  if (current >= 0 && current < s.itemCount && I.kind[current] !== ITEM.none) consider(current, 50, false);
  for (let k = 0; k < s.itemCount; k++) {
    if (I.kind[k] === ITEM.none || k === current || !inView(s, i, I.x[k], I.y[k])) continue;
    consider(k, 0, true);
  }
  return best;
}

let crateScore = 0;
let crateGX = 0;
let crateGY = 0;

/**
 * Caisse dans le champ de vision à ouvrir (valeur moins distance, comme un objet ; +50 pour celle déjà visée), avec
 * une case libre à côté pour la frapper : son score est rangé dans crateScore, le centre de cette case dans crateGX / crateGY.
 */
function bestCrate(s: MatchState, i: number, use: number): number {
  const P = s.p;
  const n = s.map.size;
  const ts = s.map.tileSub;
  const hw = s.rules.view.halfWidth;
  const value = use === KNIFE ? CRATE_VALUE_UNARMED : CRATE_VALUE;
  let best = -1;
  crateScore = 0;
  for (let k = 0; k < s.crateTiles.length; k++) {
    const t = s.crateTiles[k];
    if (s.crates[t] <= 0) continue;
    const cx = (t % n) * ts + (ts >> 1);
    const cy = idiv(t, n) * ts + (ts >> 1);
    if (!inView(s, i, cx, cy)) continue;
    const sc = value - idiv(isqrt(sq(cx - P.x[i], cy - P.y[i])) * 400, hw) + (t === s.b.crate[i] ? 50 : 0);
    if (sc <= crateScore) continue;
    // Case libre à côté, la plus proche du bot.
    let stand = -1;
    let standD = 0;
    for (let q = 0; q < 4; q++) {
      const x = (t % n) + (q === 0 ? 1 : q === 1 ? -1 : 0);
      const y = idiv(t, n) + (q === 2 ? 1 : q === 3 ? -1 : 0);
      if (x < 0 || y < 0 || x >= n || y >= n || !isPassable(s.map.tiles[y * n + x])) continue;
      const d = sq(x * ts + (ts >> 1) - P.x[i], y * ts + (ts >> 1) - P.y[i]);
      if (stand < 0 || d < standD) {
        stand = y * n + x;
        standD = d;
      }
    }
    if (stand < 0) continue;
    best = t;
    crateScore = sc;
    crateGX = (stand % n) * ts + (ts >> 1);
    crateGY = idiv(stand, n) * ts + (ts >> 1);
  }
  return best;
}

/** Un bon joueur rompt un combat qu'il perd (plus le niveau est haut, plus tôt) ; `deficit` : retard de PV sur la menace. */
function losingBonus(s: MatchState, i: number, deficit: number, max: number): number {
  return deficit > 0 ? idiv(s.b.level[i] * clamp(deficit * 4, 0, max), s.rules.bots.maxLevel) : 0;
}

function fleeScore(s: MatchState, i: number, hp1000: number, threats: number, nearest: number, nearestD: number, deficit: number): number {
  const B = s.b;
  let sc = losingBonus(s, i, deficit, 600);
  if (hp1000 < B.caution[i]) sc += 200 + idiv((B.caution[i] - hp1000) * 1500, 1000);
  if (threats >= 2) sc += 150 * (threats - 1);
  const theirs = weaponInHand(s, nearest);
  if (usableWeapon(s, i) === KNIFE && theirs !== KNIFE && nearestD <= s.rules.weapons[theirs].range) sc += 150;
  sc -= idiv(B.aggro[i] - 500, 2);
  return clamp(sc, 0, 1000);
}

function coverScore(s: MatchState, i: number, hp1000: number, deficit: number): number {
  if (s.tick - s.b.threatTick[i] > 30) return 0;
  let sc = 300 + losingBonus(s, i, deficit, 400);
  const a = s.p.lastHitBy[i];
  if (a < 0 || !isSeen(a)) sc += 250;
  if (hp1000 < 600) sc += 150;
  return sc;
}

/** Dernier ennemi disparu de la vue ou dernier tir entendu (le plus récent, s'il date de moins que la mémoire). */
function huntGoal(s: MatchState, i: number): boolean {
  const M = s.bmem;
  const B = s.b;
  const limit = s.tick - s.rules.bots.memoryTicks;
  let when = limit;
  huntHp = -1;
  for (let k = 0; k < BOT_MEMORY; k++) {
    const e = MF * BOT_MEMORY * i + MF * k;
    if (M[e] < 0) continue;
    if (M[e + 3] < limit || !s.p.alive[M[e]]) {
      M[e] = -1;
      continue;
    }
    if (M[e + 3] > when) {
      when = M[e + 3];
      goalX = M[e + 1];
      goalY = M[e + 2];
      huntHp = M[e + 4];
    }
  }
  if (B.heardTick[i] > when) {
    when = B.heardTick[i];
    goalX = B.heardX[i];
    goalY = B.heardY[i];
    huntHp = -1;
  }
  return when > limit;
}

/** Point de repli : à l'opposé des ennemis visibles, praticable et dans la zone (sinon, vers le centre de la zone suivante). */
function fleeGoal(s: MatchState, i: number, fromX: number, fromY: number): void {
  const P = s.p;
  const Zs = s.zone;
  const nav = s.nav!;
  const away = iatan2(P.y[i] - fromY, P.x[i] - fromX);
  const len = 8 * s.map.tileSub;
  for (const offset of [0, 24, -24, 48, -48, 80, -80]) {
    const x = P.x[i] + idiv(len * icos(away + offset), Q14);
    const y = P.y[i] + idiv(len * isin(away + offset), Q14);
    if (nearestVertex(nav, x, y) >= 0 && insideCircle(x, y, Zs[Z.cx], Zs[Z.cy], Zs[Z.r])) {
      goalX = x;
      goalY = y;
      return;
    }
  }
  goalX = Zs[Z.tx];
  goalY = Zs[Z.ty];
}

/**
 * Couverture face à une menace en (tx, ty) : le point praticable le plus proche (16 directions, 2 à 6 tuiles) d'où
 * l'on ne la voit plus. Renvoie faux s'il n'y en a pas (le but n'est alors pas modifié).
 */
function findCover(s: MatchState, i: number, tx: number, ty: number): boolean {
  const P = s.p;
  const B = s.b;
  const Zs = s.zone;
  const nav = s.nav!;
  // La couverture visée protège encore : on y reste.
  if (B.action[i] === ACTION.cover && !lineOfSight(s.map, tx, ty, B.goalX[i], B.goalY[i])) {
    goalX = B.goalX[i];
    goalY = B.goalY[i];
    return true;
  }
  let best = -1;
  let bestD = 0;
  for (let dist = 2; dist <= 6; dist += 2) {
    for (let dir = 0; dir < 16; dir++) {
      const x = P.x[i] + idiv(dist * s.map.tileSub * icos(dir * 16), Q14);
      const y = P.y[i] + idiv(dist * s.map.tileSub * isin(dir * 16), Q14);
      const v = nearestVertex(nav, x, y);
      if (v < 0) continue;
      const vx = vertexX(nav, v);
      const vy = vertexY(nav, v);
      if (!insideCircle(vx, vy, Zs[Z.cx], Zs[Z.cy], Zs[Z.r]) || lineOfSight(s.map, tx, ty, vx, vy)) continue;
      const d = sq(vx - P.x[i], vy - P.y[i]);
      if (best < 0 || d < bestD) {
        best = v;
        bestD = d;
      }
    }
    if (best >= 0) break;
  }
  if (best < 0) return false;
  goalX = vertexX(nav, best);
  goalY = vertexY(nav, best);
  return true;
}

/** Se mettre à couvert de la dernière menace (sinon, s'éloigner d'elle). */
function coverGoal(s: MatchState, i: number): void {
  const B = s.b;
  if (!findCover(s, i, B.threatX[i], B.threatY[i])) fleeGoal(s, i, B.threatX[i], B.threatY[i]);
}

/**
 * Exploration : un bâtiment proche (pour son butin) dans la zone suivante, choisi parmi les plus proches avec un peu
 * de hasard (chacun explore surtout autour de lui) ; sinon un point au hasard dans la zone suivante.
 */
function exploreGoal(s: MatchState, i: number): void {
  const P = s.p;
  const B = s.b;
  const Zs = s.zone;
  const ts = s.map.tileSub;
  const st = STREAM.bot0 + i;
  const nav = s.nav!;
  const bld = s.map.buildings;
  const safeR = Zs[Z.tr] - 2 * ts;
  const [cx, cy, r] = safeR > ts ? [Zs[Z.tx], Zs[Z.ty], safeR] : [Zs[Z.cx], Zs[Z.cy], Zs[Z.r] - 2 * ts];
  const centre = (b: number): [number, number] => [(2 * bld[4 * b] + bld[4 * b + 2]) * (ts >> 1), (2 * bld[4 * b + 1] + bld[4 * b + 3]) * (ts >> 1)];
  const current = B.building[i];
  if (current >= 0) {
    const [bx, by] = centre(current);
    if (sq(bx - P.x[i], by - P.y[i]) > 4 * ts * ts && insideCircle(bx, by, cx, cy, r)) {
      goalX = bx;
      goalY = by;
      return;
    }
  }
  let pick = -1;
  let pickCost = 0;
  for (let b = 0; 4 * b < bld.length; b++) {
    const [bx, by] = centre(b);
    // Un bâtiment devenu inaccessible (recoin rempli d'eau à la création de la carte) n'est pas visité.
    if (b === current || !insideCircle(bx, by, cx, cy, r) || nearestVertex(nav, bx, by, 3) < 0) continue;
    const cost = isqrt(sq(bx - P.x[i], by - P.y[i])) + nextBelow(s.rng, st, 12 * ts);
    if (pick < 0 || cost < pickCost) {
      pick = b;
      pickCost = cost;
    }
  }
  if (pick >= 0) {
    B.building[i] = pick;
    [goalX, goalY] = centre(pick);
    return;
  }
  B.building[i] = -1;
  for (let tries = 0; tries < 4; tries++) {
    const angle = nextBelow(s.rng, st, 256);
    const d = nextBelow(s.rng, st, Math.max(1, r));
    goalX = cx + idiv(d * icos(angle), Q14);
    goalY = cy + idiv(d * isin(angle), Q14);
    if (nearestVertex(nav, goalX, goalY) >= 0) return;
  }
  goalX = Zs[Z.tx];
  goalY = Zs[Z.ty];
}

// ---------------------------------------------------------------- chemins (budget partagé)

/** Chemins calculés en priorité par tick pour les bots coincés (en plus du budget normal). */
const URGENT_PATHS = 2;

/**
 * Calcule au plus pathsPerTick chemins demandés, chacun son tour (tourniquet sur les emplacements). Les bots coincés
 * (demande urgente, needPath = 2) passent avant, avec un budget à part de URGENT_PATHS par tick.
 */
function servePaths(s: MatchState): void {
  let urgent = URGENT_PATHS;
  for (let i = 0; i < s.n && urgent > 0; i++) {
    if (s.b.needPath[i] !== 2 || s.b.level[i] < 0 || !s.p.alive[i]) continue;
    computePath(s, i);
    urgent--;
  }
  let budget = s.rules.bots.pathsPerTick;
  const n = s.n;
  const start = s.bmisc[0];
  for (let k = 0; k < n && budget > 0; k++) {
    const i = start + k < n ? start + k : start + k - n;
    if (s.b.level[i] < 0 || !s.p.alive[i] || !s.b.needPath[i]) continue;
    computePath(s, i);
    budget--;
    s.bmisc[0] = i + 1 < n ? i + 1 : 0;
  }
}

function computePath(s: MatchState, i: number): void {
  const B = s.b;
  const nav = s.nav!;
  B.needPath[i] = 0;
  B.pathIdx[i] = 0;
  B.pathGX[i] = B.goalX[i];
  B.pathGY[i] = B.goalY[i];
  const start = nearestVertex(nav, s.p.x[i], s.p.y[i]);
  // But dans l'eau ou un mur (bruit entendu, position approximative…) : le point praticable le plus proche.
  const goal = nearestVertex(nav, B.goalX[i], B.goalY[i], 8);
  if (goal < 0) {
    // Inaccessible : on abandonne ce but (la prochaine décision en choisira un autre).
    B.goalX[i] = s.p.x[i];
    B.goalY[i] = s.p.y[i];
    B.building[i] = -1;
    B.pathLen[i] = 0;
    return;
  }
  B.pathLen[i] = findPath(nav, start, goal, s.rules.bots.pathMaxNodes, s.bpath, i * BOT_PATH, BOT_PATH);
}

// ---------------------------------------------------------------- contrôle (chaque tick)

function control(s: MatchState, i: number): number {
  const P = s.p;
  const B = s.b;
  const R = s.rules;
  const tick = s.tick;
  const prev = P.prevButtons[i];
  const action = B.action[i];
  const W = R.weapons[weaponInHand(s, i)];
  let move = 0;
  let buttons = 0;
  let aim = P.aim[i];
  /** Direction de la caisse à frapper (−1 : aucune). */
  let crateAim = -1;

  // La cible est-elle visible à ce tick ? Sa vitesse se lit sur deux ticks de suite.
  const t = B.target[i];
  const visible = t >= 0 && canSee(s, i, t);
  let d = 0;
  let vx = 0;
  let vy = 0;
  if (visible) {
    if (tick - B.visTick[i] > R.tickRate) B.seenTick[i] = tick;
    if (B.visTick[i] === tick - 1) {
      vx = P.x[t] - B.tgtX[i];
      vy = P.y[t] - B.tgtY[i];
    }
    B.visTick[i] = tick;
    B.tgtX[i] = P.x[t];
    B.tgtY[i] = P.y[t];
    d = isqrt(sq(P.x[t] - P.x[i], P.y[t] - P.y[i]));
  }

  switch (action) {
    case ACTION.fight:
      move = visible ? combatMove(s, i, t, d) : moveTo(s, i, B.tgtX[i], B.tgtY[i]);
      break;
    case ACTION.loot: {
      const k = B.item[i];
      if (k >= 0 && s.it.kind[k] !== ITEM.none) {
        move = moveTo(s, i, s.it.x[k], s.it.y[k]);
        if (pickable(s, i, k)) buttons |= press(prev, BTN.pickup);
      }
      break;
    }
    case ACTION.zone:
      move = moveZone(s, i);
      break;
    case ACTION.crate: {
      // À une case et demie au plus : on s'arrête et on frappe la caisse ; sinon on va à la case libre d'à côté.
      const c = B.crate[i];
      if (c < 0 || s.crates[c] <= 0) break;
      const ts = s.map.tileSub;
      const cx = (c % s.map.size) * ts + (ts >> 1);
      const cy = idiv(c, s.map.size) * ts + (ts >> 1);
      if (4 * sq(cx - P.x[i], cy - P.y[i]) <= 9 * ts * ts) crateAim = iatan2(cy - P.y[i], cx - P.x[i]);
      else move = moveTo(s, i, B.goalX[i], B.goalY[i]);
      break;
    }
    default:
      move = moveTo(s, i, B.goalX[i], B.goalY[i]);
  }
  move = antiStuck(s, i, move);

  // Hors combat (ramasser, explorer, rejoindre la zone…), on ne vise (ni ne tire, ni n'utilise sa capacité) que pour
  // riposter ou contre un ennemi tout proche : sinon chacun ouvrirait le feu sur tout ce qu'il voit.
  const willing = visible && (action === ACTION.fight || action === ACTION.flee || action === ACTION.cover || d <= 80 * SUB || hostile(s, i, t, d));
  // Visée : la cible (anticipée, avec l'erreur du bot), sinon la menace, le bruit entendu ou la marche.
  let ready = false;
  let aligned = false;
  if (willing) {
    const flight = W.speed > 0 ? idiv(d, W.speed) : 0;
    const px = P.x[t] + idiv(vx * flight * B.lead[i], 1000);
    const py = P.y[t] + idiv(vy * flight * B.lead[i], 1000);
    aim = (iatan2(py - P.y[i], px - P.x[i]) + B.aimOff[i]) & 255;
    ready = tick >= B.seenTick[i] + B.react[i];
    aligned = Math.abs(angleDiff(aim, P.aim[i])) <= R.aimTurn;
    if (ready && aligned && d <= (weaponInHand(s, i) === KNIFE ? knifeReach(s, i, t) : W.range)) buttons |= BTN.fire;
  } else if (crateAim >= 0) {
    // Caisse : au couteau s'il frappe plus fort que l'arme à feu, dès que la visée est alignée et l'arme prête.
    aim = crateAim;
    if (Math.abs(angleDiff(aim, P.aim[i])) <= R.aimTurn) buttons |= BTN.fire;
  } else if (tick - B.threatTick[i] <= R.tickRate) aim = iatan2(B.threatY[i] - P.y[i], B.threatX[i] - P.x[i]);
  else if (tick - B.heardTick[i] <= R.tickRate) aim = iatan2(B.heardY[i] - P.y[i], B.heardX[i] - P.x[i]);
  else if (move !== 0) aim = directionAngle(move);

  // Arme : le couteau au contact s'il frappe plus fort, sinon la meilleure arme à feu pour la distance.
  const gun = wantedSlot(s, i, visible ? d : -1, t);
  let want = gun;
  if (crateAim >= 0 && !willing) {
    const gs = bestGunSlot(s, i, -1);
    const gunW = gs < 0 ? R.startWeapon : gs === 0 ? P.weapon0[i] : P.weapon1[i];
    want = gs < 0 || knifeBeats(s, gunW) ? 2 : gs;
  }
  if (want !== P.active[i] && P.reload[i] === 0) buttons |= press(prev, BTN.nextWeapon);
  // Rechargement hors de vue d'un ennemi, chargeur à moins de moitié.
  else if (!visible && P.reload[i] === 0 && 2 * magazineInHand(s, i) < W.magazine && (W.ammo === 0 || s.p.ammo[i] > 0)) {
    buttons |= press(prev, BTN.reload);
  }

  if (P.abilityCd[i] === 0 && wantsAbility(s, i, action, willing, d, ready, aligned)) buttons |= press(prev, BTN.ability);

  return packCommand({ move, aim: aim & 255, buttons });
}

/** Au combat : se rapprocher, reculer, ou faire des pas de côté à la bonne distance. */
function combatMove(s: MatchState, i: number, t: number, d: number): number {
  const P = s.p;
  const B = s.b;
  const band = WEAPON_BAND[weaponInHand(s, i)];
  const lo = idiv(band[0] * SUB * B.rangeMod[i], 1000);
  const hi = idiv(band[1] * SUB * B.rangeMod[i], 1000);
  const toward = iatan2(P.y[t] - P.y[i], P.x[t] - P.x[i]);
  if (d > hi) return moveTo(s, i, P.x[t], P.y[t]);
  if (B.strafeDir[i] !== 0 && s.tick >= B.strafeUntil[i]) {
    B.strafeDir[i] = -B.strafeDir[i];
    B.strafeUntil[i] = s.tick + nextRange(s.rng, STREAM.bot0 + i, 10, 30);
  }
  // Trop près : on recule, sauf juste après un blocage (dos au mur) : on reste alors sur place ou de côté pendant 2 s.
  if (d < lo && s.tick >= B.unstickUntil[i] + 2 * s.rules.tickRate) return steer(s, i, toward + 128 + 24 * B.strafeDir[i]);
  return B.strafeDir[i] !== 0 ? steer(s, i, toward + 64 * B.strafeDir[i]) : 0;
}

/** Vers un point : en suivant le chemin calculé s'il y en a un, sinon tout droit (le moteur fait glisser le long des murs). */
function moveTo(s: MatchState, i: number, gx: number, gy: number): number {
  const P = s.p;
  const B = s.b;
  const x = P.x[i];
  const y = P.y[i];
  const step = Math.max(s.fighters[i].speed, 8 * SUB);
  if (sq(gx - x, gy - y) <= step * step) return 0;
  const len = B.pathLen[i];
  if (len > 0) {
    const nav = s.nav!;
    const base = i * BOT_PATH;
    const px = (k: number) => vertexX(nav, s.bpath[base + k]);
    const py = (k: number) => vertexY(nav, s.bpath[base + k]);
    let k = B.pathIdx[i];
    while (k < len && sq(px(k) - x, py(k) - y) <= step * step) k++;
    // Raccourci : le point suivant est-il atteignable en ligne droite ? (contrôlé un tick sur quatre)
    if (k + 1 < len && (s.tick + i) % 4 === 0 && sq(px(k + 1) - x, py(k + 1) - y) <= 100 * s.map.tileSub * s.map.tileSub && clearPath(s.map, x, y, px(k + 1), py(k + 1), s.fighters[i].radius)) k++;
    B.pathIdx[i] = k;
    if (k < len) return steer(s, i, iatan2(py(k) - y, px(k) - x));
    // Chemin terminé : s'il était partiel (but encore loin), on en redemande un.
    B.pathLen[i] = 0;
    if (sq(gx - x, gy - y) > 16 * s.map.tileSub * s.map.tileSub) B.needPath[i] = Math.max(B.needPath[i], 1);
  }
  const move = steer(s, i, iatan2(gy - y, gx - x));
  // Tout droit, rien n'avance : il faut un chemin.
  if (steerBlocked && B.pathLen[i] === 0) B.needPath[i] = Math.max(B.needPath[i], 1);
  return move;
}

/** Vers la zone suivante, en descendant la carte des distances (le point le plus avancé atteignable en ligne droite). */
function moveZone(s: MatchState, i: number): number {
  const P = s.p;
  const Zs = s.zone;
  const nav = s.nav!;
  const x = P.x[i];
  const y = P.y[i];
  const field = zoneField(nav, Zs[Z.tx], Zs[Z.ty], Zs[Z.tr]);
  const v = nearestVertex(nav, x, y);
  if (v < 0 || field[v] === 0 || field[v] >= FAR) return steer(s, i, iatan2(Zs[Z.ty] - y, Zs[Z.tx] - x));
  const first = fieldNext(nav, field, v);
  if (first < 0) return steer(s, i, iatan2(vertexY(nav, v) - y, vertexX(nav, v) - x));
  let ahead = first;
  for (let k = 0; k < 3; k++) {
    const next = fieldNext(nav, field, ahead);
    if (next < 0) break;
    ahead = next;
  }
  const r = s.fighters[i].radius;
  const goal = ahead !== first && clearPath(s.map, x, y, vertexX(nav, ahead), vertexY(nav, ahead), r) ? ahead : first;
  return steer(s, i, iatan2(vertexY(nav, goal) - y, vertexX(nav, goal) - x));
}

/** Bloqué (moins de STUCK_UNITS parcourues en STUCK_MS) : un pas de côté de 90 à 135°, puis un nouveau chemin. */
function antiStuck(s: MatchState, i: number, move: number): number {
  const P = s.p;
  const B = s.b;
  const R = s.rules.bots;
  const tick = s.tick;
  if (tick < B.unstickUntil[i]) return B.unstickDir[i];
  const still = move === 0 || P.stun[i] > 0;
  if (still || sq(P.x[i] - B.anchorX[i], P.y[i] - B.anchorY[i]) >= R.stuckDistance * R.stuckDistance) {
    B.anchorX[i] = P.x[i];
    B.anchorY[i] = P.y[i];
    B.anchorTick[i] = tick;
    return move;
  }
  if (tick - B.anchorTick[i] < R.stuckTicks) return move;
  const st = STREAM.bot0 + i;
  const turn = nextRange(s.rng, st, 4, 6) * (chance(s.rng, st, 500) ? 1 : -1);
  B.unstickDir[i] = steer(s, i, directionAngle(((move - 1 + turn + 32) % 16) + 1));
  B.unstickUntil[i] = tick + 8;
  if (B.action[i] !== ACTION.zone) {
    B.needPath[i] = 2;
    B.pathLen[i] = 0;
  }
  B.anchorX[i] = P.x[i];
  B.anchorY[i] = P.y[i];
  B.anchorTick[i] = tick;
  return B.unstickDir[i];
}

/**
 * Emplacement d'arme voulu (`d` : distance de la cible visible `t`, −1 sans cible) : 2 (couteau) au contact s'il frappe
 * plus fort que l'arme à feu, sinon le meilleur emplacement d'arme à feu pour la distance (0 ou 1), ou 2 si aucune.
 */
function wantedSlot(s: MatchState, i: number, d: number, t: number): number {
  const slot = bestGunSlot(s, i, d);
  const gunW = slot < 0 ? s.rules.startWeapon : slot === 0 ? s.p.weapon0[i] : s.p.weapon1[i];
  // Le couteau est gardé un peu au-delà de sa portée : sinon le bot changerait d'arme à chaque pas (sans jamais frapper).
  if (d >= 0 && knifeBeats(s, gunW) && d <= knifeReach(s, i, t) + (s.p.active[i] === 2 ? KNIFE_KEEP * SUB : 0)) return 2;
  return slot < 0 ? 2 : slot;
}

/** Capacité au bon moment, selon son type (`target` : une cible visible que le bot veut bien combattre). */
function wantsAbility(s: MatchState, i: number, action: number, target: boolean, d: number, ready: boolean, aligned: boolean): boolean {
  const f = s.fighters[i];
  const P = s.p;
  const Zs = s.zone;
  const range = s.rules.weapons[weaponInHand(s, i)].range;
  const engaged = target && ready && d <= range;
  const outside = !insideCircle(P.x[i], P.y[i], Zs[Z.cx], Zs[Z.cy], Zs[Z.r]);
  const run = action === ACTION.flee || (action === ACTION.zone && outside);
  switch (f.ability) {
    case AB.sprint:
      return run || (action === ACTION.fight && target && d > 2 * WEAPON_BAND[weaponInHand(s, i)][1] * SUB);
    case AB.stun:
    case AB.debuff:
    case AB.pierce:
      return engaged;
    case AB.drain:
      return engaged && 1000 * P.hp[i] < 850 * f.maxHp;
    case AB.multi:
      return engaged && aligned;
    case AB.burn:
      return target && ready && aligned && d <= s.rules.weapons[BURN_SHOT].range;
    case AB.buff:
      if (f.abilityStat === ST.atk) return engaged;
      if (f.abilityStat === ST.def) return s.tick - s.b.threatTick[i] <= s.rules.tickRate;
      return run;
  }
  return false;
}
