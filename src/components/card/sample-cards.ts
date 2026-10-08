/**
 * Cartes affichées en vitrine (accueil visiteur, raretés, aperçus) : ce sont
 * les cartes du jeu de départ. La première carte de chaque rareté sert de
 * modèle pour cette rareté.
 */
import { STARTER_SET } from "@/content/cards/starter-set";
import type { Card } from "@/lib/validation/card";

export const SAMPLE_CARDS: readonly Card[] = STARTER_SET;

/** Première carte du jeu de départ pour une rareté. */
export function sampleOf(rarity: Card["rarity"]): Card {
  return STARTER_SET.find((c) => c.rarity === rarity)!;
}
