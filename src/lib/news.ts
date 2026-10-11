/** Outils purs pour les news (utilisables côté serveur et dans les tests). */
export type NewsKind = "news" | "update" | "upcoming" | "change";
export type Localized = { fr: string } & Partial<Record<"en" | "zh" | "es" | "ar" | "pt" | "de", string>>;

/** Texte dans la langue demandée, sinon en français (langue obligatoire). */
export function localized(text: Localized, locale: string): { text: string; lang: string } {
  const value = (text as Record<string, string | undefined>)[locale];
  return value ? { text: value, lang: locale } : { text: text.fr, lang: "fr" };
}
