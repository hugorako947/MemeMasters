"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { RANK_COLORS, RANKS } from "@/config/ranks";
import type { TrophyPoint } from "@/lib/server/players";
import { buildTrophySeries, PERIODS, type Period } from "@/lib/player/trophy-series";

const W = 640;
const H = 280;
const M = { top: 12, right: 12, bottom: 30, left: 52 };

/**
 * Courbe des trophées dans le temps, sur fond des bandes de rang.
 * Le joueur choisit la période (7 jours, 30 jours, 3 mois, 1 an, tout).
 */
export function TrophyChart({
  history,
  trophies,
  since,
  asOf,
}: {
  history: TrophyPoint[];
  trophies: number;
  since: string;
  /** Instant de référence fourni par le serveur (évite un décalage à l'hydratation). */
  asOf: string;
}) {
  const t = useTranslations("profile.chart");
  const tr = useTranslations("rank");
  const format = useFormatter();
  const [period, setPeriod] = useState<Period>("30d");
  const now = Date.parse(asOf);
  const series = useMemo(() => buildTrophySeries(history, trophies, since, period, now), [history, trophies, since, period, now]);

  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const x = (ms: number) => M.left + ((ms - series.from) / Math.max(1, series.to - series.from)) * plotW;
  const y = (v: number) => M.top + plotH - (v / series.yMax) * plotH;

  // Courbe en escalier : les trophées changent à chaque bataille.
  const path = series.points
    .map((p, i) => (i === 0 ? `M${x(p.at)} ${y(p.trophies)}` : `H${x(p.at)} V${y(p.trophies)}`))
    .join(" ");
  const bands = Array.from({ length: series.yMax / 1000 }, (_, i) => i);
  const dateFmt = (ms: number) => format.dateTime(new Date(ms), { day: "numeric", month: "short" });
  const first = series.points[0]?.trophies ?? trophies;
  const last = series.points.at(-1)?.trophies ?? trophies;

  return (
    <div className="grid gap-3">
      <div role="radiogroup" aria-label={t("periodLabel")} className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={period === p}
            onClick={() => setPeriod(p)}
            className={`min-h-10 rounded-full border-2 border-ink px-3.5 text-sm font-bold transition-colors ${
              period === p ? "bg-ink text-surface" : "bg-surface hover:bg-paper"
            }`}
          >
            {t(`period.${p}`)}
          </button>
        ))}
      </div>

      <div className="mm-keep-colors overflow-hidden rounded-2xl border-2 border-[#1a1238] bg-white">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={t("summary", { from: first, to: last })}>
          {bands.map((i) => {
            const rank = RANKS[Math.min(i, RANKS.length - 1)];
            return (
              <g key={i}>
                <rect x={M.left} y={y((i + 1) * 1000)} width={plotW} height={y(i * 1000) - y((i + 1) * 1000)} fill={RANK_COLORS[rank].fill} opacity={0.14} />
                <text x={M.left + plotW - 6} y={y((i + 1) * 1000) + 16} textAnchor="end" fontSize="12" fontWeight="700" fill="#4a4270">
                  {tr(rank)}
                </text>
                <text x={M.left - 8} y={y(i * 1000) + 4} textAnchor="end" fontSize="11" fill="#4a4270">
                  {i * 1000}
                </text>
              </g>
            );
          })}
          <line x1={M.left} x2={M.left} y1={M.top} y2={M.top + plotH} stroke="#1a1238" strokeWidth="1.5" />
          <line x1={M.left} x2={M.left + plotW} y1={M.top + plotH} y2={M.top + plotH} stroke="#1a1238" strokeWidth="1.5" />
          <path d={path} fill="none" stroke="#ff3d7f" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
          {series.rankUps.map((p) => (
            <circle key={p.at} cx={x(p.at)} cy={y(p.trophies)} r="6" fill="#ffd23f" stroke="#1a1238" strokeWidth="2" />
          ))}
          <text x={M.left} y={H - 8} fontSize="11" fill="#4a4270">
            {dateFmt(series.from)}
          </text>
          <text x={M.left + plotW} y={H - 8} textAnchor="end" fontSize="11" fill="#4a4270">
            {t("now")}
          </text>
        </svg>
      </div>
      <p className="text-sm text-ink-soft">{series.changes === 0 ? t("empty") : t("legend")}</p>
    </div>
  );
}
