/**
 * Rejeu d'une partie sans affichage : mêmes réglages (graine, personnages, règles) et
 * mêmes commandes enregistrées → exactement la même partie. C'est ainsi que le serveur
 * vérifiera une partie classée (phase 4) : il rejoue les commandes reçues et calcule
 * lui-même la place, les éliminations et les récompenses ; le client ne décide jamais.
 */
import { advance, createMatch, matchResult, type MatchResult, type MatchSetup } from "./engine";
import { stateHash, type MatchState } from "./state";

export interface ReplayOptions {
  /** Arrêter dès que ce participant est éliminé (sa place est alors connue). */
  stopWhenDead?: number;
  /** Nombre maximal de ticks à rejouer. */
  maxTicks?: number;
}

export interface ReplayOutcome {
  state: MatchState;
  result: MatchResult;
  /** Empreinte de l'état final. */
  hash: string;
}

/**
 * Rejoue une partie. `inputs` : pour chaque emplacement piloté de l'extérieur, ses commandes
 * tick par tick (au-delà de la fin enregistrée, le participant reste immobile).
 */
export function replayMatch(setup: MatchSetup, inputs: ReadonlyMap<number, ArrayLike<number>>, options: ReplayOptions = {}): ReplayOutcome {
  const state = createMatch(setup);
  const commands = new Uint32Array(state.n);
  const limit = options.maxTicks ?? state.rules.maxTicks;
  const watched = options.stopWhenDead;
  while (!state.finished && state.tick < limit) {
    const t = state.tick;
    commands.fill(0);
    for (const [slot, stream] of inputs) commands[slot] = t < stream.length ? stream[t] : 0;
    advance(state, commands);
    if (watched !== undefined && state.p.alive[watched] === 0) break;
  }
  return { state, result: matchResult(state), hash: stateHash(state) };
}
