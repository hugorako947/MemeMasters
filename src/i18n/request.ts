import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, negotiateLocale } from "@/lib/i18n/locales";

/**
 * Langue de la requête : choix du joueur, puis navigateur, puis pays
 * (en-tête x-vercel-ip-country fourni par Vercel). Voir negotiateLocale.
 * Une clé absente d'une traduction retombe sur le français.
 */
export default getRequestConfig(async () => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const locale = negotiateLocale({
    cookie: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerStore.get("accept-language"),
    country: headerStore.get("x-vercel-ip-country"),
  });
  const base = (await import(`../../messages/${DEFAULT_LOCALE}.json`)).default;
  const messages =
    locale === DEFAULT_LOCALE ? base : deepMerge(base, (await import(`../../messages/${locale}.json`)).default);
  return { locale, timeZone: "Europe/Paris", messages };
});

type Messages = { [key: string]: string | Messages };

function deepMerge(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = out[key];
    out[key] =
      typeof value === "object" && typeof current === "object" ? deepMerge(current, value) : value;
  }
  return out;
}
