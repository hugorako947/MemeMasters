/**
 * Decks de bataille (8 cartes).
 * - Joueur : ses 8 meilleures cartes possédées (rareté puis puissance) ; s'il en
 *   a moins de 8, des communes du jeu de départ sont prêtées pour compléter.
 * - Bot : pour chaque carte du joueur, une carte de même rareté au hasard,
 *   pour un adversaire de niveau comparable.
 */
import { RARITIES } from "@/config/rarities";
import { statIndex } from "@/lib/cards/balance";
import type { Card } from "@/lib/validation/card";
import { RULES } from "./rules";

export function playerDeck(owned: Card[], fallback: Card[]): { deck: Card[]; loaned: number } {
  const sorted = [...owned].sort((a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity) || statIndex(b) - statIndex(a));
  const deck = sorted.slice(0, RULES.DECK_SIZE);
  const commons = fallback.filter((c) => c.rarity === "commune" && !deck.some((d) => d.id === c.id));
  let loaned = 0;
  while (deck.length < RULES.DECK_SIZE && commons.length > 0) {
    deck.push(commons.shift()!);
    loaned++;
  }
  return { deck, loaned };
}

export function botDeck(player: Card[], pool: Card[], random: () => number): Card[] {
  const used = new Set<string>();
  return player.map((card) => {
    const same = pool.filter((c) => c.rarity === card.rarity && !used.has(c.id));
    const choice = same.length > 0 ? same[Math.floor(random() * same.length)] : pool[Math.floor(random() * pool.length)];
    used.add(choice.id);
    return choice;
  });
}
