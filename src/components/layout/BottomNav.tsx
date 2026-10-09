"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { HomeIcon, InfoIcon, ProfileIcon, SettingsIcon, ShopIcon } from "./NavIcons";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  match: (path: string) => boolean;
}

/**
 * Navigation du joueur, en bas au centre : Boutique, Infos, Accueil (au
 * milieu, plus grand, rond et mis en avant), Profil, Réglages. Elle reste
 * visible pendant le défilement puis se pose au-dessus du pied de page.
 */
export function BottomNav({ username }: { username: string }) {
  const t = useTranslations("nav");
  const path = usePathname();
  const side = (item: NavItem) => {
    const active = item.match(path);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[1.15rem] px-1 text-[0.7rem] font-bold transition-colors sm:text-xs ${
            active ? "bg-candy text-[var(--mm-accent-ink)]" : "text-ink-soft hover:bg-paper hover:text-ink"
          }`}
        >
          {item.icon}
          <span>{item.label}</span>
        </Link>
      </li>
    );
  };
  const left: NavItem[] = [
    { href: "/boutique", label: t("shop"), icon: <ShopIcon />, match: (p) => p.startsWith("/boutique") },
    { href: "/infos", label: t("infos"), icon: <InfoIcon />, match: (p) => p.startsWith("/infos") || p.startsWith("/raretes") },
  ];
  const right: NavItem[] = [
    {
      href: `/profil/${encodeURIComponent(username)}`,
      label: t("profile"),
      icon: <ProfileIcon />,
      match: (p) => p.startsWith("/profil"),
    },
    { href: "/parametres", label: t("settings"), icon: <SettingsIcon />, match: (p) => p.startsWith("/parametres") },
  ];
  const homeActive = path === "/";

  return (
    <nav aria-label={t("label")} className="safe-bottom sticky bottom-0 z-40 px-3 pt-7">
      <ul className="mx-auto grid max-w-lg grid-cols-[1fr_1fr_auto_1fr_1fr] items-center gap-1 rounded-[1.6rem] border-2 border-ink bg-surface p-1.5 shadow-[0_3px_0_0_var(--mm-shadow)]">
        {left.map(side)}
        <li className="px-1">
          <Link href="/" aria-current={homeActive ? "page" : undefined} className="mm-nav-home">
            <span className="grid place-items-center gap-0.5 text-[0.7rem] font-extrabold">
              <span className="scale-125">
                <HomeIcon />
              </span>
              {t("home")}
            </span>
          </Link>
        </li>
        {right.map(side)}
      </ul>
    </nav>
  );
}
