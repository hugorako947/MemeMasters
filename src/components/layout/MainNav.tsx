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
 * Navigation principale : barre fixe en bas sur mobile (zone du pouce),
 * barre horizontale en haut sur grand écran. Les entrées des phases
 * suivantes (Boosters, Collection, Combat, Classement) s'ajoutent ici.
 */
export function MainNav({ username }: { username: string }) {
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
    <nav
      aria-label={t("label")}
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-surface md:static md:border-0 md:bg-transparent md:pb-0"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4 md:flex md:max-w-none md:gap-1">
        {items.map((item) => {
          const active = item.match(path);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-2 text-xs font-bold md:min-h-10 md:flex-row md:gap-2 md:rounded-full md:px-4 md:text-sm ${
                  active ? "text-candy-ink md:bg-ink md:text-surface" : "text-ink-soft hover:text-ink"
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
