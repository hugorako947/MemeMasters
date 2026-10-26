/**
 * Ce que le joueur voit et ce que l'interface affiche, lu dans l'état du moteur (sans jamais le modifier).
 * La visibilité suit exactement les règles des bots (vision.ts) : aucun ennemi ni objet n'est montré hors
 * de ces règles, sinon les bots ne seraient plus honnêtes envers le joueur.
 */
import type { KillEntry } from "@/lib/br/engine";
import { ITEM, lineOfSight } from "@/lib/br/map";
import { KNIFE } from "@/lib/br/rules";
import { canTake, weaponInHand, Z, type MatchState } from "@/lib/br/state";
import { canSee, canSeePoint, inView } from "@/lib/br/vision";

/** Participants visibles du joueur `me` (1 = visible) ; le joueur se voit toujours tant qu'il est en vie. */
export function visibleParticipants(s: MatchState, me: number, out: Uint8Array): Uint8Array {
  for (let j = 0; j < s.n; j++) out[j] = j === me ? s.p.alive[me] : canSee(s, me, j) ? 1 : 0;
  return out;
}

/** L'objet k (au sol) est visible du joueur. */
export function itemVisible(s: MatchState, me: number, k: number): boolean {
  return s.it.kind[k] !== ITEM.none && canSeePoint(s, me, s.it.x[k], s.it.y[k]);
}

/** Le projectile k est visible du joueur : dans son champ de vision, sans mur entre les deux. */
export function shotVisible(s: MatchState, me: number, k: number): boolean {
  const x = s.s.x[k];
  const y = s.s.y[k];
  return inView(s, me, x, y) && lineOfSight(s.map, s.p.x[me], s.p.y[me], x, y);
}

/** Pixels par sous-unité pour que le champ de vision du moteur occupe l'écran (le même pour tous les joueurs). */
export function viewScale(width: number, height: number, view: { halfWidth: number; halfHeight: number }): number {
  return Math.min(width / (2 * view.halfWidth), height / (2 * view.halfHeight));
}

export interface HudState {
  alive: boolean;
  hp: number;
  maxHp: number;
  shield: number;
  /** Arme en main (indice des armes du moteur : BR_WEAPONS, puis le couteau KNIFE). */
  weapon: number;
  /** Les trois emplacements (arme de départ, arme ramassée ou −1, couteau) et celui en main (0 à 2). */
  slots: [number, number, number];
  slot: number;
  magazine: number;
  /** Taille du chargeur (0 : couteau, sans munitions). */
  magazineSize: number;
  /** Munitions en réserve pour l'arme en main ; null : illimitées (arme de départ) ou sans objet (couteau). */
  reserve: number | null;
  /** Lunette portée (1 : aucune, 2 ou 4) ; secondes restantes de boisson énergisante (0 : aucune). */
  scope: number;
  boostSeconds: number;
  /** Rechargement en cours : part restante (1 → 0), 0 si aucun. */
  reloading: number;
  abilityReady: boolean;
  /** Recharge de la capacité : part restante (1 → 0) et secondes restantes. */
  abilityCooldown: number;
  abilitySeconds: number;
  abilityActive: boolean;
  stunned: boolean;
  survivors: number;
  kills: number;
  damage: number;
  zone: { phase: number; stage: number; secondsLeft: number; outside: boolean };
}

export function hudState(s: MatchState, me: number): HudState {
  const P = s.p;
  const f = s.fighters[me];
  const w = weaponInHand(s, me);
  const W = s.rules.weapons[w];
  const held = P.active[me] === 1 && P.weapon1[me] >= 0;
  const Zs = s.zone;
  const phase = s.rules.zone[Math.min(Zs[Z.phase], s.rules.zone.length - 1)];
  const stageTicks = Zs[Z.stage] === 0 ? phase.waitTicks : Zs[Z.stage] === 1 ? phase.shrinkTicks : 0;
  const dx = P.x[me] - Zs[Z.cx];
  const dy = P.y[me] - Zs[Z.cy];
  return {
    alive: P.alive[me] === 1,
    hp: P.hp[me],
    maxHp: f.maxHp,
    shield: P.shield[me],
    weapon: w,
    slots: [s.rules.startWeapon, P.weapon1[me], KNIFE],
    slot: w === KNIFE ? 2 : held ? 1 : 0,
    magazine: w === KNIFE ? 0 : held ? P.mag1[me] : P.mag0[me],
    magazineSize: W.magazine,
    reserve: W.ammo === 0 ? null : s.m.ammo[4 * me + W.ammo],
    scope: Math.max(1, P.scope[me]),
    boostSeconds: Math.ceil(P.boostLeft[me] / s.rules.tickRate),
    reloading: P.reload[me] > 0 ? P.reload[me] / W.reloadTicks : 0,
    abilityReady: P.abilityCd[me] === 0,
    abilityCooldown: f.abilityCooldown > 0 ? P.abilityCd[me] / f.abilityCooldown : 0,
    abilitySeconds: Math.ceil(P.abilityCd[me] / s.rules.tickRate),
    abilityActive: P.abilityLeft[me] > 0,
    stunned: P.stun[me] > 0,
    survivors: s.aliveCount,
    kills: P.kills[me],
    damage: P.damage[me],
    zone: {
      phase: Zs[Z.phase],
      stage: Zs[Z.stage],
      secondsLeft: Math.max(0, Math.ceil((stageTicks - Zs[Z.t]) / s.rules.tickRate)),
      outside: dx * dx + dy * dy > Zs[Z.r] * Zs[Z.r],
    },
  };
}

/** L'objet que le bouton « Ramasser » prendrait (comme le moteur : le plus proche des objets utiles à portée). */
export function pickupCandidate(s: MatchState, me: number): { kind: number; sub: number } | null {
  const I = s.it;
  const range2 = s.rules.items.pickupRange * s.rules.items.pickupRange;
  let best = -1;
  let bestD = range2 + 1;
  for (let k = 0; k < s.itemCount; k++) {
    if (I.kind[k] === ITEM.none) continue;
    const dx = I.x[k] - s.p.x[me];
    const dy = I.y[k] - s.p.y[me];
    const d = dx * dx + dy * dy;
    if (d <= range2 && d < bestD && canTake(s, me, k)) {
      best = k;
      bestD = d;
    }
  }
  return best < 0 ? null : { kind: I.kind[best], sub: I.sub[best] };
}

/** Éliminations inscrites au journal depuis l'entrée `from`. */
export function newKills(s: MatchState, from: number): KillEntry[] {
  const out: KillEntry[] = [];
  for (let e = from; e < s.logCount; e++) out.push({ tick: s.log[4 * e], killer: s.log[4 * e + 1], victim: s.log[4 * e + 2], cause: s.log[4 * e + 3] });
  return out;
}

/** PV + gilet de chaque participant (à garder avant un tick pour en déduire les dégâts reçus). */
export function hpTotals(s: MatchState): Int32Array {
  const out = new Int32Array(s.n);
  for (let i = 0; i < s.n; i++) out[i] = s.p.hp[i] + s.p.shield[i];
  return out;
}

export interface DamageEvent {
  slot: number;
  amount: number;
  /** Infligés par le joueur (sinon : reçus par le joueur, ou entre deux autres participants visibles). */
  mine: boolean;
}

/** Dégâts subis pendant le dernier tick par les participants visibles, à afficher en chiffres. */
export function damageEvents(before: Int32Array, s: MatchState, me: number, visible: Uint8Array): DamageEvent[] {
  const out: DamageEvent[] = [];
  for (let j = 0; j < s.n; j++) {
    const lost = before[j] - (s.p.hp[j] + s.p.shield[j]);
    if (lost <= 0 || (!visible[j] && j !== me)) continue;
    out.push({ slot: j, amount: lost, mine: j !== me && s.p.lastHitBy[j] === me && s.p.lastHit[j] === s.tick });
  }
  return out;
}
