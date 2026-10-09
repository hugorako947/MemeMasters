import "server-only";
import type { Rarity } from "@/config/rarities";
import type { Vibe } from "@/config/vibes";
import type { Level } from "@/lib/economy/duplicates";
import type { Card } from "@/lib/validation/card";
import { sql } from "./db";

interface CardRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  rarity: Rarity;
  vibe: Vibe;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  normal_attack: Card["normalAttack"];
  special_attack: Card["specialAttack"];
  defense_ability: Card["defenseAbility"];
  art_seed: number;
  image_path: string | null;
}

export const CARD_COLUMNS = "id, slug, name, description, rarity, vibe, hp, atk, def, spd, normal_attack, special_attack, defense_ability, art_seed, image_path";

export function toCard(r: CardRow): Card {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    rarity: r.rarity,
    vibe: r.vibe,
    hp: r.hp,
    atk: r.atk,
    def: r.def,
    spd: r.spd,
    normalAttack: r.normal_attack,
    specialAttack: r.special_attack,
    defenseAbility: r.defense_ability,
    artSeed: r.art_seed,
    // Les images téléversées (Storage) arriveront avec l'administration.
    imageUrl: null,
  };
}

export interface CollectionEntry {
  card: Card;
  quantity: number;
  level: Level;
  firstObtainedAt: string | null;
}

/** Toutes les cartes actives du jeu, avec la quantité possédée par le joueur. */
export async function getCollection(playerId: string): Promise<CollectionEntry[]> {
  const rows = await sql()<(CardRow & { quantity: number | null; upgrade_level: Level | null; first_obtained_at: Date | null })[]>`
    select c.id, c.slug, c.name, c.description, c.rarity, c.vibe, c.hp, c.atk, c.def, c.spd,
           c.normal_attack, c.special_attack, c.defense_ability, c.art_seed, c.image_path,
           uc.quantity, uc.upgrade_level, uc.first_obtained_at
    from public.cards c
    left join public.user_cards uc on uc.card_id = c.id and uc.player_id = ${playerId}
    where c.is_active
    order by c.rarity desc, c.name
  `;
  return rows.map((r) => ({
    card: toCard(r),
    quantity: r.quantity ?? 0,
    level: r.upgrade_level ?? 0,
    firstObtainedAt: r.first_obtained_at ? r.first_obtained_at.toISOString() : null,
  }));
}
