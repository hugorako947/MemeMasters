import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/Logo";
import { RetryButton } from "./RetryButton";

export const dynamic = "force-static";

/** Page de repli affichée par le service worker quand le réseau manque. */
export default async function OfflinePage() {
  const t = await getTranslations("offline");
  return (
    <main className="safe-top mx-auto grid min-h-dvh max-w-md content-center gap-5 px-6 text-center">
      <div>
        <Logo />
      </div>
      <h1 className="font-display text-4xl">{t("title")}</h1>
      <p className="text-ink-soft">{t("lead")}</p>
      <RetryButton label={t("retry")} />
    </main>
  );
}
