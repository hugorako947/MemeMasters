import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PublicShell } from "@/components/layout/PublicShell";
import { requireUser } from "@/lib/server/auth";
import { getPlayer } from "@/lib/server/players";
import { ConsentForm, OnboardingForm } from "./OnboardingForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("onboarding"))("title") };
}

/**
 * Deux cas :
 * - compte créé avec Google (pas encore de profil) : pseudo + attestations ;
 * - conditions mises à jour depuis la dernière acceptation : attestations seules.
 */
export default async function WelcomePage() {
  const user = await requireUser();
  const player = await getPlayer(user.id);
  if (player?.consentUpToDate) redirect("/");
  const t = await getTranslations("onboarding");
  return (
    <PublicShell width="max-w-xl">
      {player ? (
        <>
          <h1 className="font-display text-5xl leading-none">{t("consentTitle")}</h1>
          <p className="mb-8 mt-2 text-ink-soft">{t("consentLead")}</p>
          <ConsentForm />
        </>
      ) : (
        <>
          <h1 className="font-display text-5xl leading-none">{t("title")}</h1>
          <p className="mb-8 mt-2 text-ink-soft">{t("lead")}</p>
          <OnboardingForm />
        </>
      )}
    </PublicShell>
  );
}
