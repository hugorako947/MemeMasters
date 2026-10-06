/**
 * Construit le fil d'Ariane à partir du chemin de la page.
 * Fonction pure (testée) : le composant se contente de l'afficher.
 */

/** Segments connus : clé de traduction (breadcrumb.<clé>) et existence d'une page à cette adresse. */
const SEGMENTS: Record<string, { hasPage: boolean }> = {
  connexion: { hasPage: true },
  inscription: { hasPage: true },
  "mot-de-passe-oublie": { hasPage: true },
  "nouveau-mot-de-passe": { hasPage: true },
  bienvenue: { hasPage: true },
  profil: { hasPage: false },
  parametres: { hasPage: true },
  raretes: { hasPage: true },
  "mentions-legales": { hasPage: true },
  "conditions-utilisation": { hasPage: true },
  confidentialite: { hasPage: true },
  "regles-communaute": { hasPage: true },
  "hors-ligne": { hasPage: true },
};

export interface Crumb {
  href: string;
  /** Clé de traduction, ou null quand `text` est un libellé brut (ex. un pseudo). */
  key: string | null;
  text: string;
  /** Faux pour le dernier élément (page courante) et les dossiers sans page. */
  linked: boolean;
  current: boolean;
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function buildBreadcrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("?")[0].split("/").filter(Boolean);
  if (segments.length === 0) return [];
  const crumbs: Crumb[] = [{ href: "/", key: "home", text: "home", linked: true, current: false }];
  segments.forEach((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const known = SEGMENTS[segment];
    const current = index === segments.length - 1;
    crumbs.push({
      href,
      key: known ? segment : null,
      text: known ? segment : safeDecode(segment).slice(0, 40),
      linked: !current && (known ? known.hasPage : true),
      current,
    });
  });
  return crumbs;
}
