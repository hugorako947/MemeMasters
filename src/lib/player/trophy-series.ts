/**
 * Prépare les points du graphique de trophées pour une période donnée.
 * Fonction pure (testée) : le composant n'a plus qu'à dessiner.
 */
import { rankIndex } from "@/config/ranks";

export const PERIODS = ["7d", "30d", "90d", "365d", "all"] as const;
export type Period = (typeof PERIODS)[number];

const DAY = 86_400_000;
const PERIOD_MS: Record<Exclude<Period, "all">, number> = { "7d": 7 * DAY, "30d": 30 * DAY, "90d": 90 * DAY, "365d": 365 * DAY };

export interface SeriesPoint {
  at: number;
  trophies: number;
}

export interface TrophySeries {
  from: number;
  to: number;
  points: SeriesPoint[];
  /** Moments où un nouveau rang est atteint (pastilles sur la courbe). */
  rankUps: SeriesPoint[];
  /** Haut de l'axe : multiple de 1 000 au-dessus du maximum (au moins 1 000). */
  yMax: number;
  /** Nombre de changements dans la période (0 = courbe plate). */
  changes: number;
}

export function buildTrophySeries(
  history: ReadonlyArray<{ at: string; trophies: number }>,
  current: number,
  since: string,
  period: Period,
  now: number,
): TrophySeries {
  const start = Date.parse(since);
  const from = period === "all" ? Math.min(start, now - DAY) : Math.max(now - PERIOD_MS[period], Math.min(start, now - DAY));
  const sorted = history.map((h) => ({ at: Date.parse(h.at), trophies: h.trophies })).sort((a, b) => a.at - b.at);
  const before = sorted.filter((p) => p.at < from).at(-1);
  const inside = sorted.filter((p) => p.at >= from && p.at <= now);

  const points: SeriesPoint[] = [{ at: from, trophies: before?.trophies ?? inside[0]?.trophies ?? current }];
  for (const p of inside) points.push(p);
  points.push({ at: now, trophies: current });

  const rankUps: SeriesPoint[] = [];
  let best = rankIndex(points[0].trophies);
  for (const p of points.slice(1)) {
    const r = rankIndex(p.trophies);
    if (r > best) {
      rankUps.push(p);
      best = r;
    }
  }
  const max = Math.max(...points.map((p) => p.trophies));
  const yMax = Math.max(1000, Math.ceil((max + 1) / 1000) * 1000);
  const changes = points.slice(1).filter((p, i) => p.trophies !== points[i].trophies).length;
  return { from, to: now, points, rankUps, yMax, changes };
}

export type TickUnit = "day" | "month" | "year";

/**
 * Graduations de l'axe du temps, adaptées à la durée affichée :
 * jours (≤ 10 j), semaines (≤ 2 mois), mois (≤ 13 mois), puis trimestres.
 */
export function timeTicks(from: number, to: number): Array<{ at: number; unit: TickUnit }> {
  const days = (to - from) / DAY;
  const ticks: Array<{ at: number; unit: TickUnit }> = [];
  if (days <= 60) {
    const step = days <= 10 ? Math.max(1, Math.ceil(days / 7)) : 7;
    const start = new Date(from);
    start.setUTCHours(0, 0, 0, 0);
    for (let t = start.getTime() + DAY; t < to; t += step * DAY) ticks.push({ at: t, unit: "day" });
    return ticks;
  }
  const monthsStep = days <= 400 ? (days <= 120 ? 1 : 2) : 3;
  const d = new Date(from);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCMonth(d.getUTCMonth() + 1);
  while (d.getTime() < to) {
    ticks.push({ at: d.getTime(), unit: days > 400 && d.getUTCMonth() === 0 ? "year" : "month" });
    d.setUTCMonth(d.getUTCMonth() + monthsStep);
  }
  return ticks;
}
