import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "@/config/game.config";
import { circleHitsSolid, ITEM } from "./map";
import { replayMatch } from "./replay";
import { resolveRules } from "./rules";
import { C, stateHash, Z, type MatchState } from "./state";
import { botSetup, playWithDriver } from "./test-driver";

/**
 * Butin total : au sol, porté, et consommé (soins, gilets, balles tirées, boissons et lunettes), moins ce que les
 * caisses brisées ont fait apparaître. Rien ne se crée ni ne disparaît hors règles.
 */
function lootTotals(s: MatchState): number[] {
  const P = s.p;
  const I = s.it;
  // [0] armes, [1] soins, [2] gilets, [3] munitions (chargeurs compris), [4] boissons, [5] lunettes, [6] boosters de portée.
  const totals = [0, 0, 0, 0, 0, 0, 0];
  const isAmmoWeapon = (weapon: number) => s.rules.weapons[weapon].ammo > 0;
  for (let k = 0; k < s.itemCount; k++) {
    if (I.kind[k] === ITEM.weapon) {
      totals[0]++;
      if (isAmmoWeapon(I.sub[k])) totals[3] += I.qty[k]; // le chargeur compte comme des munitions
    } else if (I.kind[k] === ITEM.heal) totals[1] += I.qty[k];
    else if (I.kind[k] === ITEM.vest) totals[2]++;
    else if (I.kind[k] === ITEM.ammo) totals[3] += I.qty[k];
    else if (I.kind[k] === ITEM.speed) totals[4]++;
    else if (I.kind[k] === ITEM.scope) totals[5]++;
    else if (I.kind[k] === ITEM.range) totals[6]++;
  }
  for (let i = 0; i < s.n; i++) {
    if (P.weapon0[i] >= 0) {
      totals[0]++;
      if (isAmmoWeapon(P.weapon0[i])) totals[3] += P.mag0[i];
    }
    if (P.weapon1[i] >= 0) {
      totals[0]++;
      if (isAmmoWeapon(P.weapon1[i])) totals[3] += P.mag1[i];
    }
    totals[3] += P.ammo[i];
  }
  totals[1] += s.counters[C.usedHeals];
  totals[2] += s.counters[C.usedVests];
  totals[3] += s.counters[C.firedAmmo];
  totals[4] += s.counters[C.usedBoosts] - s.counters[C.crateBoosts];
  totals[5] += s.counters[C.usedScopes] - s.counters[C.crateScopes];
  totals[6] += s.counters[C.usedRanges] - s.counters[C.crateRanges];
  totals[0] -= s.counters[C.crateWeapons];
  totals[1] -= s.counters[C.crateHeals];
  totals[2] -= s.counters[C.crateVests];
  totals[3] -= s.counters[C.crateAmmo];
  return totals;
}

describe("invariants d'une partie complète (1 joueur piloté, les autres bots)", () => {
  it("PV bornés, personne dans un mur, zone incluse dans la précédente, butin conservé ; toutes les places attribuées", () => {
    const rules = resolveRules(GAME_CONFIG.BATTLE_ROYALE);
    const n = rules.participants;
    const setup = botSetup(31337, rules, n);
    let start: number[] | null = null;
    let prev: number[] | null = null;
    let checks = 0;
    // Vérifications à chaque tick, sans expect() (des millions d'appels seraient trop lents) : on note la première anomalie.
    const problems: string[] = [];
    const note = (ok: boolean, what: string, s: MatchState) => {
      if (!ok && problems.length < 5) problems.push(`tick ${s.tick} : ${what}`);
    };
    const played = playWithDriver(setup, 5, {
      onTick: (s) => {
        start ??= lootTotals(s);
        const P = s.p;
        let alive = 0;
        for (let i = 0; i < s.n; i++) {
          note(P.hp[i] >= 0 && P.hp[i] <= s.fighters[i].maxHp, `PV hors bornes (${i})`, s);
          if (P.alive[i]) {
            alive++;
            note(!circleHitsSolid(s.map, P.x[i], P.y[i], s.fighters[i].radius), `participant ${i} dans un obstacle`, s);
          } else note(P.hp[i] === 0, `éliminé avec des PV (${i})`, s);
        }
        note(alive === s.aliveCount, "nombre de survivants", s);
        const zone = [s.zone[Z.cx], s.zone[Z.cy], s.zone[Z.r]];
        if (prev) note((zone[0] - prev[0]) ** 2 + (zone[1] - prev[1]) ** 2 <= (prev[2] - zone[2]) ** 2, "zone hors de la précédente", s);
        prev = zone;
        note(lootTotals(s).join() === start.join(), `butin non conservé : ${lootTotals(s).join()} au lieu de ${start.join()}`, s);
        checks++;
      },
    });
    expect(problems).toEqual([]);
    const s = played.state;
    expect(s.finished).toBe(true);
    expect(checks).toBe(s.tick);
    expect([...s.p.place].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
    expect(s.logCount).toBe(n - 1);
    // Durée d'une partie : jamais au-delà du filet de sécurité (durées mesurées par npm run bots:tournament).
    expect(s.tick).toBeLessThanOrEqual(rules.maxTicks);

    // Rejeu sans affichage : même partie, même journal ; arrêt anticipé dès l'élimination d'un participant.
    const replay = replayMatch(setup, played.inputs);
    expect(replay.hash).toBe(stateHash(s));
    expect(replay.result.log).toEqual(replay.result.log.slice());
    const victim = replay.result.log[Math.floor(n / 2)].victim;
    const early = replayMatch(setup, played.inputs, { stopWhenDead: victim });
    expect(early.result.places[victim]).toBe(s.p.place[victim]);
    expect(early.state.tick).toBe(s.p.deathTick[victim]);
  }, 120_000);
});
