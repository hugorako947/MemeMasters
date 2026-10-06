import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Panel } from "@/components/ui/Panel";
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
  const t = await getTranslations("profile");
  const format = await getFormatter();
  const isMe = profile.username.toLowerCase() === player.username.toLowerCase();

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <h1 className="font-display text-5xl leading-none break-all">{profile.username}</h1>
        {isMe ? <span className="rounded-full bg-sticker px-3 py-1 text-sm font-bold">{t("you")}</span> : null}
      </div>
      <p className="-mt-3 text-ink-soft">
        {t("level", { level: profile.level })} ·{" "}
        {t("memberSince", { date: format.dateTime(profile.createdAt, { month: "long", year: "numeric" }) })}
      </p>
      <Panel>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            [t("elo"), profile.elo],
            [t("wins"), profile.wins],
            [t("losses"), profile.losses],
            [t("draws"), profile.draws],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt className="text-sm font-semibold text-ink-soft">{label}</dt>
              <dd className="font-display text-3xl">{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  );
}
