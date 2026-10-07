import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ProfileView } from "@/components/player/ProfileView";
import { requirePlayer } from "@/lib/server/auth";
import { getPublicProfile } from "@/lib/server/players";

/** Les pseudos n'utilisent que [A-Za-z0-9_] : un paramètre mal encodé n'est pas un profil. */
function decodePseudo(raw: string): string {
  try {
    return decodeURIComponent(raw).slice(0, 20);
  } catch {
    return "";
  }
}

export async function generateMetadata({ params }: PageProps<"/profil/[pseudo]">): Promise<Metadata> {
  const { pseudo } = await params;
  return { title: (await getTranslations("profile"))("title", { username: decodePseudo(pseudo) }) };
}

export default async function ProfilePage({ params }: PageProps<"/profil/[pseudo]">) {
  const { player } = await requirePlayer();
  const { pseudo } = await params;
  const username = decodePseudo(pseudo);
  const profile = username ? await getPublicProfile(username) : null;
  if (!profile) notFound();
  return <ProfileView profile={profile} viewer={player} />;
}
