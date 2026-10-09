/**
 * Bot d'entraînement : décide quand et où poser une carte. Il a son propre
 * générateur aléatoire (il ne touche pas à celui de la partie) et réagit
 * avec un léger temps de retard, comme un humain.
 */
import { deploy, other, type BattleState, type Side } from "./engine";
import { ARENA } from "./rules";

export interface Bot {
  side: Side;
  rng: number;
  nextThink: number;
}

export function createBot(side: Side, seed: number): Bot {
  return { side, rng: seed ^ 0x5bd1e995, nextThink: 40 };
}

function rand(bot: Bot): number {
  let t = (bot.rng = (bot.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** À appeler à chaque tick, avant step(). Pose au plus une carte. */
export function botAct(state: BattleState, bot: Bot): void {
  if (state.phase === "ended" || state.tick < bot.nextThink) return;
  bot.nextThink = state.tick + 10 + Math.floor(rand(bot) * 20);
  const me = state.sides[bot.side];
  const enemy = other(bot.side);
  const home = (y: number) => (bot.side === "b" ? y : ARENA.H - y);
  // Menace : unité adverse arrivée dans notre moitié.
  const threat = state.units
    .filter((u) => u.side === enemy && (bot.side === "b" ? u.y < ARENA.RIVER_BOTTOM : u.y > ARENA.RIVER_TOP))
    .sort((a, b) => (bot.side === "b" ? a.y - b.y : b.y - a.y))[0];
  const affordable = me.hand.map((id, slot) => ({ slot, cost: state.templates[id].cost })).filter((c) => c.cost * 1_000 <= me.energy);
  if (affordable.length === 0) return;
  if (threat) {
    const pick = affordable[Math.floor(rand(bot) * affordable.length)];
    const y = bot.side === "b" ? Math.min(threat.y - 1_500, ARENA.RIVER_TOP - 600) : Math.max(threat.y + 1_500, ARENA.RIVER_BOTTOM + 600);
    deploy(state, bot.side, pick.slot, Math.max(800, Math.min(ARENA.W - 800, threat.x)), Math.max(600, Math.min(ARENA.H - 600, y)));
    return;
  }
  // Sinon, attaque quand l'énergie est haute : derrière une tour, dans un couloir au hasard.
  if (me.energy < 7_000) return;
  const pick = affordable.sort((a, b) => b.cost - a.cost)[0];
  const lane = rand(bot) < 0.5 ? ARENA.BRIDGES[0] : ARENA.BRIDGES[1];
  deploy(state, bot.side, pick.slot, lane, home(4_000 + Math.floor(rand(bot) * 6_000)));
}
