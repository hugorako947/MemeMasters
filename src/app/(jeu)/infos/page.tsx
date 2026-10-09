import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { InfosView } from "@/components/infos/InfosView";
import { requirePlayer } from "@/lib/server/auth";
import { getLeaderboards } from "@/lib/server/leaderboard";
import { getBadges } from "@/lib/server/notifications";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("infos"))("title") };
}

export default async function InfosPage({ searchParams }: PageProps<"/infos">) {
  const { player } = await requirePlayer();
  const { vue } = await searchParams;
  const [boards, badges] = await Promise.all([getLeaderboards(player.id, player.trophies), getBadges(player)]);
  return <InfosView boards={boards} trophies={player.trophies} highestRank={player.highestRank} newsBadge={badges.news} initial={typeof vue === "string" ? vue : undefined} />;
}
