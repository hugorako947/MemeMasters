/**
 * Thèmes de l'interface. Les cartes gardent toujours leurs vraies couleurs.
 * - clair : thème par défaut ;
 * - obscur : fond nuit, texte clair ;
 * - inversé : l'interface en négatif photo (cartes et illustrations préservées) ;
 * - personnalisé : couleur d'accent au choix, sur fond clair ou obscur ;
 * - aléatoire : toute la palette de l'interface tirée au hasard (nouveau tirage à chaque clic).
 */
export const THEMES = ["light", "dark", "inverted", "custom", "random"] as const;
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
  // Thème aléatoire : « accent » porte la graine de la palette (#xxxxxx).
  if (theme === "random") return { theme, accent: isSeed(raw.accent) ? raw.accent : "#5ec0de", base: null };
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
  if (a.theme === "random") {
    const seed = a.accent ?? "#5ec0de";
    // Ambiance claire ou sombre passée par data-base (le CSS en déduit color-scheme),
    // pour que la palette ne contienne que des variables --… (valides pour React comme pour le navigateur).
    return { "data-theme": "random", "data-base": randomIsDark(seed) ? "dark" : "light", style: randomPalette(seed) };
  }
  if (a.theme !== "custom" || !a.accent) return { "data-theme": a.theme };
  return {
    "data-theme": "custom",
    "data-base": a.base ?? "light",
    style: { "--color-candy": a.accent, "--mm-accent-ink": inkOn(a.accent) },
  };
}

// ---------------------------------------------------------------- thème aléatoire

export function isSeed(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-f]{6}$/.test(v);
}

/** Nouvelle graine au hasard (au clic sur « Aléatoire »). */
export function newSeed(random: () => number = Math.random): string {
  return `#${Math.floor(random() * 0x1000000).toString(16).padStart(6, "0")}`;
}

function hsl(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => Math.round(255 * (l / 100 - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return `#${[f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Palette complète tirée d'une graine : même graine, mêmes couleurs (sur tous
 * les appareils). Ambiance claire ou sombre au hasard ; le texte reste toujours
 * lisible (fond très clair et texte très sombre, ou l'inverse).
 */
function seededRandom(seed: string): () => number {
  let x = parseInt(seed.slice(1), 16) || 1;
  return () => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return x / 0x7fffffff;
  };
}

/** Le thème aléatoire tiré par cette graine est-il sombre ? (même tirage que la palette) */
export function randomIsDark(seed: string): boolean {
  return seededRandom(seed)() < 0.4;
}

export function randomPalette(seed: string): Record<string, string> {
  const rand = seededRandom(seed);
  const dark = rand() < 0.4;
  const h = Math.floor(rand() * 360);
  const accent = (h + 90 + Math.floor(rand() * 180)) % 360;
  const sticker = (accent + 60 + Math.floor(rand() * 120)) % 360;
  const candy = hsl(accent, 85, dark ? 62 : 55);
  const ink = dark ? hsl(h, 30, 94) : hsl(h, 55, 13);
  return {
    "--color-paper": dark ? hsl(h, 35, 9) : hsl(h, 70, 94),
    "--color-surface": dark ? hsl(h, 30, 15) : hsl(h, 80, 99),
    "--color-line": dark ? hsl(h, 25, 28) : hsl(h, 40, 82),
    "--color-ink": ink,
    "--color-ink-soft": dark ? hsl(h, 20, 72) : hsl(h, 30, 35),
    "--color-candy": candy,
    "--color-candy-ink": dark ? hsl(accent, 90, 75) : hsl(accent, 85, 35),
    "--color-sticker": hsl(sticker, 90, 62),
    "--color-link": dark ? hsl((accent + 180) % 360, 80, 72) : hsl((accent + 180) % 360, 80, 38),
    "--mm-shadow": dark ? "#000000" : ink,
    "--mm-accent-ink": inkOn(candy),
  };
}
