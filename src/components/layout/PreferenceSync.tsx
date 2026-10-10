"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useEffect } from "react";
import { LOCALE_COOKIE, isAvailable } from "@/lib/i18n/locales";
import { randomPalette, THEME_COOKIES, themeAttributes, type Appearance } from "@/lib/theme/theme";

const PALETTE_KEYS = Object.keys(randomPalette("#000001"));

const YEAR = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function writeCookie(name: string, value: string | null) {
  document.cookie = value
    ? `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${YEAR}; SameSite=Lax`
    : `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/** Applique le thème au document (attributs de <html>). */
export function applyAppearance(a: Appearance) {
  const root = document.documentElement;
  const attrs = themeAttributes(a);
  root.dataset.theme = attrs["data-theme"];
  if (attrs["data-base"]) root.dataset.base = attrs["data-base"];
  else delete root.dataset.base;
  // Retire toutes les couleurs posées par un thème précédent (personnalisé ou aléatoire).
  for (const key of PALETTE_KEYS) root.style.removeProperty(key);
  for (const [k, v] of Object.entries(attrs.style ?? {})) root.style.setProperty(k, v);
  writeCookie(THEME_COOKIES.theme, a.theme);
  writeCookie(THEME_COOKIES.accent, a.accent);
  writeCookie(THEME_COOKIES.base, a.base);
}

/**
 * Sur un nouvel appareil, recopie dans les cookies la langue et le thème
 * enregistrés dans le compte du joueur, puis les applique.
 */
export function PreferenceSync({ locale, appearance }: { locale: string | null; appearance: Appearance }) {
  const router = useRouter();
  const current = useLocale();
  useEffect(() => {
    if (readCookie(THEME_COOKIES.theme) !== appearance.theme || readCookie(THEME_COOKIES.accent) !== appearance.accent) {
      applyAppearance(appearance);
    }
    if (locale && isAvailable(locale) && locale !== current && readCookie(LOCALE_COOKIE) !== locale) {
      writeCookie(LOCALE_COOKIE, locale);
      router.refresh();
    }
  }, [locale, appearance, current, router]);
  return null;
}
