/**
 * Ouvrir une page glissante depuis l'intérieur d'une autre (ex. « Changer » de la page Battle Royale, qui ouvre la
 * Collection) : un événement du navigateur que SlideDeck écoute. Un lien vers « ?vue=… » ne suffit pas quand on est
 * déjà sur la page : l'adresse change, mais la page affichée non.
 */
export const SHOW_SLIDE_EVENT = "mm:show-slide";

export function showSlide(key: string): void {
  window.dispatchEvent(new CustomEvent<string>(SHOW_SLIDE_EVENT, { detail: key }));
}
