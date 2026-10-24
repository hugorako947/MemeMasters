/**
 * Générateur pseudo-aléatoire du moteur : xoshiro128** (entiers 32 bits), avec
 * un flux séparé par usage (carte, butin, zone, combats, chaque bot). Un tirage
 * dans un flux ne décale jamais les autres : ajouter un tir ne change pas la carte.
 * L'état (4 mots par flux) fait partie de l'état de la partie.
 * Réservé au moteur : les illustrations ont leur propre générateur (src/lib/art/prng.ts).
 */
import { scaleU32 } from "./fixed";

export const STREAM = {
  map: 0,
  loot: 1,
  zone: 2,
  combat: 3,
  /** Premier flux des bots : le bot de l'emplacement i utilise le flux bot0 + i. */
  bot0: 4,
} as const;

/** splitmix32 : mélange d'un entier, pour dériver l'état de chaque flux à partir de la graine. */
function splitmix32(x: number): number {
  let t = (x + 0x9e3779b9) | 0;
  t = Math.imul(t ^ (t >>> 16), 0x21f0aaad);
  t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
  return (t ^ (t >>> 15)) >>> 0;
}

/** États de `count` flux (4 mots de 32 bits chacun) dérivés de la graine de la partie. */
export function createStreams(seed: number, count: number): Uint32Array {
  const state = new Uint32Array(count * 4);
  for (let s = 0; s < count; s++) {
    let x = (seed ^ Math.imul(s + 1, 0x85ebca6b)) | 0;
    for (let w = 0; w < 4; w++) {
      x = splitmix32(x);
      state[s * 4 + w] = x;
    }
    // Un état entièrement nul bloquerait le générateur.
    if ((state[s * 4] | state[s * 4 + 1] | state[s * 4 + 2] | state[s * 4 + 3]) === 0) state[s * 4] = 1;
  }
  return state;
}

const rotl = (x: number, k: number) => (x << k) | (x >>> (32 - k));

/** Entier uniforme 32 bits (0 … 2^32 − 1) tiré dans le flux `stream`. */
export function nextU32(state: Uint32Array, stream: number): number {
  const o = stream * 4;
  const s0 = state[o];
  const s1 = state[o + 1];
  const s2 = state[o + 2];
  const s3 = state[o + 3];
  const result = Math.imul(rotl(Math.imul(s1, 5), 7), 9) >>> 0;
  const t = s1 << 9;
  const n2 = s2 ^ s0;
  const n3 = s3 ^ s1;
  state[o + 1] = s1 ^ n2;
  state[o] = s0 ^ n3;
  state[o + 2] = n2 ^ t;
  state[o + 3] = rotl(n3, 11);
  return result;
}

/** Entier uniforme dans [0, n), 1 ≤ n ≤ 2^21. */
export function nextBelow(state: Uint32Array, stream: number, n: number): number {
  return scaleU32(nextU32(state, stream), n);
}

/** Entier uniforme dans [lo, hi] (bornes comprises). */
export function nextRange(state: Uint32Array, stream: number, lo: number, hi: number): number {
  return lo + nextBelow(state, stream, hi - lo + 1);
}

/** Vrai avec une probabilité de `permille` pour mille. */
export function chance(state: Uint32Array, stream: number, permille: number): boolean {
  return nextBelow(state, stream, 1000) < permille;
}
