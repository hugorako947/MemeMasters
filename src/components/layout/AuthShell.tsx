import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { BackLink } from "./BackLink";
import { SiteFooter } from "./SiteFooter";

/** Cadre des pages de connexion et d'inscription : retour discret, logo et contenu centrés. */
export async function AuthShell({ children }: { children: ReactNode }) {
  const t = await getTranslations("home");
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="safe-top mx-auto w-full max-w-6xl px-5 pt-4 md:px-8">
        <BackLink />
      </div>
      <div className="mx-auto w-full max-w-md flex-1 px-5">
        <header className="mb-8 mt-2 text-center">
          <Logo size="lg" />
        </header>
        <main id="contenu">{children}</main>
        <p className="mt-8 text-center">
          <ButtonLink href="/contact" variant="ghost" className="text-sm">
            <span aria-hidden="true">✉️</span> {t("contact")}
          </ButtonLink>
        </p>
      </div>
      <SiteFooter />
    </div>
  );
}
