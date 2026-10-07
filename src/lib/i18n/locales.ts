/**
 * Langues du jeu, dans l'ordre des langues les plus parlées dans le monde
 * (nombre total de locuteurs). Chaque langue s'affiche dans sa propre langue.
 */
export const LOCALES = [
  { code: "en", name: "English", dir: "ltr" },
  { code: "zh", name: "中文（普通话）", dir: "ltr" },
  { code: "es", name: "Español", dir: "ltr" },
  { code: "ar", name: "العربية", dir: "rtl" },
  { code: "fr", name: "Français", dir: "ltr" },
  { code: "pt", name: "Português", dir: "ltr" },
  { code: "de", name: "Deutsch", dir: "ltr" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];

/** Langues dont la traduction est terminée (fichier messages/<code>.json complet). */
export const AVAILABLE_LOCALES: readonly Locale[] = ["en", "zh", "es", "ar", "fr", "pt", "de"];

/** Langue d'origine du jeu, utilisée quand on ne sait rien du joueur. */
export const DEFAULT_LOCALE: Locale = "fr";
/** Langue internationale de repli quand la langue détectée n'est pas encore traduite. */
export const FALLBACK_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "mm-locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && LOCALES.some((l) => l.code === value);
}

export function isAvailable(value: unknown): value is Locale {
  return isLocale(value) && AVAILABLE_LOCALES.includes(value);
}

export function localeDir(locale: Locale): "ltr" | "rtl" {
  return LOCALES.find((l) => l.code === locale)?.dir ?? "ltr";
}

/** Langue principale par pays (code ISO), pour la détection par emplacement. */
const COUNTRY_LANGUAGE: Record<string, Locale> = {
  FR: "fr", BE: "fr", LU: "fr", MC: "fr", CH: "fr", SN: "fr", CI: "fr", CM: "fr", ML: "fr", BF: "fr",
  NE: "fr", TG: "fr", BJ: "fr", GA: "fr", CG: "fr", CD: "fr", MG: "fr", HT: "fr", RE: "fr", GP: "fr",
  MQ: "fr", GF: "fr", NC: "fr", PF: "fr",
  CN: "zh", TW: "zh", HK: "zh", MO: "zh", SG: "zh",
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", VE: "es", EC: "es", GT: "es", CU: "es",
  BO: "es", DO: "es", HN: "es", PY: "es", SV: "es", NI: "es", CR: "es", PA: "es", UY: "es", PR: "es",
  SA: "ar", AE: "ar", EG: "ar", IQ: "ar", JO: "ar", KW: "ar", LB: "ar", LY: "ar", OM: "ar", QA: "ar",
  SY: "ar", YE: "ar", BH: "ar", SD: "ar", PS: "ar", MA: "ar", DZ: "ar", TN: "ar", MR: "ar",
  PT: "pt", BR: "pt", AO: "pt", MZ: "pt", CV: "pt", GW: "pt", ST: "pt", TL: "pt",
  DE: "de", AT: "de", LI: "de",
};

/** Langues demandées par le navigateur (en-tête Accept-Language), par préférence décroissante. */
export function parseAcceptLanguage(header: string | null): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = Number(params.find((p) => p.trim().startsWith("q="))?.trim().slice(2) ?? "1");
      return { lang: tag.trim().toLowerCase().split("-")[0], q: Number.isFinite(q) ? q : 0, index };
    })
    .filter((x) => x.lang && x.lang !== "*" && x.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)
    .map((x) => x.lang);
}

/**
 * Choisit la langue d'affichage :
 * 1. le choix du joueur (cookie, enregistré dans les réglages) ;
 * 2. la langue du navigateur, si elle est traduite ;
 * 3. la langue du pays où se trouve le joueur, si elle est traduite ;
 * 4. l'anglais si une langue a été détectée mais n'est pas encore traduite ;
 * 5. sinon le français.
 */
export function negotiateLocale(input: { cookie?: string | null; acceptLanguage?: string | null; country?: string | null }): Locale {
  if (isAvailable(input.cookie)) return input.cookie;
  const browser = parseAcceptLanguage(input.acceptLanguage ?? null);
  const fromBrowser = browser.find((lang) => isAvailable(lang));
  if (fromBrowser && isLocale(fromBrowser)) return fromBrowser;
  const fromCountry = input.country ? COUNTRY_LANGUAGE[input.country.toUpperCase()] : undefined;
  if (fromCountry && isAvailable(fromCountry)) return fromCountry;
  if (browser.length > 0 || fromCountry) return FALLBACK_LOCALE;
  return DEFAULT_LOCALE;
}
