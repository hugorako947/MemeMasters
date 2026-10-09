"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { RankShield, TrophyIcon } from "@/components/player/RankBadge";
import { rankFor } from "@/config/ranks";
import type { Leaderboard, LeaderboardScope } from "@/lib/server/leaderboard";

const SCOPES: LeaderboardScope[] = ["around", "rank", "world"];

/** Classement des joueurs : le joueur choisit la portée (autour de lui, son rang, le monde). */
export function LeaderboardPanel({
  boards,
  rankName,
  window,
}: {
  boards: Record<LeaderboardScope, Leaderboard>;
  rankName: string;
  window: number;
}) {
  const t = useTranslations("infos.leaderboard");
  const tr = useTranslations("rank");
  const format = useFormatter();
  const [scope, setScope] = useState<LeaderboardScope>("around");
  const board = boards[scope];
  const caption = scope === "around" ? t("around", { window }) : scope === "rank" ? t("rank", { rank: rankName }) : t("world");

  return (
    <section className="grid gap-4 rounded-[1.75rem] border-2 border-ink bg-surface p-4 shadow-[0_3px_0_0_var(--mm-shadow)] sm:p-6">
      <div role="radiogroup" aria-label={t("scopeLabel")} className="flex flex-wrap justify-center gap-2">
        {SCOPES.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={scope === s}
            onClick={() => setScope(s)}
            className={`min-h-10 rounded-full border-2 border-ink px-4 text-sm font-bold transition-colors ${
              scope === s ? "bg-ink text-surface" : "bg-surface hover:bg-paper"
            }`}
          >
            {t(`scopes.${s}`)}
          </button>
        ))}
      </div>
      <div className="text-center">
        <p className="font-extrabold">{caption}</p>
        <p className="text-sm text-ink-soft">
          {t("position", { position: format.number(board.position), total: format.number(board.total) })}
        </p>
      </div>
      {board.rows.length <= 1 ? <p className="text-center text-sm text-ink-soft">{t("empty")}</p> : null}
      <ol className="grid gap-1.5">
        {board.rows.map((row) => {
          const rank = rankFor(row.trophies);
          return (
            <li
              key={`${scope}-${row.username}`}
              className={`grid grid-cols-[2.75rem_auto_1fr_auto] items-center gap-3 rounded-xl px-3 py-2 ${
                row.isMe ? "border-2 border-candy bg-[color-mix(in_srgb,var(--color-candy),transparent_88%)]" : "bg-paper"
              }`}
            >
              <span className="text-center font-display text-xl">{row.position}</span>
              <RankShield rank={rank} size={22} />
              <span className="flex min-w-0 items-center gap-2">
                <Link href={`/profil/${encodeURIComponent(row.username)}`} className="inline-flex min-h-10 min-w-0 items-center truncate font-bold hover:underline" title={tr(rank)}>
                  {row.username}
                </Link>
                {row.isMe ? (
                  <span className="shrink-0 rounded-full bg-candy px-2 py-0.5 text-xs font-extrabold text-[var(--mm-accent-ink)]">{t("you")}</span>
                ) : null}
              </span>
              <span className="flex items-center gap-1 font-display text-lg">
                <TrophyIcon size={15} />
                {format.number(row.trophies)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
