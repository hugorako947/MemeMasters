/**
 * Banc d'essai du moteur du battle royale (phase 1) : joue des parties complètes à
 * 100 participants avec le pilote de test, puis les rejoue sans affichage.
 * Usage : npm run br:bench [-- nombre_de_parties]   (5 par défaut)
 *
 * Affiche : durée des parties, coût moyen et 99e centile d'un tick, temps de rejeu,
 * part des éliminations par la zone. Le pilote de test n'est pas l'IA des bots : les
 * durées et causes d'élimination seront mesurées avec les vrais bots en phase 2
 * (npm run bots:tournament).
 */
import { performance } from "node:perf_hooks";
import { GAME_CONFIG } from "../src/config/game.config";
import { replayMatch } from "../src/lib/br/replay";
import { resolveRules } from "../src/lib/br/rules";
import { KILL_ZONE, stateHash } from "../src/lib/br/state";
import { playWithDriver, sampleCharacters } from "../src/lib/br/test-driver";

const games = Number(process.argv[2] ?? 5);
const rules = resolveRules(GAME_CONFIG.BATTLE_ROYALE);
const ticks: number[] = [];
const replays: number[] = [];
let zoneKills = 0;
let kills = 0;
let mismatches = 0;
const durations: number[] = [];

for (let g = 0; g < games; g++) {
  const seed = 1000 + g;
  const setup = { seed, rules, characters: sampleCharacters(rules.participants, seed) };
  const times: number[] = [];
  const played = playWithDriver(setup, seed, { timer: () => performance.now(), times });
  ticks.push(...times);
  const t0 = performance.now();
  const replay = replayMatch(setup, played.inputs);
  replays.push(performance.now() - t0);
  if (replay.hash !== stateHash(played.state)) mismatches++;
  durations.push(played.state.tick / rules.tickRate);
  for (const entry of replay.result.log) {
    kills++;
    if (entry.cause === KILL_ZONE) zoneKills++;
  }
  process.stdout.write(`partie ${g + 1}/${games} : ${(played.state.tick / rules.tickRate / 60).toFixed(1)} min, rejeu ${(replays.at(-1)! / 1000).toFixed(2)} s\n`);
}

const sorted = [...ticks].sort((a, b) => a - b);
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
console.log(`
Parties : ${games} × ${rules.participants} participants (pilote de test, pas les bots)
Durée moyenne       : ${(mean(durations) / 60).toFixed(2)} min
Tick moyen          : ${mean(ticks).toFixed(3)} ms (seuil 2 ms)
Tick, 99e centile   : ${sorted[Math.floor(sorted.length * 0.99)].toFixed(3)} ms (seuil 5 ms)
Rejeu d'une partie  : ${(mean(replays) / 1000).toFixed(2)} s en moyenne, ${(Math.max(...replays) / 1000).toFixed(2)} s au pire
Éliminations zone   : ${((100 * zoneKills) / Math.max(1, kills)).toFixed(1)} %
Rejeux différents   : ${mismatches} (doit être 0)
`);
process.exit(mismatches === 0 ? 0 : 1);
