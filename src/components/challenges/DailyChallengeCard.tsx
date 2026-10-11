"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { postJson } from "@/lib/client/api";
import type { DailyChallenge } from "@/lib/server/challenges";

const DIFFICULTY_STYLE = {
  easy: "bg-[#c9f2d8] text-[#0b5d33]",
  medium: "bg-[#fff1b8] text-[#6b4b00]",
  hard: "bg-[#ffd3dc] text-[#8a0f2c]",
} as const;

/** Défi du jour : mission, progression et récompense (des boosters en plus). */
export function DailyChallengeCard({ challenge }: { challenge: DailyChallenge }) {
  const t = useTranslations("challenge");
  const te = useTranslations("errors");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ratio = Math.min(1, challenge.progress / challenge.target);

  async function claim() {
    setPending(true);
    setError(null);
    const res = await postJson("/api/challenges/claim", {});
    setPending(false);
    if (res.ok) router.refresh();
    else setError(te(res.code as "server_error"));
  }

  return (
    <section className="grid gap-3 rounded-2xl border-2 border-ink bg-surface p-4" aria-labelledby="defi-du-jour">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="defi-du-jour" className="font-display text-2xl leading-none">
          {t("title")}
        </h3>
        <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${DIFFICULTY_STYLE[challenge.difficulty]}`}>{t(`difficulty.${challenge.difficulty}`)}</span>
      </div>
      <p className="font-semibold">{t(`types.${challenge.type}`, { count: challenge.target })}</p>
      <div className="grid gap-1">
        <div
          className="h-3 overflow-hidden rounded-full border-2 border-ink bg-paper"
          role="progressbar"
          aria-label={t("title")}
          aria-valuemin={0}
          aria-valuemax={challenge.target}
          aria-valuenow={challenge.progress}
        >
          <div className="h-full bg-candy transition-[width] duration-500" style={{ width: `${ratio * 100}%` }} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-bold">
            {challenge.progress} / {challenge.target}
          </span>
          <span className="text-ink-soft">{t("reward", { count: challenge.reward })}</span>
        </div>
      </div>
      {challenge.claimed ? (
        <p className="rounded-xl bg-paper px-3 py-2 text-sm font-bold">{t("claimed")}</p>
      ) : challenge.completed ? (
        <button type="button" onClick={claim} disabled={pending} className="mm-btn mm-btn--primary mm-online-only justify-self-start px-6">
          {t("claim", { count: challenge.reward })}
        </button>
      ) : null}
      {error ? <p className="text-sm font-bold text-danger">{error}</p> : null}
    </section>
  );
}
