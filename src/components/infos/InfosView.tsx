import { getTranslations } from "next-intl/server";
import { SlideDeck } from "@/components/ui/SlideDeck";
import { GAME_CONFIG } from "@/config/game.config";
import { rankFor } from "@/config/ranks";
import type { Leaderboard, LeaderboardScope } from "@/lib/server/leaderboard";
import { LeaderboardPanel } from "./LeaderboardPanel";
import { NewsList } from "./NewsList";
import { CardGuidePanel } from "./CardGuidePanel";
import { PlayerCounts } from "@/components/player/PlayerCounts";
import { MemeMoneyPanel } from "./MemeMoneyPanel";
import { RanksPanel } from "./RanksPanel";
import { TrophiesPanel } from "./TrophiesPanel";
import { UpgradesPanel } from "./UpgradesPanel";
import { RaritiesGrid } from "./RaritiesGrid";

export const INFOS_SLIDES = ["carte", "raretes", "ameliorations", "classement", "rangs", "trophees", "mememoney", "news"] as const;

/** Infos : Carte, Raretés, Évolutions, Classement (ouvert par défaut), Rangs, Trophées, MemeMoney et News. */
export async function InfosView({
  boards,
  trophies,
  highestRank,
  initial,
  param,
  newsBadge = 0,
  counts,
}: {
  boards: Record<LeaderboardScope, Leaderboard>;
  trophies: number;
  highestRank: number;
  initial: string | undefined;
  param?: string;
  newsBadge?: number;
  /** Comptes existants et joueurs en ligne. */
  counts?: { accounts: number; online: number };
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
        markSeen={{ news: "news" }}
        param={param}
        initial={start}
        slides={[
          { key: "carte", label: t("tabs.card"), content: <CardGuidePanel /> },
          { key: "raretes", label: t("tabs.rarities"), content: <RaritiesGrid /> },
          { key: "ameliorations", label: t("tabs.upgrades"), content: <UpgradesPanel /> },
          {
            key: "classement",
            label: t("tabs.leaderboard"),
            content: (
              <div className="grid gap-4">
                {counts ? <PlayerCounts initial={counts} compact /> : null}
                <LeaderboardPanel boards={boards} rankName={tr(rankFor(trophies))} window={GAME_CONFIG.TROPHIES.LEADERBOARD_AROUND} />
              </div>
            ),
          },
          { key: "rangs", label: t("tabs.ranks"), content: <RanksPanel trophies={trophies} highestRank={highestRank} /> },
          { key: "trophees", label: t("tabs.trophies"), content: <TrophiesPanel trophies={trophies} /> },
          { key: "mememoney", label: t("tabs.memeMoney"), content: <MemeMoneyPanel /> },
          { key: "news", label: t("tabs.news"), content: <NewsList />, badge: newsBadge },
        ]}
      />
    </div>
  );
}
