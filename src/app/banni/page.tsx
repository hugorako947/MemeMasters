import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { PublicShell } from "@/components/layout/PublicShell";
import { requireUser } from "@/lib/server/auth";
import { getPlayer } from "@/lib/server/players";
import { redirect } from "next/navigation";

/** Compte suspendu par un administrateur : motif et moyen de contester. */
export default async function BannedPage() {
  const user = await requireUser();
  const player = await getPlayer(user.id);
  if (!player?.ban) redirect("/");
  const t = await getTranslations("banned");
  const format = await getFormatter();
  return (
    <PublicShell width="max-w-xl">
      <div className="grid gap-4 rounded-[1.5rem] border-2 border-ink bg-surface p-6">
        <h1 className="font-display text-4xl leading-none">{t("title")}</h1>
        <p>{t("since", { date: format.dateTime(player.ban.at, { day: "numeric", month: "long", year: "numeric" }) })}</p>
        {player.ban.reason ? <p className="rounded-xl bg-paper p-3 font-semibold">{player.ban.reason}</p> : null}
        <p className="text-sm text-ink-soft">{t("contest")}</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/contact" className="mm-btn mm-btn--primary px-5">
            {t("contact")}
          </Link>
          <form action="/auth/deconnexion" method="post">
            <button type="submit" className="mm-btn mm-btn--secondary px-5">
              {t("signOut")}
            </button>
          </form>
        </div>
      </div>
    </PublicShell>
  );
}
