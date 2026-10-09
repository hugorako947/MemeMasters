import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/Button";
import { InstallQr } from "./InstallQr";

/**
 * Incitation à jouer sur téléphone : QR code sur grand écran (on le scanne avec
 * son téléphone), bouton « Installer l'application » sur téléphone.
 */
export async function PlayOnPhone({ compact = false }: { compact?: boolean }) {
  const t = await getTranslations("installer");
  return (
    <div className={`flex items-center gap-4 rounded-[1.5rem] border-2 border-ink bg-surface p-4 ${compact ? "" : "shadow-[0_4px_0_0_var(--mm-shadow)]"}`}>
      <div className="hidden md:block">
        <InstallQr size={112} label={t("qrLabel")} />
      </div>
      <div className="grid gap-2">
        <p className="font-extrabold">📱 {t("cta.title")}</p>
        <p className="hidden text-sm text-ink-soft md:block">{t("cta.scan")}</p>
        <p className="text-sm text-ink-soft md:hidden">{t("cta.tap")}</p>
        {/* Le conteneur porte md:hidden : la classe du bouton imposerait son propre affichage. */}
        <div className="md:hidden">
          <ButtonLink href="/installer" variant="secondary" className="min-h-10 px-4 text-sm">
            {t("cta.button")}
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
