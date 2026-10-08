import { getTranslations } from "next-intl/server";
import { SlideDeck } from "@/components/ui/SlideDeck";
import { GAME_CONFIG } from "@/config/game.config";
import { rankFor } from "@/config/ranks";
import type { Leaderboard, LeaderboardScope } from "@/lib/server/leaderboard";
import { LeaderboardPanel } from "./LeaderboardPanel";
import { NewsList } from "./NewsList";
import { RanksPanel } from "./RanksPanel";
import { RaritiesGrid } from "./RaritiesGrid";

export const INFOS_SLIDES = ["raretes", "rangs", "classement", "news"] as const;

/** Infos : Raretés, Rangs, Classement (ouvert par défaut) et News. */
export async function InfosView({
  boards,
  trophies,
  highestRank,
  initial,
  param,
}: {
  boards: Record<LeaderboardScope, Leaderboard>;
  trophies: number;
  highestRank: number;
  initial: string | undefined;
  param?: string;
}) {
  const t = await getTranslations("infos");
  const tr = await getTranslations("rank");
  // Onglet demandé dans l'adresse (?vue=…), sinon le classement.
  const requested = INFOS_SLIDES.indexOf((initial ?? "classement") as (typeof INFOS_SLIDES)[number]);
  const start = requested === -1 ? INFOS_SLIDES.indexOf("classement") : requested;
  return (
    <div className="grid gap-5">
      <h1 className="sr-only">{t("title")}</h1>
      <SlideDeck
        param={param}
        initial={start}
        slides={[
          { key: "raretes", label: t("tabs.rarities"), content: <RaritiesGrid /> },
          { key: "rangs", label: t("tabs.ranks"), content: <RanksPanel trophies={trophies} highestRank={highestRank} /> },
          {
            key: "classement",
            label: t("tabs.leaderboard"),
            content: <LeaderboardPanel boards={boards} rankName={tr(rankFor(trophies))} window={GAME_CONFIG.TROPHIES.LEADERBOARD_AROUND} />,
          },
          { key: "news", label: t("tabs.news"), content: <NewsList /> },
        ]}
      />
    </div>
  );
}
