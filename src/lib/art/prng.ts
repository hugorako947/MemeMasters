/**
 * Générateur pseudo-aléatoire déterministe (mulberry32), réservé au visuel :
 * une même graine donne toujours la même illustration.
 * NE PAS utiliser pour le tirage des boosters ni les combats.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)];
}

export function between(rand: () => number, min: number, max: number): number {
  return min + rand() * (max - min);
}
