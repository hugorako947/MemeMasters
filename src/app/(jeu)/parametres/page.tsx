import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SettingsView } from "@/components/player/SettingsView";
import { requirePlayer } from "@/lib/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("settings"))("title") };
}

export default async function SettingsPage() {
  const { user, player } = await requirePlayer();
  return <SettingsView player={player} email={user.email} />;
}
