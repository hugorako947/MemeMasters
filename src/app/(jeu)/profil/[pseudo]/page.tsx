import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ProfileBackLink } from "@/components/layout/Breadcrumb";
import { ProfileView } from "@/components/player/ProfileView";
import { requirePlayer } from "@/lib/server/auth";
import { getFriendsOverview, relationWith } from "@/lib/server/friends";
import { listConversations } from "@/lib/server/messages";
import { blockedPlayers, hasBlocked } from "@/lib/server/moderation";
import { getBadges } from "@/lib/server/notifications";
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

export default async function ProfilePage({ params, searchParams }: PageProps<"/profil/[pseudo]">) {
  const { player } = await requirePlayer();
  const { pseudo } = await params;
  const username = decodePseudo(pseudo);
  const profile = username ? await getPublicProfile(username) : null;
  if (!profile) notFound();
  const isMe = profile.id === player.id;
  if (isMe) {
    const { vue, avec } = await searchParams;
    const [friends, blocked, conversations, badges] = await Promise.all([
      getFriendsOverview(player.id),
      blockedPlayers(player.id),
      listConversations(player.id),
      getBadges(player),
    ]);
    return (
      <ProfileView
        profile={profile}
        viewer={player}
        social={{
          friends,
          blocked,
          conversations,
          badges: { friends: badges.friends, messages: badges.messages },
          initialTab: typeof vue === "string" ? vue : undefined,
          openWith: typeof avec === "string" ? avec.slice(0, 20) : undefined,
        }}
      />
    );
  }
  const [relation, blockedByMe, { depuis }] = await Promise.all([relationWith(player.id, profile.id), hasBlocked(player.id, profile.id), searchParams]);
  const origin = depuis === "amis" || depuis === "messages" || depuis === "classement" ? depuis : null;
  return (
    <div className="grid gap-4">
      {origin ? <ProfileBackLink origin={origin} myUsername={player.username} /> : null}
      <ProfileView profile={profile} viewer={player} other={{ relation, blockedByMe }} />
    </div>
  );
}
