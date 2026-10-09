import { describe, expect, it } from "vitest";
import { STARTER_SET } from "@/content/cards/starter-set";
import { botDeck, playerDeck } from "./decks";

describe("decks de bataille", () => {
  it("prend les 8 meilleures cartes du joueur, les plus rares d'abord", () => {
    const { deck, loaned } = playerDeck([...STARTER_SET], [...STARTER_SET]);
    expect(deck).toHaveLength(8);
    expect(loaned).toBe(0);
    expect(deck[0].rarity).toBe("godlevel");
  });

  it("prête des communes à un joueur qui a moins de 8 cartes", () => {
    const owned = STARTER_SET.filter((c) => c.rarity === "rare").slice(0, 3);
    const { deck, loaned } = playerDeck(owned, [...STARTER_SET]);
    expect(deck).toHaveLength(8);
    expect(loaned).toBe(5);
    expect(new Set(deck.map((c) => c.id)).size).toBe(8);
  });

  it("donne au bot des cartes de mêmes raretés que le joueur", () => {
    const { deck } = playerDeck([...STARTER_SET].slice(0, 20), [...STARTER_SET]);
    let r = 1;
    const bot = botDeck(deck, [...STARTER_SET], () => ((r = (r * 48271) % 2147483647) / 2147483647));
    expect(bot.map((c) => c.rarity).sort()).toEqual(deck.map((c) => c.rarity).sort());
  });
});
