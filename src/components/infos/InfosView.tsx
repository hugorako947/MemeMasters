import { getTranslations } from "next-intl/server";
import { SlideDeck } from "@/components/ui/SlideDeck";
import { GAME_CONFIG } from "@/config/game.config";
import { rankFor } from "@/config/ranks";
import type { Leaderboard, LeaderboardScope } from "@/lib/server/leaderboard";
import { LeaderboardPanel } from "./LeaderboardPanel";
import { NewsList } from "./NewsList";
import { RaritiesGrid } from "./RaritiesGrid";

export const INFOS_SLIDES = ["raretes", "classement", "news"] as const;

/** Infos : Raretés (gauche), Classement (milieu, ouvert par défaut), News (droite). */
export async function InfosView({
  boards,
  trophies,
  initial,
  param,
}: {
  boards: Record<LeaderboardScope, Leaderboard>;
  trophies: number;
  initial: string | undefined;
  param?: string;
}) {
  const t = await getTranslations("infos");
  const tr = await getTranslations("rank");
  const start = Math.max(0, INFOS_SLIDES.indexOf((initial ?? "classement") as (typeof INFOS_SLIDES)[number]));
  return (
    <div className="grid gap-5">
      <h1 className="sr-only">{t("title")}</h1>
      <SlideDeck
        param={param}
        initial={start === -1 ? 1 : start}
        slides={[
          { key: "raretes", label: t("tabs.rarities"), content: <RaritiesGrid /> },
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
