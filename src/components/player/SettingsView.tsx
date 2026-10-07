import { getFormatter, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { GAME_CONFIG } from "@/config/game.config";
import { timezoneUnlockDate, type Player } from "@/lib/server/players";
import { parseAppearance } from "@/lib/theme/theme";
import { AppearanceForm } from "@/app/(jeu)/parametres/AppearanceForm";
import { DeleteAccount } from "@/app/(jeu)/parametres/DeleteAccount";
import { LanguageForm } from "@/app/(jeu)/parametres/LanguageForm";
import { TimezoneForm } from "@/app/(jeu)/parametres/TimezoneForm";

/**
 * Réglages du compte. La déconnexion et la suppression du compte sont ici,
 * et non dans le profil : le profil est la vitrine publique du joueur, les
 * réglages regroupent tout ce qui touche à son compte.
 */
export async function SettingsView({ player, email }: { player: Player; email: string | null }) {
  const t = await getTranslations("settings");
  const format = await getFormatter();
  const unlock = timezoneUnlockDate(player);

  return (
    <div className="grid gap-6">
      <h1 className="font-display text-5xl leading-none">{t("title")}</h1>

      <Panel className="grid gap-3">
        <h2 className="text-xl font-extrabold">{t("languageTitle")}</h2>
        <LanguageForm />
      </Panel>

      <Panel className="grid gap-3">
        <h2 className="text-xl font-extrabold">{t("themeTitle")}</h2>
        <AppearanceForm initial={parseAppearance(player.appearance)} />
      </Panel>

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

      <Panel className="grid gap-4">
        <h2 className="text-xl font-extrabold">{t("account")}</h2>
        {email ? <p className="break-all text-ink-soft">{t("signedInAs", { email })}</p> : null}
        <form action="/auth/deconnexion" method="post">
          <Button type="submit" variant="secondary">
            {t("signOut")}
          </Button>
        </form>
        <div className="mt-2 grid gap-3 rounded-xl border-2 border-dashed border-danger p-4">
          <h3 className="font-extrabold text-danger">{t("dangerTitle")}</h3>
          <p className="text-sm text-ink-soft">{t("dangerLead")}</p>
          <div>
            <DeleteAccount username={player.username} />
          </div>
        </div>
      </Panel>
    </div>
  );
}
