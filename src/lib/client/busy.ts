/**
 * Élément « en cours » : le bouton, l'onglet, le lien ou le sachet qui a lancé
 * une action. Il ignore les nouveaux clics et, si l'action dure, affiche un
 * cercle tournant à la place de son contenu (styles [data-mm-busy] dans
 * globals.css). Un élément portant data-mm-busy-style="overlay" garde son
 * contenu visible, atténué, sous le cercle (ex. le sachet de booster).
 */

/** Dernier élément pressé (clic ou clavier), pour l'associer à l'action qu'il déclenche. */
let pressed: { el: HTMLElement; at: number } | null = null;

if (typeof document !== "undefined") {
  const remember = (e: Event) => {
    const el = (e.target as Element | null)?.closest?.("button, [role='button'], [role='tab'], a[href]");
    if (el instanceof HTMLElement) pressed = { el, at: performance.now() };
  };
  document.addEventListener("click", remember, true);
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Enter" || e.key === " ") remember(e);
    },
    true,
  );
}

/** Marque un élément « en cours ». Renvoie la fonction qui l'en retire. */
export function markBusy(el: HTMLElement | null | undefined): () => void {
  if (!el || el.dataset.mmBusy) return () => undefined;
  el.dataset.mmBusy = el.dataset.mmBusyStyle === "overlay" ? "overlay" : "true";
  el.setAttribute("aria-busy", "true");
  return () => {
    delete el.dataset.mmBusy;
    el.removeAttribute("aria-busy");
  };
}

/** Élément pressé à l'instant (moins de 0,8 s), ou null. Ne sert qu'une fois. */
export function takePressed(): HTMLElement | null {
  const el = pressed && performance.now() - pressed.at < 800 && pressed.el.isConnected ? pressed.el : null;
  pressed = null;
  return el;
}
