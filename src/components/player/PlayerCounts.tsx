"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

/**
 * Nombre de comptes et de joueurs en ligne, mis à jour chaque minute.
 * Les valeurs initiales viennent du serveur (pas de saut à l'affichage).
 */
export function PlayerCounts({ initial, compact = false }: { initial: { accounts: number; online: number }; compact?: boolean }) {
  const t = useTranslations("counts");
  const format = useFormatter();
  const [counts, setCounts] = useState(initial);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/stats");
        if (res.ok) setCounts(await res.json());
      } catch {
        /* hors ligne : on garde les derniers chiffres */
      }
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "text-sm" : ""}`} aria-live="polite">
      <span className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-surface px-3.5 py-1.5 font-bold">
        <span className="font-display text-lg leading-none">{format.number(counts.accounts)}</span>
        {t("accounts", { count: counts.accounts })}
      </span>
      <span className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-surface px-3.5 py-1.5 font-bold">
        <span className="relative flex size-2.5" aria-hidden="true">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#1fb26b] opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex size-2.5 rounded-full bg-[#1fb26b]" />
        </span>
        <span className="font-display text-lg leading-none">{format.number(counts.online)}</span>
        {t("online", { count: counts.online })}
      </span>
    </div>
  );
}
