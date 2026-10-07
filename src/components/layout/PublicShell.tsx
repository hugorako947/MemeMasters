import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { BackLink } from "./BackLink";
import { SiteFooter } from "./SiteFooter";

/** Cadre des pages publiques : retour à l'accueil, logo, contenu, pied de page. */
export function PublicShell({
  children,
  hideLogo = false,
  back = true,
  width = "max-w-6xl",
}: {
  children: ReactNode;
  hideLogo?: boolean;
  /** Affiche « ← Retour à l'accueil » (pas sur l'accueil lui-même). */
  back?: boolean;
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
        {back ? (
          <div className="mb-4">
            <BackLink to="/" />
          </div>
        ) : null}
        <main id="contenu">{children}</main>
      </div>
      <SiteFooter />
    </div>
  );
}
