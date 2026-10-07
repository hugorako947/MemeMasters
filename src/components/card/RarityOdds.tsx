"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { Rarity } from "@/config/rarities";
import { bestOddsFor } from "@/lib/economy/boosters";

/** « 15 % par booster journalier » : chance d'obtenir cette rareté, dans le booster le plus accessible. */
export function RarityOdds({ rarity, className = "" }: { rarity: Rarity; className?: string }) {
  const t = useTranslations("odds");
  const format = useFormatter();
  const { kind, chance } = bestOddsFor(rarity);
  return (
    <span className={className}>
      {t("perBooster", {
        chance: format.number(chance * 100, { maximumFractionDigits: 2 }),
        kind,
      })}
    </span>
  );
}
