/**
 * Pointeurs de souris aux couleurs du thème du compte : la flèche (partout,
 * boutons et liens compris) et le curseur d'écriture (champs de saisie et
 * texte). Dessinés en SVG et posés sur <html> en variables CSS, ils suivent
 * le thème dès le premier affichage, sans image à télécharger.
 */
import { inkOn, randomPalette, type Appearance } from "./theme";

export const CURSOR_KEYS = ["--mm-cursor-arrow", "--mm-cursor-text"] as const;

const NIGHT = "#1a1238";
const STICKER = "#ffd23f";

const ARROW_PATH = "M3 2.2 3.4 22.6l6.2-5.4 4.2 9.6 4.4-1.9-4.3-9.4 8.6-.2z";
const TEXT_PATH = "M11 4.5c2.2 0 3.8.6 5 1.8 1.2-1.2 2.8-1.8 5-1.8M16 6.3v19.4M11 27.5c2.2 0 3.8-.6 5-1.8 1.2 1.2 2.8 1.8 5 1.8";

/** Couleur de remplissage du pointeur et de son contour, selon le thème. */
export function cursorColors(a: Appearance): { fill: string; stroke: string; halo: string } {
  let fill = STICKER;
  if (a.theme === "custom" && a.accent) fill = a.accent;
  if (a.theme === "random" && a.accent) fill = randomPalette(a.accent)["--color-sticker"];
  // Contour lisible sur le remplissage, puis un liseré opposé pour rester visible sur tous les fonds.
  const stroke = inkOn(fill) === NIGHT ? NIGHT : "#ffffff";
  return { fill, stroke, halo: stroke === NIGHT ? "#ffffff" : NIGHT };
}

const svgUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

export function arrowSvg({ fill, stroke, halo }: { fill: string; stroke: string; halo: string }): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
    `<path d="${ARROW_PATH}" fill="${halo}" stroke="${halo}" stroke-width="5" stroke-linejoin="round"/>` +
    `<path d="${ARROW_PATH}" fill="${fill}" stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>` +
    `</svg>`
  );
}

export function textSvg({ fill, stroke, halo }: { fill: string; stroke: string; halo: string }): string {
  const line = (color: string, width: number) =>
    `<path d="${TEXT_PATH}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${line(halo, 7.5)}${line(stroke, 5.5)}${line(fill, 2.4)}</svg>`;
}

/** Variables CSS des deux pointeurs (avec leur point actif). */
export function cursorStyle(a: Appearance): Record<(typeof CURSOR_KEYS)[number], string> {
  const colors = cursorColors(a);
  return {
    "--mm-cursor-arrow": `${svgUrl(arrowSvg(colors))} 3 2`,
    "--mm-cursor-text": `${svgUrl(textSvg(colors))} 16 16`,
  };
}
