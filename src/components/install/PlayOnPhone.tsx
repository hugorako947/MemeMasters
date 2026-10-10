import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/Button";
import { InstallQr } from "./InstallQr";

/**
 * Incitation à jouer sur téléphone : QR code sur grand écran (on le scanne avec
 * son téléphone), bouton « Installer l'application » sur téléphone.
 */
export async function PlayOnPhone({ layout = "stacked" }: { layout?: "stacked" | "row" }) {
  const t = await getTranslations("installer");
  const qr = (
    <div className="hidden md:block">
      <InstallQr size={layout === "row" ? 112 : 132} label={t("qrLabel")} />
    </div>
  );
  const text = (
    <div className="grid gap-1.5">
      <p className="font-extrabold">{t("cta.title")}</p>
      <p className="hidden text-sm text-ink-soft md:block">{t("cta.scan")}</p>
      <p className="text-sm text-ink-soft md:hidden">{t("cta.tap")}</p>
      {/* Le conteneur porte md:hidden : la classe du bouton imposerait son propre affichage. */}
      <div className="md:hidden">
        <ButtonLink href="/installer" variant="secondary" className="min-h-10 px-4 text-sm">
          {t("cta.button")}
        </ButtonLink>
      </div>
    </div>
  );
  // Accueil : QR code sous le texte. Réglages : QR code à gauche du texte.
  return layout === "row" ? (
    <div className="flex items-center gap-4 rounded-[1.5rem] border-2 border-ink bg-surface p-4">
      {qr}
      {text}
    </div>
  ) : (
    <div className="grid justify-items-start gap-3 rounded-[1.5rem] border-2 border-ink bg-surface p-4 shadow-[0_3px_0_0_var(--mm-shadow)]">
      {text}
      {qr}
    </div>
  );
}
