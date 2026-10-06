/**
 * Lien « ← Retour à … » des pages de connexion et d'inscription.
 * Il pointe vers la page visitée juste avant, si elle est connue et
 * pertinente ; sinon vers le parent logique de la page courante.
 */

/** Pages vers lesquelles on peut revenir, avec la clé de leur libellé (back.<clé>). */
export const BACK_LABELS: Record<string, string> = {
  "/": "home",
  "/connexion": "signIn",
  "/inscription": "signUp",
  "/mot-de-passe-oublie": "forgot",
  "/raretes": "rarities",
  "/mentions-legales": "legal",
  "/conditions-utilisation": "terms",
  "/confidentialite": "privacy",
  "/regles-communaute": "community",
};

/** Parent logique quand on arrive directement (lien externe, rechargement…). */
const DEFAULT_PARENT: Record<string, string> = {
  "/connexion": "/",
  "/inscription": "/",
  "/mot-de-passe-oublie": "/connexion",
  "/nouveau-mot-de-passe": "/connexion",
};

export interface BackTarget {
  href: string;
  labelKey: string;
}

export function resolveBackTarget(pathname: string, previous: string | null): BackTarget {
  const prevPath = previous?.split("?")[0] ?? null;
  if (prevPath && prevPath !== pathname && BACK_LABELS[prevPath]) {
    return { href: prevPath, labelKey: BACK_LABELS[prevPath] };
  }
  const parent = DEFAULT_PARENT[pathname] ?? "/";
  return { href: parent, labelKey: BACK_LABELS[parent] ?? "home" };
}

/** Clé de stockage de session (onglet courant uniquement) de la pile des pages visitées. */
export const NAV_STACK_KEY = "mm:nav:stack";
const MAX_STACK = 20;

/**
 * Met à jour la pile quand on arrive sur `pathname` :
 * - retour à l'avant-dernière page → on dépile (le joueur revient en arrière) ;
 * - nouvelle page → on empile.
 */
export function updateStack(stack: readonly string[], pathname: string): string[] {
  if (stack.at(-1) === pathname) return [...stack];
  if (stack.at(-2) === pathname) return stack.slice(0, -1);
  return [...stack, pathname].slice(-MAX_STACK);
}

/** Page précédente vue depuis `pathname`, que la pile ait déjà été mise à jour ou non. */
export function previousFromStack(stack: readonly string[], pathname: string): string | null {
  const updated = updateStack(stack, pathname);
  return updated.at(-2) ?? null;
}
