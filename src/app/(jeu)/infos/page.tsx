import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { InfosView } from "@/components/infos/InfosView";
import { requirePlayer } from "@/lib/server/auth";
import { getLeaderboards } from "@/lib/server/leaderboard";
import { getBadges } from "@/lib/server/notifications";
import { playerCounts } from "@/lib/server/presence";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("infos"))("title") };
}

export default async function InfosPage({ searchParams }: PageProps<"/infos">) {
  const { player } = await requirePlayer();
  const { vue } = await searchParams;
  const [boards, badges, counts] = await Promise.all([getLeaderboards(player.id, player.trophies), getBadges(player), playerCounts()]);
  return <InfosView boards={boards} trophies={player.trophies} highestRank={player.highestRank} newsBadge={badges.news} counts={counts} initial={typeof vue === "string" ? vue : undefined} />;
}
