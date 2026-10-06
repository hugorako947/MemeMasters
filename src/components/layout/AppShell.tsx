import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/Logo";
import { MainNav } from "./MainNav";

/** Cadre des pages de jeu : en-tête, contenu, navigation. */
export async function AppShell({ username, children }: { username: string; children: ReactNode }) {
  const t = await getTranslations("nav");
  return (
    <div className="min-h-dvh pb-24 md:pb-10">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        {t("skipToContent")}
      </a>
      <header className="safe-top mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 pt-4 md:px-6">
        <Logo />
        <div className="hidden md:block">
          <MainNav username={username} />
        </div>
      </header>
      <main id="contenu" className="mx-auto max-w-5xl px-4 pt-6 md:px-6">
        {children}
      </main>
      <div className="md:hidden">
        <MainNav username={username} />
      </div>
    </div>
  );
}
