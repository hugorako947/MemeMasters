import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { Breadcrumbs } from "./Breadcrumbs";
import { SiteFooter } from "./SiteFooter";

/** Cadre des pages publiques : logo, fil d'Ariane, contenu, pied de page. */
export function PublicShell({
  children,
  hideLogo = false,
  width = "max-w-6xl",
}: {
  children: ReactNode;
  hideLogo?: boolean;
  width?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className={`safe-top mx-auto w-full ${width} flex-1 px-5 pt-6 md:px-8`}>
        {hideLogo ? null : (
          <header className="mb-4">
            <Logo />
          </header>
        )}
        <Breadcrumbs className="mb-6" />
        <main id="contenu">{children}</main>
      </div>
      <SiteFooter />
    </div>
  );
}
