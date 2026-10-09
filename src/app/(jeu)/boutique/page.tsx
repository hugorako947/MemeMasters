import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { ShopView } from "@/components/player/ShopView";
import { requirePlayer } from "@/lib/server/auth";
import { getBadges } from "@/lib/server/notifications";
import { hasPaidPurchase } from "@/lib/server/players";
import { MarkSeen } from "@/components/ui/MarkSeen";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("shop"))("title") };
}

export default async function ShopPage() {
  const { player } = await requirePlayer();
  const country = (await headers()).get("x-vercel-ip-country");
  const [hasPurchased, badges] = await Promise.all([hasPaidPurchase(player.id), getBadges(player)]);
  return (
    <>
      {badges.shop ? <MarkSeen seenKey="shop" /> : null}
      <ShopView country={country} hasPurchased={hasPurchased} />
    </>
  );
}
