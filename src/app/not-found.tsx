import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <main className="safe-top mx-auto grid min-h-dvh max-w-md content-center gap-5 px-6 text-center">
      <div>
        <Logo />
      </div>
      <h1 className="font-display text-5xl">{t("notFoundTitle")}</h1>
      <p className="text-ink-soft">{t("notFoundLead")}</p>
      <div>
        <ButtonLink href="/">{t("backHome")}</ButtonLink>
      </div>
    </main>
  );
}
