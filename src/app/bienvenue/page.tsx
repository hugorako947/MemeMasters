import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/Logo";
import { requireUser } from "@/lib/server/auth";
import { getPlayer } from "@/lib/server/players";
import { OnboardingForm } from "./OnboardingForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("onboarding"))("title") };
}

/** Dernière étape de l'inscription : pseudo (le fuseau est détecté). */
export default async function WelcomePage() {
  const user = await requireUser();
  if (await getPlayer(user.id)) redirect("/");
  const t = await getTranslations("onboarding");
  return (
    <div className="safe-top mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10 pt-6">
      <header>
        <Logo />
      </header>
      <main id="contenu" className="flex flex-1 flex-col justify-center py-8">
        <h1 className="font-display text-5xl leading-none">{t("title")}</h1>
        <p className="mb-8 mt-2 text-ink-soft">{t("lead")}</p>
        <OnboardingForm />
      </main>
    </div>
  );
}
