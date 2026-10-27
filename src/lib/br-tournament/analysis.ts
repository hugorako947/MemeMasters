/**
 * Indicateurs du banc d'essai des bots et seuils de la conception validée (§7.7) :
 * moyennes et intervalles de confiance à 95 %, verdict de chaque seuil.
 *
 * Règle de jugement (choix technique de la phase 2) : chaque seuil est jugé sur la valeur mesurée,
 * avec assez de parties pour que le hasard seul ne le fasse pas échouer (environ 3 600 parties).
 * En mode rapide (--rapide), les indicateurs qui demandent beaucoup de parties (taux par carte,
 * rapports de rareté et d'évolution) sont seulement indicatifs.
 */
import type { GameReport } from "./game";

/** Seuils de la conception (§7.7), validés par le propriétaire le 2026-10-24. */
export const THRESHOLDS = {
  /** Durée moyenne d'une partie, en minutes (plancher assoupli de 5 à 3,7 le 2026-10-27 : le modèle 3A est plus nerveux ; parties ≈ 3,8 min après avoir calmé la méga-mitraillette et réduit les munitions). */
  durationMin: [3.7, 8] as const,
  /** Part des éliminations dues à la zone, en %. */
  zoneMaxPercent: 15,
  /** Part des bots restés immobiles plus de 10 s (hors couverture ou soin), en %. */
  idleMaxPercent: 1,
  /** Bots coincés non résolus (3 s sans avancer en voulant avancer). */
  stuckMax: 0,
  /** Taux de Top 1 de chaque carte jouée au moins cardMinPlays fois, en % (attendu : 2 % à 50 participants ; plage du 2026-10-26). */
  cardTop1Percent: [1, 4] as const,
  cardMinPlays: 2000,
  /** Godlevel / commune (Top 1, à évolution égale). */
  rarityMaxRatio: 1.3,
  /** Divine (dernière évolution) / sans évolution (même carte). */
  evolutionMaxRatio: 1.15,
  /** Temps moyen d'un tick (Node), en ms. */
  tickMeanMs: 2,
} as const;

const Z = 1.96;

/** Intervalle de Wilson à 95 % d'une proportion. */
export function wilson(successes: number, n: number): [number, number] {
  if (n === 0) return [0, 1];
  const p = successes / n;
  const z2 = Z * Z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (Z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

/** Rapport des victoires de deux groupes de même taille (a / b), avec son intervalle (Wilson sur a / (a + b)). */
export function ratioOfWins(a: number, b: number): { ratio: number; lo: number; hi: number } {
  if (a + b === 0) return { ratio: 1, lo: 0, hi: Infinity };
  const [plo, phi] = wilson(a, a + b);
  const toRatio = (p: number) => (p >= 1 ? Infinity : p / (1 - p));
  return { ratio: b === 0 ? Infinity : a / b, lo: toRatio(plo), hi: toRatio(phi) };
}

/** Moyenne et intervalle à 95 % (approximation normale). */
export function meanInterval(values: readonly number[]): { mean: number; lo: number; hi: number } {
  const n = values.length;
  if (n === 0) return { mean: NaN, lo: NaN, hi: NaN };
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = n > 1 ? values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
  const half = Z * Math.sqrt(variance / n);
  return { mean, lo: mean - half, hi: mean + half };
}

export interface Indicator {
  key: "duration" | "zone" | "idle" | "stuck" | "cards" | "rarity" | "evolution" | "tick";
  label: string;
  value: number;
  lo?: number;
  hi?: number;
  /** Seuil, en clair. */
  threshold: string;
  ok: boolean;
  /** Fait échouer le banc d'essai s'il n'est pas tenu. */
  blocking: boolean;
  note?: string;
}

export interface CardRow {
  /** Indice de la carte dans le jeu de départ. */
  card: number;
  plays: number;
  top1: number;
  top1Rate: number;
  lo: number;
  hi: number;
  meanPlace: number;
}

export interface Analysis {
  games: Record<GameReport["series"], number>;
  indicators: Indicator[];
  cards: CardRow[];
  /** Série normale : place moyenne et taux de Top 10 par niveau d'évolution (0 à 3). */
  byEvolution: { evolution: number; plays: number; meanPlace: number; top10Rate: number }[];
  /** Durée moyenne et part de la zone par tranche de niveau des bots (0–3, 4–6, 7–10). */
  byLevel: { band: string; games: number; minutes: number; zonePercent: number }[];
  ok: boolean;
}

/** Calcule les indicateurs à partir des parties jouées. `tickMeanMs` : coût moyen d'un tick, mesuré à part (sans parallélisme). */
export function analyse(reports: readonly GameReport[], options: { quick: boolean; tickMeanMs: number }): Analysis {
  const T = THRESHOLDS;
  const standard = reports.filter((r) => r.series === "standard");
  const all = reports;
  const indicators: Indicator[] = [];

  // Durée, zone, immobiles, coincés : toutes les parties (les trois séries jouent les mêmes règles).
  const minutes = meanInterval(all.map((r) => r.minutes));
  indicators.push({
    key: "duration",
    label: "Durée moyenne d'une partie (min)",
    value: minutes.mean,
    lo: minutes.lo,
    hi: minutes.hi,
    threshold: `entre ${T.durationMin[0]} et ${T.durationMin[1]}`,
    ok: minutes.mean >= T.durationMin[0] && minutes.mean <= T.durationMin[1],
    blocking: true,
  });
  const kills = all.reduce((s, r) => s + r.kills, 0);
  const zoneKills = all.reduce((s, r) => s + r.zoneKills, 0);
  const [zlo, zhi] = wilson(zoneKills, kills);
  const zonePercent = kills ? (100 * zoneKills) / kills : 0;
  indicators.push({
    key: "zone",
    label: "Éliminations dues à la zone (%)",
    value: zonePercent,
    lo: 100 * zlo,
    hi: 100 * zhi,
    threshold: `≤ ${T.zoneMaxPercent}`,
    ok: zonePercent <= T.zoneMaxPercent,
    blocking: true,
  });
  const bots = all.reduce((s, r) => s + r.places.length, 0);
  const idle = all.reduce((s, r) => s + r.idleBots, 0);
  const idlePercent = bots ? (100 * idle) / bots : 0;
  indicators.push({ key: "idle", label: "Bots immobiles plus de 10 s (%)", value: idlePercent, threshold: `≤ ${T.idleMaxPercent}`, ok: idlePercent <= T.idleMaxPercent, blocking: true });
  const stuck = all.reduce((s, r) => s + r.stuckEpisodes, 0);
  const unstuck = all.reduce((s, r) => s + r.unstickEpisodes, 0);
  indicators.push({
    key: "stuck",
    label: "Bots coincés non résolus (3 s)",
    value: stuck,
    threshold: `= ${T.stuckMax}`,
    ok: stuck <= T.stuckMax,
    blocking: true,
    note: `${unstuck} blocages d'une seconde résolus par l'anti-blocage`,
  });

  // Taux de Top 1 par carte (série normale).
  const rows = new Map<number, { plays: number; top1: number; placeSum: number }>();
  for (const r of standard) {
    r.cards.forEach((card, slot) => {
      const row = rows.get(card) ?? { plays: 0, top1: 0, placeSum: 0 };
      row.plays++;
      row.placeSum += r.places[slot];
      if (r.places[slot] === 1) row.top1++;
      rows.set(card, row);
    });
  }
  const cards: CardRow[] = [...rows.entries()]
    .map(([card, row]) => {
      const [lo, hi] = wilson(row.top1, row.plays);
      return { card, plays: row.plays, top1: row.top1, top1Rate: row.top1 / row.plays, lo, hi, meanPlace: row.placeSum / row.plays };
    })
    .sort((a, b) => b.top1Rate - a.top1Rate || a.card - b.card);
  const eligible = cards.filter((c) => c.plays >= T.cardMinPlays);
  const outside = eligible.filter((c) => 100 * c.top1Rate < T.cardTop1Percent[0] || 100 * c.top1Rate > T.cardTop1Percent[1]);
  indicators.push({
    key: "cards",
    label: "Cartes hors de la plage de Top 1",
    value: outside.length,
    threshold: `aucune hors de ${T.cardTop1Percent[0]} – ${T.cardTop1Percent[1]} % (cartes jouées ≥ ${T.cardMinPlays} fois)`,
    ok: outside.length === 0,
    blocking: !options.quick && eligible.length > 0,
    note: eligible.length ? `${eligible.length} cartes jugées` : "aucune carte n'a assez de parties",
  });

  // Séries de comparaison : groupe A aux emplacements 0 à 49, groupe B aux emplacements 50 à 99.
  const compare = (series: "rarity" | "evolution", key: "rarity" | "evolution", label: string, max: number) => {
    const games = reports.filter((r) => r.series === series);
    let a = 0;
    let b = 0;
    for (const r of games) {
      const winner = r.places.indexOf(1);
      if (winner < 0) continue;
      if (winner < r.places.length / 2) a++;
      else b++;
    }
    const { ratio, lo, hi } = ratioOfWins(a, b);
    indicators.push({
      key,
      label,
      value: games.length ? ratio : NaN,
      lo,
      hi,
      threshold: `≤ ${max}`,
      ok: games.length === 0 || ratio <= max,
      blocking: !options.quick && games.length > 0,
      note: games.length ? `${a} victoires contre ${b} sur ${games.length} parties` : "série non jouée",
    });
  };
  compare("rarity", "rarity", "Top 1 godlevel / commune (évolution égale)", T.rarityMaxRatio);
  compare("evolution", "evolution", "Top 1 Divine / sans évolution (même carte)", T.evolutionMaxRatio);

  indicators.push({
    key: "tick",
    label: "Temps moyen d'un tick (ms)",
    value: options.tickMeanMs,
    threshold: `≤ ${T.tickMeanMs}`,
    ok: options.tickMeanMs <= T.tickMeanMs,
    blocking: true,
  });

  const byEvolution = [0, 1, 2, 3, 4].map((evolution) => {
    let plays = 0;
    let placeSum = 0;
    let top10 = 0;
    for (const r of standard) {
      r.evolutions.forEach((e, slot) => {
        if (e !== evolution) return;
        plays++;
        placeSum += r.places[slot];
        if (r.places[slot] <= 10) top10++;
      });
    }
    return { evolution, plays, meanPlace: plays ? placeSum / plays : NaN, top10Rate: plays ? top10 / plays : NaN };
  });
  const bands: [string, number, number][] = [
    ["0 à 3", 0, 39],
    ["4 à 6", 40, 69],
    ["7 à 10", 70, 100],
  ];
  const byLevel = bands.map(([band, lo, hi]) => {
    const games = all.filter((r) => r.level >= lo && r.level <= hi);
    const k = games.reduce((s, r) => s + r.kills, 0);
    return {
      band,
      games: games.length,
      minutes: games.length ? games.reduce((s, r) => s + r.minutes, 0) / games.length : NaN,
      zonePercent: k ? (100 * games.reduce((s, r) => s + r.zoneKills, 0)) / k : NaN,
    };
  });

  return {
    games: { standard: standard.length, rarity: reports.filter((r) => r.series === "rarity").length, evolution: reports.filter((r) => r.series === "evolution").length },
    indicators,
    cards,
    byEvolution,
    byLevel,
    ok: indicators.every((x) => x.ok || !x.blocking),
  };
}
