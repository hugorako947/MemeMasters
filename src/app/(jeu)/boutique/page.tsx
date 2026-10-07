import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { ShopView } from "@/components/player/ShopView";
import { requirePlayer } from "@/lib/server/auth";
import { hasPaidPurchase } from "@/lib/server/players";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("shop"))("title") };
}

export default async function ShopPage() {
  const { player } = await requirePlayer();
  const country = (await headers()).get("x-vercel-ip-country");
  return <ShopView country={country} hasPurchased={await hasPaidPurchase(player.id)} />;
}
