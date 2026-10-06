import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/Logo";
import { Breadcrumbs } from "./Breadcrumbs";
import { MainNav } from "./MainNav";
import { SiteFooter } from "./SiteFooter";

/** Cadre des pages de jeu : en-tête, contenu, navigation. */
export async function AppShell({ username, children }: { username: string; children: ReactNode }) {
  const t = await getTranslations("nav");
  return (
    <div className="flex min-h-dvh flex-col pb-20 md:pb-0">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        {t("skipToContent")}
      </a>
      <header className="safe-top mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 pt-4 md:px-6">
        <Logo />
        <div className="hidden md:block">
          <MainNav username={username} />
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 md:px-6">
        <Breadcrumbs className="mb-5" />
        <main id="contenu">{children}</main>
      </div>
      <SiteFooter />
      <div className="md:hidden">
        <MainNav username={username} />
      </div>
    </div>
  );
}
