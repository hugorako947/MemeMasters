/**
 * Moteur du battle royale : fonction pure et déterministe (conception validée, §3).
 *
 *   createMatch(réglages)          → état initial (carte, butin, positions, zone)
 *   advance(état, commandes)       → avance d'un tick, en modifiant l'état reçu
 *   step(état, commandes)          → même chose sur une copie : l'état reçu ne change pas
 *
 * Mêmes réglages et mêmes commandes donnent toujours le même état, octet pour octet,
 * dans le navigateur comme sur le serveur : entiers seulement, générateur à graine à
 * flux séparés, ordre d'itération fixe (participants par emplacement, projectiles par
 * numéro de création). Aucun accès au DOM, au réseau ni à l'heure.
 *
 * Ordre d'un tick : commandes des bots → commandes (visée, actions ponctuelles) → déplacements → grille →
 * capacités et tirs → projectiles → minuteries (rechargement, soin, brûlure,
 * régénération) → zone → fin de partie.
 *
 * Toute modification qui change le résultat d'une partie doit augmenter ENGINE_VERSION
 * (le test d'empreinte de replay.test.ts le rappelle).
 */
import { initBots, runBots } from "./bot";
import { ABILITY_KINDS, BOOST_STATS, PASSIVE_KINDS, type BattleCharacter } from "./character";
import { BTN, isValidCommand, unpackAim, unpackButtons, unpackMove } from "./commands";
import { angleDiff, clamp, iatan2, icos, idiv, isin, isqrt, Q14 } from "./fixed";
import { buildGrid, forEachNear } from "./grid";
import { circleHitsSolid, generateMap, ITEM, isPassable, placeLoot, placeSpawns, segmentWallHit, tileAt, type GameMap, type LootItem } from "./map";
import { chance, createStreams, nextBelow, nextRange, STREAM } from "./rng";
import { BURN_SHOT, SUB, type Rules } from "./rules";
import { allocateState, C, cloneState, KILL_BURN, KILL_REFLECT, KILL_ZONE, SHOT_CAPACITY, SHOT_FIELDS, weaponInHand, Z, type MatchState } from "./state";
import { canSee } from "./vision";

export const ENGINE_VERSION = 2;

const kindIndex = <K extends string>(list: readonly K[]) => Object.fromEntries(list.map((k, i) => [k, i])) as Record<K, number>;
const AB = kindIndex(ABILITY_KINDS);
const PS = kindIndex(PASSIVE_KINDS);
const ST = kindIndex(BOOST_STATS);

/** Tick « jamais » : dernier tir d'un participant qui n'a pas encore tiré. */
const NEVER = -1_000_000;

export interface MatchSetup {
  /** Graine de la partie (entier 32 bits). */
  seed: number;
  rules: Rules;
  /** Un personnage par emplacement (l'emplacement est l'indice). */
  characters: readonly BattleCharacter[];
  /**
   * Niveau de chaque emplacement joué par un bot (en dixièmes, de 0 à 10 × MAX_LEVEL ; voir botLevelForTrophies),
   * null pour un emplacement piloté par des commandes (joueur). Absent : tous pilotés par des commandes.
   */
  botLevels?: readonly (number | null)[];
  /** Tests uniquement : carte, positions de départ (x, y à la suite) et butin imposés. */
  map?: GameMap;
  spawns?: ArrayLike<number>;
  loot?: readonly LootItem[];
}

export function createMatch(setup: MatchSetup): MatchState {
  const { rules, characters } = setup;
  const n = characters.length;
  const rng = createStreams(setup.seed >>> 0, STREAM.bot0 + n);
  const map = setup.map ?? generateMap(rules, rng);
  const maxRadius = characters.reduce((m, c) => Math.max(m, c.hitRadius * SUB), 0);
  const spawns = setup.spawns ?? placeSpawns(map, rules, rng, n, maxRadius);
  const loot = setup.loot ?? placeLoot(map, rules, rng, n);
  const botLevels = setup.botLevels ?? [];
  const botCount = characters.reduce((count, _, i) => count + (botLevels[i] === null || botLevels[i] === undefined ? 0 : 1), 0);
  const s = allocateState(rules, map, characters, rng, loot, botCount);
  const P = s.p;
  const size = map.size * map.tileSub;
  const middle = size >> 1;
  for (let i = 0; i < n; i++) {
    P.alive[i] = 1;
    P.x[i] = spawns[2 * i];
    P.y[i] = spawns[2 * i + 1];
    P.aim[i] = iatan2(middle - P.y[i], middle - P.x[i]);
    P.hp[i] = s.fighters[i].maxHp;
    P.weapon1[i] = -1;
    P.mag0[i] = rules.weapons[rules.startWeapon].magazine;
    P.killedBy[i] = -2;
    P.burnFrom[i] = -1;
    P.lastHitBy[i] = -1;
    P.lastShot[i] = NEVER;
  }
  // Zone de départ : un cercle qui couvre toute la carte.
  const Zs = s.zone;
  Zs[Z.cx] = Zs[Z.fx] = middle;
  Zs[Z.cy] = Zs[Z.fy] = middle;
  Zs[Z.r] = Zs[Z.fr] = idiv(size * 7072, 10000) + map.tileSub;
  chooseZoneTarget(s);
  if (botCount > 0) initBots(s, characters, botLevels);
  return s;
}

/** Avance d'un tick sur une copie : l'état reçu n'est jamais modifié. */
export function step(state: MatchState, commands: ArrayLike<number>): MatchState {
  return advance(cloneState(state), commands);
}

export { weaponInHand };

// ---------------------------------------------------------------- un tick

/** Avance d'un tick, en modifiant l'état reçu. `commands[i]` : commande de l'emplacement i (voir commands.ts). */
export function advance(s: MatchState, commands: ArrayLike<number>): MatchState {
  if (s.finished) return s;
  s.tick++;
  const n = s.n;
  const P = s.p;
  // 0. Bots : leurs commandes, tirées de l'état au début du tick, remplacent celles reçues pour leurs emplacements.
  if (s.botCount > 0) {
    const merged = new Uint32Array(n);
    for (let i = 0; i < n; i++) merged[i] = commands[i] ?? 0;
    buildGrid(s);
    runBots(s, merged);
    commands = merged;
  }
  const moveDir = new Int32Array(n);
  const wantsFire = new Uint8Array(n);
  const wantsAbility = new Uint8Array(n);

  // 1. Commandes : visée (rotation plafonnée), actions ponctuelles sur appui.
  for (let i = 0; i < n; i++) {
    if (!P.alive[i]) continue;
    let c = commands[i] ?? 0;
    if (!isValidCommand(c)) c = 0;
    const turn = clamp(angleDiff(unpackAim(c), P.aim[i]), -s.rules.aimTurn, s.rules.aimTurn);
    P.aim[i] = (P.aim[i] + turn) & 255;
    const buttons = unpackButtons(c);
    const pressed = buttons & ~P.prevButtons[i];
    P.prevButtons[i] = buttons;
    if (P.stun[i] > 0) continue;
    moveDir[i] = unpackMove(c);
    wantsFire[i] = buttons & BTN.fire ? 1 : 0;
    wantsAbility[i] = pressed & BTN.ability ? 1 : 0;
    if (pressed & BTN.nextWeapon) switchWeapon(s, i);
    if (pressed & BTN.reload) startReload(s, i);
    if (pressed & BTN.heal) startHeal(s, i);
    if (pressed & BTN.pickup) pickup(s, i);
  }

  // 2. Déplacements (16 directions), avec glissement le long des obstacles.
  for (let i = 0; i < n; i++) {
    if (!P.alive[i] || moveDir[i] === 0) continue;
    const speed = currentSpeed(s, i);
    const angle = (moveDir[i] - 1) * 16;
    const r = s.fighters[i].radius;
    P.x[i] = slide(s.map, P.x[i], P.y[i], r, idiv(speed * icos(angle), Q14), true);
    P.y[i] = slide(s.map, P.x[i], P.y[i], r, idiv(speed * isin(angle), Q14), false);
  }

  // 3. Grille spatiale (collisions des balles, aide à la visée).
  buildGrid(s);

  // 4. Capacités et tirs.
  for (let i = 0; i < n; i++) {
    if (!P.alive[i] || P.stun[i] > 0 || P.healing[i] > 0) continue;
    if (wantsAbility[i] && P.abilityCd[i] === 0) activateAbility(s, i);
    if (wantsFire[i]) tryFire(s, i);
  }

  // 5. Projectiles, dans l'ordre de création.
  updateShots(s);

  // 6. Minuteries, brûlure, régénération.
  updateTimers(s);

  // 7. Zone.
  updateZone(s);
  if (s.tick % s.rules.tickRate === 0) zoneDamage(s);

  // 8. Fin de partie.
  checkEnd(s);
  return s;
}

// ---------------------------------------------------------------- déplacement

/** Déplace un cercle sur un axe ; en cas d'obstacle, va le plus loin possible sans le chevaucher. */
function slide(map: GameMap, x: number, y: number, r: number, d: number, horizontal: boolean): number {
  if (d === 0) return horizontal ? x : y;
  const from = horizontal ? x : y;
  const blocked = (v: number) => (horizontal ? circleHitsSolid(map, v, y, r) : circleHitsSolid(map, x, v, r));
  if (!blocked(from + d)) return from + d;
  const sign = d > 0 ? 1 : -1;
  let lo = 0;
  let hi = Math.abs(d);
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (blocked(from + sign * mid)) hi = mid;
    else lo = mid;
  }
  return from + sign * lo;
}

function abilityActive(s: MatchState, i: number, kind: number): boolean {
  return s.p.abilityLeft[i] > 0 && s.fighters[i].ability === kind;
}

/** Bonus (+) ou malus (−) en ‰ sur une statistique : boost de la capacité, affaiblissement reçu. */
function statModifier(s: MatchState, i: number, stat: number): number {
  const f = s.fighters[i];
  let mod = 0;
  if (abilityActive(s, i, AB.buff) && f.abilityStat === stat) mod += f.abilityPermille;
  if (s.m.debuffLeft[3 * i + stat] > 0) mod -= s.m.debuffPermille[3 * i + stat];
  return mod;
}

function currentSpeed(s: MatchState, i: number): number {
  const f = s.fighters[i];
  let mod = 1000 + statModifier(s, i, ST.spd);
  if (abilityActive(s, i, AB.sprint)) mod += f.abilityPermille;
  let speed = idiv(f.speed * Math.max(100, mod), 1000);
  if (s.p.healing[i] > 0) speed = idiv(speed * (100 - s.rules.items.healSlowPercent), 100);
  return speed;
}

// ---------------------------------------------------------------- armes, soins, objets

function switchWeapon(s: MatchState, i: number): void {
  const P = s.p;
  if (P.weapon1[i] < 0) return;
  P.active[i] ^= 1;
  P.reload[i] = 0;
  P.fireCd[i] = Math.max(P.fireCd[i], s.rules.switchTicks);
}

function magazineOf(s: MatchState, i: number): number {
  return s.p.active[i] === 1 && s.p.weapon1[i] >= 0 ? s.p.mag1[i] : s.p.mag0[i];
}

function setMagazine(s: MatchState, i: number, value: number): void {
  if (s.p.active[i] === 1 && s.p.weapon1[i] >= 0) s.p.mag1[i] = value;
  else s.p.mag0[i] = value;
}

function startReload(s: MatchState, i: number): void {
  const P = s.p;
  const W = s.rules.weapons[weaponInHand(s, i)];
  if (P.reload[i] > 0 || magazineOf(s, i) >= W.magazine) return;
  if (W.ammo > 0 && s.m.ammo[4 * i + W.ammo] <= 0) return;
  P.reload[i] = W.reloadTicks;
  P.healing[i] = 0;
}

function finishReload(s: MatchState, i: number): void {
  const W = s.rules.weapons[weaponInHand(s, i)];
  const mag = magazineOf(s, i);
  const need = W.magazine - mag;
  const take = W.ammo === 0 ? need : Math.min(need, s.m.ammo[4 * i + W.ammo]);
  setMagazine(s, i, mag + take);
  if (W.ammo > 0) s.m.ammo[4 * i + W.ammo] -= take;
}

function startHeal(s: MatchState, i: number): void {
  const P = s.p;
  if (P.heals[i] <= 0 || P.hp[i] >= s.fighters[i].maxHp || P.healing[i] > 0) return;
  P.healing[i] = s.rules.items.healTicks;
  P.reload[i] = 0;
}

function finishHeal(s: MatchState, i: number): void {
  const P = s.p;
  P.hp[i] = Math.min(s.fighters[i].maxHp, P.hp[i] + s.rules.items.healHp);
  P.heals[i]--;
  s.counters[C.usedHeals]++;
}

function pushItem(s: MatchState, kind: number, sub: number, qty: number, x: number, y: number): void {
  // Une arme se pose même chargeur vide ; un tas de munitions ou de soins vide, non.
  if ((qty <= 0 && kind !== ITEM.weapon) || s.itemCount >= s.it.kind.length) return;
  const k = s.itemCount++;
  s.it.kind[k] = kind;
  s.it.sub[k] = sub;
  s.it.qty[k] = qty;
  s.it.x[k] = x;
  s.it.y[k] = y;
}

/** Ramasse l'objet le plus proche à portée (à égalité : le plus ancien). */
function pickup(s: MatchState, i: number): void {
  const P = s.p;
  const I = s.it;
  const range2 = s.rules.items.pickupRange * s.rules.items.pickupRange;
  let best = -1;
  let bestD = range2 + 1;
  for (let k = 0; k < s.itemCount; k++) {
    if (I.kind[k] === ITEM.none) continue;
    const dx = I.x[k] - P.x[i];
    const dy = I.y[k] - P.y[i];
    const d = dx * dx + dy * dy;
    if (d <= range2 && d < bestD) {
      best = k;
      bestD = d;
    }
  }
  if (best < 0) return;
  const k = best;
  const items = s.rules.items;
  switch (I.kind[k]) {
    case ITEM.weapon: {
      const [w, mag] = [I.sub[k], I.qty[k]];
      if (P.weapon1[i] >= 0) {
        // Échange : l'arme tenue est posée à la place de la nouvelle.
        I.sub[k] = P.weapon1[i];
        I.qty[k] = P.mag1[i];
        I.x[k] = P.x[i];
        I.y[k] = P.y[i];
      } else I.kind[k] = ITEM.none;
      P.weapon1[i] = w;
      P.mag1[i] = mag;
      P.active[i] = 1;
      P.reload[i] = 0;
      P.fireCd[i] = Math.max(P.fireCd[i], s.rules.switchTicks);
      break;
    }
    case ITEM.ammo: {
      const slot = 4 * i + I.sub[k];
      const take = Math.min(items.ammoMax[I.sub[k]] - s.m.ammo[slot], I.qty[k]);
      if (take <= 0) return;
      s.m.ammo[slot] += take;
      I.qty[k] -= take;
      if (I.qty[k] === 0) I.kind[k] = ITEM.none;
      break;
    }
    case ITEM.heal: {
      const take = Math.min(items.healsMax - P.heals[i], I.qty[k]);
      if (take <= 0) return;
      P.heals[i] += take;
      I.qty[k] -= take;
      if (I.qty[k] === 0) I.kind[k] = ITEM.none;
      break;
    }
    case ITEM.vest: {
      if (P.shield[i] >= items.vestShield) return;
      P.shield[i] = items.vestShield;
      I.kind[k] = ITEM.none;
      s.counters[C.usedVests]++;
      break;
    }
  }
}

// ---------------------------------------------------------------- tirs et capacités

/** Angle de tir : la visée, attirée vers la cible visible la plus proche de l'axe (± aimAssist pas). */
function assistedAim(s: MatchState, i: number): number {
  const P = s.p;
  const base = P.aim[i];
  const assist = s.rules.aimAssist;
  if (assist === 0) return base;
  const { halfWidth, halfHeight } = s.rules.view;
  let best = -1;
  let bestDiff = 0;
  let bestD = 0;
  let bestAngle = base;
  forEachNear(P.x[i] - halfWidth, P.y[i] - halfHeight, P.x[i] + halfWidth, P.y[i] + halfHeight, (j) => {
    if (j === i) return;
    const dx = P.x[j] - P.x[i];
    const dy = P.y[j] - P.y[i];
    if (Math.abs(dx) > halfWidth || Math.abs(dy) > halfHeight) return;
    const d = dx * dx + dy * dy;
    const angle = iatan2(dy, dx);
    const diff = Math.abs(angleDiff(angle, base));
    if (diff > assist) return;
    const better = best < 0 || diff < bestDiff || (diff === bestDiff && (d < bestD || (d === bestD && j < best)));
    // Visible selon la même règle que pour le joueur et les bots (champ de vision, buissons, murs).
    if (!better || !canSee(s, i, j)) return;
    best = j;
    bestDiff = diff;
    bestD = d;
    bestAngle = angle;
  });
  return bestAngle;
}

interface ShotEffects {
  stunTicks: number;
  burnPermille: number;
  burnTicks: number;
  debuffStat: number;
  debuffPermille: number;
  debuffTicks: number;
  pierce: number;
  drain: number;
}
const NO_EFFECT: ShotEffects = { stunTicks: 0, burnPermille: 0, burnTicks: 0, debuffStat: -1, debuffPermille: 0, debuffTicks: 0, pierce: 0, drain: 0 };

function spawnShot(s: MatchState, owner: number, weapon: number, angle: number, damage: number, fx: ShotEffects): void {
  if (s.shotCount >= SHOT_CAPACITY) return;
  const S = s.s;
  const k = s.shotCount++;
  const W = s.rules.weapons[weapon];
  S.id[k] = s.counters[C.nextShot]++;
  S.x[k] = s.p.x[owner];
  S.y[k] = s.p.y[owner];
  S.vx[k] = idiv(W.speed * icos(angle), Q14);
  S.vy[k] = idiv(W.speed * isin(angle), Q14);
  S.speed[k] = W.speed;
  S.left[k] = W.range;
  S.damage[k] = damage;
  S.owner[k] = owner;
  S.weapon[k] = weapon;
  S.stunTicks[k] = fx.stunTicks;
  S.burnPermille[k] = fx.burnPermille;
  S.burnTicks[k] = fx.burnTicks;
  S.debuffStat[k] = fx.debuffStat;
  S.debuffPermille[k] = fx.debuffPermille;
  S.debuffTicks[k] = fx.debuffTicks;
  S.pierce[k] = fx.pierce;
  S.drain[k] = fx.drain;
}

/** Dégâts d'une balle au départ : arme × ATQ (%) × boost ou affaiblissement d'ATQ. */
function shotDamage(s: MatchState, i: number, base: number): number {
  return Math.max(1, idiv(base * s.fighters[i].weaponPercent * (1000 + statModifier(s, i, ST.atk)), 100_000));
}

function tryFire(s: MatchState, i: number): void {
  const P = s.p;
  const f = s.fighters[i];
  const w = weaponInHand(s, i);
  const W = s.rules.weapons[w];
  if (P.reload[i] > 0 || P.fireCd[i] > 0) return;
  const mag = magazineOf(s, i);
  if (mag <= 0) {
    startReload(s, i);
    return;
  }
  setMagazine(s, i, mag - 1);
  P.fireCd[i] = W.fireTicks;
  P.lastShot[i] = s.tick;
  if (W.ammo > 0) s.counters[W.ammo]++;
  const fx: ShotEffects = { ...NO_EFFECT };
  if (abilityActive(s, i, AB.drain)) fx.drain = f.abilityPermille;
  if (abilityActive(s, i, AB.pierce)) fx.pierce = f.abilityPermille;
  // Étourdissement ou affaiblissement « armé » : porté par ce tir, puis consommé.
  if (abilityActive(s, i, AB.stun)) {
    fx.stunTicks = f.abilityEffectTicks;
    P.abilityLeft[i] = 0;
  } else if (abilityActive(s, i, AB.debuff)) {
    fx.debuffStat = f.abilityStat;
    fx.debuffPermille = f.abilityPermille;
    fx.debuffTicks = f.abilityEffectTicks;
    P.abilityLeft[i] = 0;
  }
  const base = assistedAim(s, i);
  const damage = shotDamage(s, i, W.damage);
  for (let k = 0; k < W.pellets; k++) {
    const angle = W.spread > 0 ? base + nextRange(s.rng, STREAM.combat, -W.spread, W.spread) : base;
    spawnShot(s, i, w, angle, damage, fx);
  }
  if (mag - 1 === 0) startReload(s, i);
}

function activateAbility(s: MatchState, i: number): void {
  const P = s.p;
  const f = s.fighters[i];
  P.abilityCd[i] = f.abilityCooldown;
  if (f.ability === AB.multi || f.ability === AB.burn) P.lastShot[i] = s.tick;
  if (f.ability === AB.multi) {
    // Rafale : `hits` balles de l'arme en main, en éventail, sans munitions.
    const w = weaponInHand(s, i);
    const damage = Math.max(1, idiv(shotDamage(s, i, s.rules.weapons[w].damage) * f.abilityPermille, 1000));
    const base = assistedAim(s, i);
    const spread = s.rules.multiSpread;
    for (let k = 0; k < f.abilityHits; k++) {
      const offset = f.abilityHits > 1 ? idiv((2 * k - (f.abilityHits - 1)) * spread, f.abilityHits - 1) : 0;
      spawnShot(s, i, w, base + offset, damage, NO_EFFECT);
    }
    return;
  }
  if (f.ability === AB.burn) {
    const damage = shotDamage(s, i, s.rules.weapons[BURN_SHOT].damage);
    spawnShot(s, i, BURN_SHOT, assistedAim(s, i), damage, { ...NO_EFFECT, burnPermille: f.abilityPermille, burnTicks: f.abilityEffectTicks });
    return;
  }
  P.abilityLeft[i] = f.abilityDuration;
}

// ---------------------------------------------------------------- projectiles et dégâts

function updateShots(s: MatchState): void {
  let write = 0;
  for (let k = 0; k < s.shotCount; k++) {
    if (!moveShot(s, k)) continue;
    if (write !== k) for (const field of SHOT_FIELDS) s.s[field][write] = s.s[field][k];
    write++;
  }
  s.shotCount = write;
}

/** Avance un projectile ; touche le premier participant ou obstacle rencontré. Renvoie faux s'il disparaît. */
function moveShot(s: MatchState, k: number): boolean {
  const S = s.s;
  const P = s.p;
  const x0 = S.x[k];
  const y0 = S.y[k];
  let dx = S.vx[k];
  let dy = S.vy[k];
  const left = S.left[k];
  if (left < S.speed[k]) {
    dx = idiv(dx * left, S.speed[k]);
    dy = idiv(dy * left, S.speed[k]);
  }
  const x1 = x0 + dx;
  const y1 = y0 + dy;
  const a = dx * dx + dy * dy;
  const owner = S.owner[k];
  let best = -1;
  let bestNum = 0;
  if (a > 0) {
    const pad = 32 * SUB;
    forEachNear(Math.min(x0, x1) - pad, Math.min(y0, y1) - pad, Math.max(x0, x1) + pad, Math.max(y0, y1) + pad, (j) => {
      if (j === owner) return;
      const r = s.fighters[j].radius;
      const fx = x0 - P.x[j];
      const fy = y0 - P.y[j];
      const c = fx * fx + fy * fy - r * r;
      let num = 0;
      if (c > 0) {
        // Première intersection du segment avec le cercle : t = (−b − √(b² − a·c)) / a.
        const b = fx * dx + fy * dy;
        if (b >= 0) return;
        const disc = b * b - a * c;
        if (disc < 0) return;
        num = -b - isqrt(disc);
        if (num > a) return;
      }
      if (best < 0 || num < bestNum || (num === bestNum && j < best)) {
        best = j;
        bestNum = num;
      }
    });
  }
  const wall = segmentWallHit(s.map, x0, y0, x1, y1);
  if (best >= 0 && (wall === null || bestNum * wall.den <= wall.num * a)) {
    hitParticipant(s, k, best);
    return false;
  }
  if (wall !== null) return false;
  S.x[k] = x1;
  S.y[k] = y1;
  S.left[k] = left - S.speed[k];
  return S.left[k] > 0;
}

/** Durée d'un effet négatif, raccourcie par le passif « immunité ». */
function negativeDuration(s: MatchState, t: number, ticks: number): number {
  const f = s.fighters[t];
  return f.passive === PS.cleanse ? idiv(ticks * (1000 - f.passivePermille), 1000) : ticks;
}

function hitParticipant(s: MatchState, k: number, t: number): void {
  const S = s.s;
  const P = s.p;
  const ft = s.fighters[t];
  const owner = S.owner[k];
  if (ft.passive === PS.dodge && chance(s.rng, STREAM.combat, ft.passivePermille)) return;
  // Armure : DÉF (avec boost ou affaiblissement), en partie ignorée par le perce-armure.
  const def = idiv(idiv(ft.def * (1000 + statModifier(s, t, ST.def)), 1000) * (1000 - S.pierce[k]), 1000);
  const amount = Math.max(1, idiv(S.damage[k] * 200, 200 + Math.max(0, def)));
  const dealt = damage(s, t, amount, owner, S.weapon[k], true);
  P.damage[owner] += dealt;
  P.lastHit[t] = s.tick;
  P.lastHitBy[t] = owner;
  if (S.drain[k] > 0 && P.alive[owner]) P.hp[owner] = Math.min(s.fighters[owner].maxHp, P.hp[owner] + idiv(dealt * S.drain[k], 1000));
  if (ft.passive === PS.reflect && P.alive[owner]) {
    const back = idiv(dealt * ft.passivePermille, 1000);
    if (back > 0) {
      damage(s, owner, back, t, KILL_REFLECT, true);
      P.lastHit[owner] = s.tick;
      P.lastHitBy[owner] = t;
    }
  }
  if (!P.alive[t]) return;
  if (S.stunTicks[k] > 0) {
    P.stun[t] = Math.max(P.stun[t], negativeDuration(s, t, S.stunTicks[k]));
    P.healing[t] = 0;
  }
  if (S.debuffStat[k] >= 0) {
    const slot = 3 * t + S.debuffStat[k];
    s.m.debuffLeft[slot] = Math.max(s.m.debuffLeft[slot], negativeDuration(s, t, S.debuffTicks[k]));
    s.m.debuffPermille[slot] = Math.max(s.m.debuffPermille[slot], S.debuffPermille[k]);
  }
  if (S.burnPermille[k] > 0) {
    P.burnLeft[t] = negativeDuration(s, t, S.burnTicks[k]);
    P.burnDps[t] = Math.max(1, idiv(ft.maxHp * S.burnPermille[k], 1000));
    P.burnFrom[t] = owner;
  }
}

/** Inflige des dégâts (le gilet d'abord si `useShield`) ; renvoie les dégâts réellement encaissés. */
function damage(s: MatchState, t: number, amount: number, source: number, cause: number, useShield: boolean): number {
  const P = s.p;
  let rest = amount;
  let dealt = 0;
  if (useShield && P.shield[t] > 0) {
    const absorbed = Math.min(P.shield[t], rest);
    P.shield[t] -= absorbed;
    rest -= absorbed;
    dealt += absorbed;
  }
  const lost = Math.min(P.hp[t], rest);
  P.hp[t] -= lost;
  dealt += lost;
  if (P.hp[t] <= 0 && P.alive[t]) kill(s, t, source, cause);
  return dealt;
}

/** Petits décalages pour les objets lâchés à la mort d'un participant. */
const DROP_OFFSETS = [
  [0, 0],
  [10, 0],
  [-10, 0],
  [0, 10],
  [0, -10],
] as const;

function kill(s: MatchState, v: number, killer: number, cause: number): void {
  const P = s.p;
  P.alive[v] = 0;
  P.hp[v] = 0;
  P.place[v] = s.aliveCount;
  s.aliveCount--;
  P.deathTick[v] = s.tick;
  P.killedBy[v] = killer;
  if (killer >= 0 && killer !== v) P.kills[killer]++;
  const e = 4 * s.logCount++;
  s.log[e] = s.tick;
  s.log[e + 1] = killer;
  s.log[e + 2] = v;
  s.log[e + 3] = cause;
  // Butin lâché sur place : arme ramassée (avec son chargeur), munitions, soins.
  let d = 0;
  const drop = (kind: number, sub: number, qty: number) => {
    if (qty <= 0 && kind !== ITEM.weapon) return;
    const [ox, oy] = DROP_OFFSETS[d++ % DROP_OFFSETS.length];
    pushItem(s, kind, sub, qty, P.x[v] + ox * SUB, P.y[v] + oy * SUB);
  };
  if (P.weapon1[v] >= 0) drop(ITEM.weapon, P.weapon1[v], P.mag1[v]);
  for (let a = 1; a < 4; a++) drop(ITEM.ammo, a, s.m.ammo[4 * v + a]);
  drop(ITEM.heal, 0, P.heals[v]);
  if (P.weapon1[v] >= 0) {
    P.weapon1[v] = -1;
    P.mag1[v] = 0;
  }
  for (let a = 1; a < 4; a++) s.m.ammo[4 * v + a] = 0;
  P.heals[v] = 0;
  P.shield[v] = 0;
  P.healing[v] = 0;
  P.reload[v] = 0;
  P.stun[v] = 0;
  P.burnLeft[v] = 0;
}

// ---------------------------------------------------------------- minuteries

function updateTimers(s: MatchState): void {
  const P = s.p;
  const rate = s.rules.tickRate;
  const perSecond = s.tick % rate === 0;
  for (let i = 0; i < s.n; i++) {
    if (!P.alive[i]) continue;
    if (P.fireCd[i] > 0) P.fireCd[i]--;
    if (P.abilityCd[i] > 0) P.abilityCd[i]--;
    if (P.abilityLeft[i] > 0) P.abilityLeft[i]--;
    if (P.stun[i] > 0) P.stun[i]--;
    for (let st = 0; st < 3; st++) if (s.m.debuffLeft[3 * i + st] > 0 && --s.m.debuffLeft[3 * i + st] === 0) s.m.debuffPermille[3 * i + st] = 0;
    if (P.reload[i] > 0 && --P.reload[i] === 0) finishReload(s, i);
    if (P.healing[i] > 0 && --P.healing[i] === 0) finishHeal(s, i);
    // Brûlure : des dégâts à chaque seconde écoulée depuis la touche.
    if (P.burnLeft[i] > 0) {
      P.burnLeft[i]--;
      if (P.burnLeft[i] % rate === 0) {
        damage(s, i, P.burnDps[i], P.burnFrom[i], KILL_BURN, false);
        if (!P.alive[i]) continue;
      }
    }
    // Régénération (passif « soin ») après quelques secondes sans être touché, jusqu'au plafond.
    const f = s.fighters[i];
    const cap = idiv(f.maxHp * s.rules.regenCapPercent, 100);
    if (perSecond && f.passive === PS.regen && f.passivePermille > 0 && s.tick - P.lastHit[i] >= s.rules.regenDelayTicks && P.hp[i] < cap) {
      P.hp[i] = Math.min(cap, P.hp[i] + Math.max(1, idiv(f.maxHp * f.passivePermille, 1000)));
    }
  }
}

// ---------------------------------------------------------------- zone

/** Prochain cercle : rayon en % de l'actuel, centre tiré à l'intérieur (sur une case praticable si possible). */
function chooseZoneTarget(s: MatchState): void {
  const Zs = s.zone;
  const phase = s.rules.zone[Zs[Z.phase]];
  const tr = idiv(Zs[Z.fr] * phase.radiusPercent, 100);
  // Marge de 4 sous-unités par tick de rétrécissement : avec les arrondis, chaque cercle reste dans le précédent.
  const maxD = Zs[Z.fr] - tr - 4 * phase.shrinkTicks;
  let tx = Zs[Z.fx];
  let ty = Zs[Z.fy];
  if (maxD > 0) {
    for (let tries = 0; tries < 8; tries++) {
      const angle = nextBelow(s.rng, STREAM.zone, 256);
      const d = nextBelow(s.rng, STREAM.zone, maxD + 1);
      const x = Zs[Z.fx] + idiv(d * icos(angle), Q14);
      const y = Zs[Z.fy] + idiv(d * isin(angle), Q14);
      const dx = x - Zs[Z.fx];
      const dy = y - Zs[Z.fy];
      if (dx * dx + dy * dy <= maxD * maxD && isPassable(tileAt(s.map, x, y))) {
        tx = x;
        ty = y;
        break;
      }
    }
  }
  Zs[Z.tx] = tx;
  Zs[Z.ty] = ty;
  Zs[Z.tr] = tr;
}

function updateZone(s: MatchState): void {
  const Zs = s.zone;
  if (Zs[Z.stage] === 2) return;
  const phase = s.rules.zone[Zs[Z.phase]];
  const t = ++Zs[Z.t];
  if (Zs[Z.stage] === 0) {
    if (t >= phase.waitTicks) {
      Zs[Z.stage] = 1;
      Zs[Z.t] = 0;
    }
    return;
  }
  const S = phase.shrinkTicks;
  const k = Math.min(t, S);
  Zs[Z.cx] = Zs[Z.fx] + idiv((Zs[Z.tx] - Zs[Z.fx]) * k, S);
  Zs[Z.cy] = Zs[Z.fy] + idiv((Zs[Z.ty] - Zs[Z.fy]) * k, S);
  Zs[Z.r] = Zs[Z.fr] - idiv((Zs[Z.fr] - Zs[Z.tr]) * k, S);
  if (k < S) return;
  Zs[Z.phase]++;
  if (Zs[Z.phase] >= s.rules.zone.length) {
    Zs[Z.stage] = 2;
    return;
  }
  Zs[Z.stage] = 0;
  Zs[Z.t] = 0;
  Zs[Z.fx] = Zs[Z.cx];
  Zs[Z.fy] = Zs[Z.cy];
  Zs[Z.fr] = Zs[Z.r];
  chooseZoneTarget(s);
}

/** Dégâts hors zone, une fois par seconde, directement sur les PV. */
function zoneDamage(s: MatchState): void {
  const P = s.p;
  const Zs = s.zone;
  const phase = s.rules.zone[Math.min(Zs[Z.phase], s.rules.zone.length - 1)];
  const r2 = Zs[Z.r] * Zs[Z.r];
  for (let i = 0; i < s.n; i++) {
    if (!P.alive[i]) continue;
    const dx = P.x[i] - Zs[Z.cx];
    const dy = P.y[i] - Zs[Z.cy];
    if (dx * dx + dy * dy > r2) damage(s, i, phase.dps, -1, KILL_ZONE, false);
  }
}

// ---------------------------------------------------------------- fin de partie

function checkEnd(s: MatchState): void {
  const P = s.p;
  if (s.aliveCount <= 1) {
    for (let i = 0; i < s.n; i++) if (P.alive[i]) P.place[i] = 1;
    s.finished = true;
    return;
  }
  if (s.tick < s.rules.maxTicks) return;
  // Filet de sécurité (la zone finit toujours avant) : survivants classés par PV, puis dégâts, puis emplacement.
  const survivors = Array.from({ length: s.n }, (_, i) => i).filter((i) => P.alive[i]);
  survivors.sort((a, b) => P.hp[b] - P.hp[a] || P.damage[b] - P.damage[a] || a - b);
  survivors.forEach((i, rank) => (P.place[i] = rank + 1));
  s.finished = true;
}

// ---------------------------------------------------------------- résultat

export interface KillEntry {
  tick: number;
  /** Auteur (emplacement), −1 pour la zone. */
  killer: number;
  victim: number;
  /** Arme (0 à 3), projectile de brûlure (4), brûlure (5), zone (6), renvoi (7). */
  cause: number;
}

export interface MatchResult {
  ticks: number;
  finished: boolean;
  places: number[];
  kills: number[];
  damage: number[];
  /** Éliminé par (emplacement), −1 zone, −2 personne. */
  killedBy: number[];
  deathTick: number[];
  log: KillEntry[];
}

export function matchResult(s: MatchState): MatchResult {
  const P = s.p;
  return {
    ticks: s.tick,
    finished: s.finished,
    places: Array.from(P.place),
    kills: Array.from(P.kills),
    damage: Array.from(P.damage),
    killedBy: Array.from(P.killedBy),
    deathTick: Array.from(P.deathTick),
    log: Array.from({ length: s.logCount }, (_, e) => ({ tick: s.log[4 * e], killer: s.log[4 * e + 1], victim: s.log[4 * e + 2], cause: s.log[4 * e + 3] })),
  };
}

export { cloneState };
