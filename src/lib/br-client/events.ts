/**
 * Événements d'un tick, déduits de l'état du moteur avant et après (sans jamais le modifier) : tirs, coups de
 * couteau, balles arrêtées par un mur ou une caisse, caisses touchées ou brisées. Les effets visuels et les sons
 * s'en servent ; c'est à eux de ne garder que ce que le joueur peut voir ou entendre.
 */
import { icos, isin, Q14 } from "@/lib/br/fixed";
import { segmentWallHit } from "@/lib/br/map";
import { KNIFE } from "@/lib/br/rules";
import { C, weaponInHand, type MatchState } from "@/lib/br/state";

export interface ShotEvent {
  owner: number;
  weapon: number;
  /** Point de départ et direction (sous-unités par tick). */
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface SwingEvent {
  slot: number;
  aim: number;
}

export interface ImpactEvent {
  x: number;
  y: number;
}

export interface CrateEvent {
  tile: number;
  /** PV restants de la caisse (0 : brisée). */
  hp: number;
  /** Centre de la caisse. */
  x: number;
  y: number;
}

export interface TickEvents {
  shots: ShotEvent[];
  swings: SwingEvent[];
  impacts: ImpactEvent[];
  crates: CrateEvent[];
}

export interface EventTracker {
  /** À appeler après chaque tick, dans l'ordre. */
  after(s: MatchState): TickEvents;
}

export function createEventTracker(s: MatchState): EventTracker {
  let lastShotId = s.counters[C.nextShot] - 1;
  // Projectiles du tick précédent (par identifiant) : position et direction.
  let flying = new Map<number, [number, number, number, number]>();
  const crateHp = Int32Array.from(s.crates);
  const abilityCd = Int32Array.from(s.p.abilityCd);

  return {
    after(st) {
      const S = st.s;
      const out: TickEvents = { shots: [], swings: [], impacts: [], crates: [] };

      // Projectiles en vol ; le premier projectile nouveau de chaque tireur donne l'arme du tir.
      let newest = lastShotId;
      const now = new Map<number, [number, number, number, number]>();
      const weaponOf = new Map<number, number>();
      for (let k = 0; k < st.shotCount; k++) {
        now.set(S.id[k], [S.x[k], S.y[k], S.vx[k], S.vy[k]]);
        if (S.id[k] <= lastShotId) continue;
        newest = Math.max(newest, S.id[k]);
        if (!weaponOf.has(S.owner[k])) weaponOf.set(S.owner[k], S.weapon[k]);
      }
      lastShotId = newest;

      // Tirs et coups de couteau : un par participant et par tick (les plombs d'un fusil à pompe ne font qu'un tir). Ils se
      // lisent sur le tireur, car un tir à bout portant peut avoir déjà disparu (arrêté dans le tick même où il est parti).
      const P = st.p;
      for (let i = 0; i < st.n; i++) {
        const activated = P.abilityCd[i] > abilityCd[i];
        abilityCd[i] = P.abilityCd[i];
        if (!P.alive[i] || P.lastShot[i] !== st.tick) continue;
        const inHand = weaponInHand(st, i);
        // Couteau en main : un coup, sauf si c'est une capacité qui tire (Rafale : arme de départ).
        if (inHand === KNIFE && !weaponOf.has(i) && !activated) {
          out.swings.push({ slot: i, aim: P.aim[i] });
          continue;
        }
        const weapon = weaponOf.get(i) ?? (inHand === KNIFE ? st.rules.startWeapon : inHand);
        const speed = st.rules.weapons[weapon].speed;
        const vx = Math.round((speed * icos(P.aim[i])) / Q14);
        const vy = Math.round((speed * isin(P.aim[i])) / Q14);
        out.shots.push({ owner: i, weapon, x: P.x[i], y: P.y[i], vx, vy });
        // Plus aucun projectile de ce tir : arrêté dès son premier pas (mur ou caisse tout près).
        if (!weaponOf.has(i)) impact(out, st, crateHp, P.x[i], P.y[i], vx, vy);
      }

      // Projectiles disparus : arrêtés par un mur ou une caisse sur leur dernier pas (sinon : portée atteinte ou personnage touché).
      for (const [id, [x, y, vx, vy]] of flying) {
        if (!now.has(id)) impact(out, st, crateHp, x, y, vx, vy);
      }
      flying = now;

      // Caisses abîmées ou brisées.
      const ts = st.map.tileSub;
      for (const t of st.crateTiles) {
        if (st.crates[t] === crateHp[t]) continue;
        out.crates.push({ tile: t, hp: st.crates[t], x: (t % st.map.size) * ts + ts / 2, y: Math.floor(t / st.map.size) * ts + ts / 2 });
        crateHp[t] = st.crates[t];
      }
      return out;
    },
  };
}

/** Un projectile parti de (x, y) pour un pas (vx, vy) s'est arrêté : impact sur le premier mur ou la première caisse du pas. */
function impact(out: TickEvents, st: MatchState, crateHp: Int32Array, x: number, y: number, vx: number, vy: number): void {
  const hit = segmentWallHit(st.map, x, y, x + vx, y + vy) ?? crateHitBefore(st, crateHp, x, y, vx, vy);
  if (hit) out.impacts.push({ x: x + (vx * hit.num) / hit.den, y: y + (vy * hit.num) / hit.den });
}

/** Une caisse brisée pendant ce tick est déjà du sol : on cherche l'impact sur la carte d'avant (caisses encore debout). */
function crateHitBefore(st: MatchState, crateHp: Int32Array, x: number, y: number, vx: number, vy: number): { num: number; den: number } | null {
  const ts = st.map.tileSub;
  const steps = Math.max(1, Math.ceil(Math.hypot(vx, vy) / (ts / 4)));
  for (let k = 1; k <= steps; k++) {
    const px = x + (vx * k) / steps;
    const py = y + (vy * k) / steps;
    const tx = Math.floor(px / ts);
    const ty = Math.floor(py / ts);
    if (tx < 0 || ty < 0 || tx >= st.map.size || ty >= st.map.size) return null;
    const t = ty * st.map.size + tx;
    if (crateHp[t] > 0 && st.crates[t] === 0) return { num: k, den: steps };
  }
  return null;
}
