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

/** Moment (horloge du navigateur) du dernier changement de thème fait sur cet appareil. */
const LOCAL_CHANGE_COOKIE = "mm-theme-at";

/** Changement de thème choisi par le joueur sur cet appareil (Réglages). */
export function applyLocalAppearance(a: Appearance) {
  applyAppearance(a);
  writeCookie(LOCAL_CHANGE_COOKIE, String(Date.now()));
}

/**
 * Recopie dans les cookies la langue et le thème enregistrés dans le compte du
 * joueur (nouvel appareil, ou changement fait depuis un autre appareil), puis
 * les applique. `renderedAt` : moment où le serveur a préparé ce cadre de page.
 * Next.js garde en mémoire le cadre des pages déjà visitées : un cadre préparé
 * avant le dernier changement de thème sur cet appareil porte l'ancien thème, il
 * est donc ignoré (sinon il remettait l'ancien thème sur ces pages).
 */
export function PreferenceSync({ locale, appearance, renderedAt }: { locale: string | null; appearance: Appearance; renderedAt: number }) {
  const router = useRouter();
  const current = useLocale();
  useEffect(() => {
    const localChangeAt = Number(readCookie(LOCAL_CHANGE_COOKIE) ?? 0);
    const differs = readCookie(THEME_COOKIES.theme) !== appearance.theme || readCookie(THEME_COOKIES.accent) !== appearance.accent;
    if (differs && renderedAt > localChangeAt) applyAppearance(appearance);
    if (locale && isAvailable(locale) && locale !== current && readCookie(LOCALE_COOKIE) !== locale) {
      writeCookie(LOCALE_COOKIE, locale);
      router.refresh();
    }
  }, [locale, appearance, renderedAt, current, router]);
  return null;
}
