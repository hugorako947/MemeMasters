import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { InstallGuide } from "@/components/install/InstallGuide";
import { InstallQr } from "@/components/install/InstallQr";
import { AdaptiveShell } from "@/components/layout/AdaptiveShell";
import { GAME_CONFIG } from "@/config/game.config";
import { detectPlatform } from "@/lib/pwa/detect";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("installer"))("title", { name: GAME_CONFIG.GAME_NAME }) };
}

/** Page d'installation : on y arrive en scannant le QR code ou depuis les réglages. */
export default async function InstallerPage() {
  const t = await getTranslations("installer");
  const platform = detectPlatform((await headers()).get("user-agent") ?? "");
  return (
    <AdaptiveShell publicWidth="max-w-2xl">
      <div className="mx-auto grid max-w-xl gap-6">
        <div>
          <h1 className="font-display text-5xl leading-none">{t("title", { name: GAME_CONFIG.GAME_NAME })}</h1>
          <p className="mt-2 text-ink-soft">{t("lead")}</p>
        </div>
        <InstallGuide serverPlatform={platform} qr={<InstallQr size={150} label={t("qrLabel")} />} />
        <ul className="grid gap-2 text-sm font-semibold sm:grid-cols-3">
          {(["fullscreen", "oneTap", "updates"] as const).map((b) => (
            <li key={b} className="rounded-2xl bg-surface px-4 py-3 text-center">
              {t(`benefits.${b}`)}
            </li>
          ))}
        </ul>
      </div>
    </AdaptiveShell>
  );
}
