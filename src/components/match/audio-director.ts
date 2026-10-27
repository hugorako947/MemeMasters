/**
 * Sons d'une partie : après chaque tick, compare l'état du moteur au précédent et déclenche les bruitages
 * (tirs, impacts, éliminations, ramassages, soins, rechargement, capacités, Zone). Le volume baisse avec la
 * distance au joueur et le son se place à gauche ou à droite. Ne lit que l'état ; ne le modifie jamais.
 */
import type { TickEvents } from "@/lib/br-client/events";
import type { DamageEvent } from "@/lib/br-client/view";
import type { KillEntry } from "@/lib/br/engine";
import { C, weaponInHand, Z, type MatchState } from "@/lib/br/state";
import { playAbility, playAbilityReady, playCrate, playElimination, playHeal, playHit, playHurt, playKnife, playPickup, playReload, playShot, playZoneWarning } from "@/lib/client/sfx";

export interface AudioDirector {
  /** À appeler après chaque tick ; `loud` : faux pendant un rattrapage (on n'entend que les derniers ticks). */
  afterTick(s: MatchState, damage: readonly DamageEvent[], kills: readonly KillEntry[], events: TickEvents, loud: boolean): void;
}

export function createAudioDirector(s: MatchState, me: number): AudioDirector {
  const P = s.p;
  const hear = 2.2 * s.rules.view.halfWidth;
  const prevCd = Int32Array.from(P.abilityCd);
  let prevReload = P.reload[me];
  let prevHeals = s.counters[C.usedHeals];
  let prevVests = s.counters[C.usedVests];
  let prevBoost = P.boostLeft[me];
  let prevScope = P.scope[me];
  let prevWeapon = weaponInHand(s, me);
  let prevAmmo = P.ammo[me];
  let prevRanges = s.counters[C.usedRanges];
  let prevHp = P.hp[me];
  let prevStage = s.zone[Z.stage];
  let wasOutside = false;

  /** Volume et position d'un son placé en (x, y), entendu par le joueur. */
  const spatial = (x: number, y: number): [number, number] => {
    const dx = x - P.x[me];
    const dy = y - P.y[me];
    const d = Math.hypot(dx, dy);
    const g = Math.max(0, 1 - d / hear);
    return [g * g, Math.max(-1, Math.min(1, dx / s.rules.view.halfWidth))];
  };

  return {
    afterTick(st, damage, kills, events, loud) {
      if (loud) {
        // Tirs et coups de couteau : un son par participant et par tick (les plombs d'un fusil à pompe ne font qu'un coup).
        for (const e of events.shots) {
          const [g, pan] = e.owner === me ? [1, 0] : spatial(e.x, e.y);
          if (g > 0.02) playShot(e.weapon, g * (e.owner === me ? 0.9 : 0.75), pan);
        }
        for (const e of events.swings) {
          const [g, pan] = e.slot === me ? [1, 0] : spatial(P.x[e.slot], P.y[e.slot]);
          if (g > 0.02) playKnife(g * 0.8, pan);
        }
        for (const e of events.crates) {
          const [g, pan] = spatial(e.x, e.y);
          if (g > 0.02) playCrate(e.hp === 0, g * 0.8, pan);
        }
        for (const e of damage) {
          if (e.slot === me) playHurt(0.9);
          else if (e.mine) playHit(0.8, 0, true);
        }
        for (const k of kills) {
          if (k.killer === me || k.victim === me) playElimination(k.killer === me && k.victim !== me, 0.9);
          else {
            const [g] = spatial(P.x[k.victim], P.y[k.victim]);
            if (g > 0.05) playElimination(false, g * 0.5);
          }
        }
      }

      // Capacités : activée (la recharge repart), et la sienne de nouveau prête.
      for (let i = 0; i < st.n; i++) {
        const cd = P.abilityCd[i];
        if (loud && cd > prevCd[i] && P.alive[i]) {
          const [g, pan] = i === me ? [1, 0] : spatial(P.x[i], P.y[i]);
          playAbility(g * 0.8, pan);
        }
        if (loud && i === me && prevCd[i] > 0 && cd === 0 && P.alive[me]) playAbilityReady(0.7);
        prevCd[i] = cd;
      }

      if (!P.alive[me]) return;
      // Le joueur : rechargement, soin, gilet, arme, munitions, boisson, lunette ou booster de portée ramassés.
      const ammo = P.ammo[me];
      const weapon = weaponInHand(st, me);
      const healed = st.counters[C.usedHeals] > prevHeals && P.hp[me] > prevHp;
      if (loud) {
        if (P.reload[me] > 0 && prevReload === 0) playReload(0.8);
        if (healed) playHeal(0.9);
        else if (
          (st.counters[C.usedVests] > prevVests && P.shield[me] > 0) ||
          weapon !== prevWeapon ||
          ammo > prevAmmo ||
          P.boostLeft[me] > prevBoost + 1 ||
          P.scope[me] > prevScope ||
          st.counters[C.usedRanges] > prevRanges
        )
          playPickup(0.8);
      }
      prevBoost = P.boostLeft[me];
      prevScope = P.scope[me];
      prevReload = P.reload[me];
      prevHeals = st.counters[C.usedHeals];
      prevVests = st.counters[C.usedVests];
      prevWeapon = weapon;
      prevAmmo = ammo;
      prevRanges = st.counters[C.usedRanges];
      prevHp = P.hp[me];

      // La Zone se met à avancer, ou le joueur se retrouve dehors.
      const Zs = st.zone;
      const dx = P.x[me] - Zs[Z.cx];
      const dy = P.y[me] - Zs[Z.cy];
      const outside = dx * dx + dy * dy > Zs[Z.r] * Zs[Z.r];
      if (loud && ((Zs[Z.stage] === 1 && prevStage === 0) || (outside && !wasOutside))) playZoneWarning(0.8);
      prevStage = Zs[Z.stage];
      wasOutside = outside;
    },
  };
}
