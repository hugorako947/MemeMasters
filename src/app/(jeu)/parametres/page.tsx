import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { GAME_CONFIG } from "@/config/game.config";
import { requirePlayer } from "@/lib/server/auth";
import { timezoneUnlockDate } from "@/lib/server/players";
import { TimezoneForm } from "./TimezoneForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("settings"))("title") };
}

export default async function SettingsPage() {
  const { user, player } = await requirePlayer();
  const t = await getTranslations("settings");
  const ta = await getTranslations("auth");
  const format = await getFormatter();
  const unlock = timezoneUnlockDate(player);

  return (
    <div className="grid gap-6">
      <h1 className="font-display text-5xl leading-none">{t("title")}</h1>

      <Panel className="grid gap-3">
        <h2 className="text-xl font-extrabold">{t("timezoneTitle")}</h2>
        <p className="text-ink-soft">{t("timezoneLead", { days: GAME_CONFIG.TIMEZONE_CHANGE_COOLDOWN_DAYS })}</p>
        <p className="font-semibold">{t("timezoneCurrent", { timezone: player.timezone })}</p>
        {unlock ? (
          <p className="text-sm text-ink-soft">
            {t("timezoneLockedUntil", { date: format.dateTime(unlock, { day: "numeric", month: "long", year: "numeric" }) })}
          </p>
        ) : (
          <TimezoneForm current={player.timezone} />
        )}
      </Panel>

      <Panel className="grid gap-3">
        <h2 className="text-xl font-extrabold">{t("account")}</h2>
        {user.email ? <p className="text-ink-soft break-all">{t("signedInAs", { email: user.email })}</p> : null}
        <form action="/auth/deconnexion" method="post">
          <Button type="submit" variant="secondary">
            {ta("signOut")}
          </Button>
        </form>
      </Panel>
    </div>
  );
}
