/**
 * Thèmes de l'interface. Les cartes gardent toujours leurs vraies couleurs.
 * - clair : thème par défaut ;
 * - obscur : fond nuit, texte clair ;
 * - inversé : l'interface en négatif photo (cartes et illustrations préservées) ;
 * - personnalisé : couleur d'accent au choix, sur fond clair ou obscur.
 */
export const THEMES = ["light", "dark", "inverted", "custom"] as const;
export type Theme = (typeof THEMES)[number];
export const BASES = ["light", "dark", "inverted"] as const;
export type ThemeBase = (typeof BASES)[number];

/** Couleurs d'accent proposées pour le thème personnalisé. */
export const ACCENTS = ["#ff3d7f", "#ff5a36", "#f5a400", "#12a150", "#0fb5b1", "#2d5bff", "#8b3dff", "#e040fb"] as const;

export const THEME_COOKIES = { theme: "mm-theme", accent: "mm-accent", base: "mm-base" } as const;

export interface Appearance {
  theme: Theme;
  accent: string | null;
  base: ThemeBase | null;
}

export const DEFAULT_APPEARANCE: Appearance = { theme: "light", accent: null, base: null };

export function isTheme(v: unknown): v is Theme {
  return typeof v === "string" && (THEMES as readonly string[]).includes(v);
}

export function isAccent(v: unknown): v is string {
  return typeof v === "string" && (ACCENTS as readonly string[]).includes(v);
}

export function isBase(v: unknown): v is ThemeBase {
  return typeof v === "string" && (BASES as readonly string[]).includes(v);
}

/** Lit une préférence (cookies ou base), en ignorant toute valeur inconnue. */
export function parseAppearance(raw: { theme?: string | null; accent?: string | null; base?: string | null }): Appearance {
  const theme = isTheme(raw.theme) ? raw.theme : "light";
  if (theme !== "custom") return { theme, accent: null, base: null };
  return {
    theme,
    accent: isAccent(raw.accent) ? raw.accent : ACCENTS[0],
    base: isBase(raw.base) ? raw.base : "light",
  };
}

/** Couleur de texte lisible sur l'accent (encre ou blanc), selon sa luminance. */
export function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  const contrastInk = (lum + 0.05) / (0.0098 + 0.05);
  const contrastWhite = 1.05 / (lum + 0.05);
  return contrastInk >= contrastWhite ? "#1a1238" : "#ffffff";
}

/** Attributs à poser sur <html> pour appliquer le thème. */
export function themeAttributes(a: Appearance): { "data-theme": Theme; "data-base"?: ThemeBase; style?: Record<string, string> } {
  if (a.theme !== "custom" || !a.accent) return { "data-theme": a.theme };
  return {
    "data-theme": "custom",
    "data-base": a.base ?? "light",
    style: { "--color-candy": a.accent, "--mm-accent-ink": inkOn(a.accent) },
  };
}
