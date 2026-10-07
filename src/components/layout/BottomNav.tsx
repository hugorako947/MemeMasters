"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { HomeIcon, ProfileIcon, SettingsIcon, SparkleIcon } from "./NavIcons";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  match: (path: string) => boolean;
}

/**
 * Navigation du joueur : une barre en bas, au centre, qui reste visible
 * pendant le défilement puis se pose au-dessus du pied de page.
 * Les entrées des phases suivantes (Boosters, Collection, Batailles) s'ajoutent ici.
 */
export function BottomNav({ username }: { username: string }) {
  const t = useTranslations("nav");
  const path = usePathname();
  const items: NavItem[] = [
    { href: "/", label: t("home"), icon: <HomeIcon />, match: (p) => p === "/" },
    { href: "/raretes", label: t("rarities"), icon: <SparkleIcon />, match: (p) => p.startsWith("/raretes") },
    {
      href: `/profil/${encodeURIComponent(username)}`,
      label: t("profile"),
      icon: <ProfileIcon />,
      match: (p) => p.startsWith("/profil"),
    },
    { href: "/parametres", label: t("settings"), icon: <SettingsIcon />, match: (p) => p.startsWith("/parametres") },
  ];

  return (
    <nav aria-label={t("label")} className="safe-bottom sticky bottom-0 z-40 px-3 pt-4">
      <ul className="mx-auto grid max-w-md grid-cols-4 gap-1 rounded-[1.6rem] border-[2.5px] border-ink bg-surface p-1.5 shadow-[0_5px_0_0_var(--mm-shadow)]">
        {items.map((item) => {
          const active = item.match(path);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[1.15rem] px-1 text-xs font-bold transition-colors ${
                  active ? "bg-candy text-[var(--mm-accent-ink)]" : "text-ink-soft hover:bg-paper hover:text-ink"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
