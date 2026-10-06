import { getRequestConfig } from "next-intl/server";

/**
 * Langue unique pour l'instant : le français. Pour ajouter une langue,
 * créer messages/<code>.json et choisir ici la locale (cookie, en-tête…).
 */
export const DEFAULT_LOCALE = "fr";

export default getRequestConfig(async () => {
  const locale = DEFAULT_LOCALE;
  return {
    locale,
    timeZone: "Europe/Paris",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
