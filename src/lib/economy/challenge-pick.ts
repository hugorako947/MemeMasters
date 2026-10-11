import { createHash } from "node:crypto";

/**
 * Tirage du défi du jour : au hasard, mais stable pour un joueur et un jour
 * donnés (le même toute la journée), pondéré, et différent de celui de la veille.
 */
export function pickTemplate<T extends { id: string; weight: number }>(templates: T[], playerId: string, day: string, yesterdayId: string | null): T | null {
  const pool = templates.length > 1 && yesterdayId ? templates.filter((t) => t.id !== yesterdayId) : templates;
  if (pool.length === 0) return null;
  const total = pool.reduce((n, t) => n + t.weight, 0);
  const h = createHash("sha256").update(`${playerId}:${day}`).digest().readUInt32BE(0);
  let roll = h % total;
  for (const t of pool) {
    if (roll < t.weight) return t;
    roll -= t.weight;
  }
  return pool[pool.length - 1];
}
