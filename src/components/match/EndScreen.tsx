"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { buttonClass } from "@/components/ui/Button";
import type { RosterEntry } from "@/lib/br-client/training";
import { clock } from "./Hud";

export interface MatchResult {
  place: number;
  total: number;
  kills: number;
  damage: number;
  seconds: number;
  /** Éliminé par (emplacement), −1 : la Zone, −2 : personne (victoire). */
  killedBy: number;
}

/** Écran de fin : place, éliminations, dégâts, temps de survie, qui a éliminé le joueur, récompenses, Rejouer ou Retour. */
export function EndScreen({ result, roster, onReplay, onClose }: { result: MatchResult; roster: readonly RosterEntry[]; onReplay(): void; onClose(): void }) {
  const t = useTranslations("match.end");
  const tm = useTranslations("match");
  const format = useFormatter();
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);
  const killer = result.killedBy >= 0 ? roster[result.killedBy] : null;
  const won = result.place === 1;
  return (
    <div className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-ink/50 p-4" role="dialog" aria-modal="true" aria-labelledby="mm-match-end">
      <div className="grid w-full max-w-md gap-4 rounded-2xl border-2 border-ink bg-surface p-5 text-center text-ink shadow-[0_3px_0_0_var(--mm-shadow)]">
        <h2 id="mm-match-end" className="meme-caption text-5xl leading-none sm:text-6xl">
          {won ? t("victory") : t("place", { place: result.place })}
        </h2>
        <p className="-mt-2 font-bold text-ink-soft">{t("outOf", { total: result.total })}</p>
        <dl className="grid grid-cols-3 gap-2">
          {[
            [t("kills"), format.number(result.kills)],
            [t("damage"), format.number(result.damage)],
            [t("survived"), clock(result.seconds)],
          ].map(([label, value]) => (
            <div key={label} className="grid gap-0.5 rounded-xl bg-paper p-2">
              <dt className="text-xs font-bold text-ink-soft">{label}</dt>
              <dd className="font-display text-2xl leading-none">
                <bdi dir="ltr">{value}</bdi>
              </dd>
            </div>
          ))}
        </dl>
        {killer ? <p className="font-bold">{t("eliminatedBy", { name: killer.bot ? `${tm("bot")} · ${killer.name}` : killer.name })}</p> : null}
        {result.killedBy === -1 ? <p className="font-bold">{t("eliminatedByZone")}</p> : null}
        <div className="grid gap-1 rounded-xl border-2 border-ink bg-paper p-3">
          <p className="text-xs font-extrabold uppercase tracking-wide text-ink-soft">{t("rewards")}</p>
          <p className="font-bold">{t("noRewards")}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button ref={first} type="button" className={buttonClass("primary", "min-h-11 px-5")} onClick={onReplay}>
            {t("again")}
          </button>
          <button type="button" className={buttonClass("secondary", "min-h-11 px-5")} onClick={onClose}>
            {t("back")}
          </button>
        </div>
      </div>
    </div>
  );
}
