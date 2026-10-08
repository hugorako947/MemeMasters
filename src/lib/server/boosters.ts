import "server-only";
import { randomInt } from "node:crypto";
import { GAME_CONFIG } from "@/config/game.config";
import { RARITIES, type Rarity } from "@/config/rarities";
import { drawBoosterRarities, type BoosterKind } from "@/lib/economy/boosters";
import { gameDate, nextLocalMidnight } from "@/lib/time/game-day";
import type { Card } from "@/lib/validation/card";
import { CARD_COLUMNS, toCard } from "./cards";
import { sql } from "./db";
import { ApiError } from "./http";
import type { Player } from "./players";

/** Nombre aléatoire cryptographique dans [0, 1[ (jamais Math.random côté serveur). */
const secureRandom = () => randomInt(0, 2 ** 32) / 2 ** 32;

export interface BoosterState {
  /** Boosters journaliers gratuits restants aujourd'hui. */
  freeLeft: number;
  freePerDay: number;
  /** Boosters journaliers en réserve : offerts (défis, rangs) + achetés en MemeMoney. */
  dailyReserve: number;
  special: number;
  verySpecial: number;
  memeMoney: number;
  /** Prochain retour des boosters gratuits (minuit, fuseau du joueur). */
  nextReset: string;
}

export async function getBoosterState(player: Player): Promise<BoosterState> {
  const today = gameDate(player.timezone);
  const [rows, usage] = await Promise.all([
    sql()<{ bonus_boosters: number; paid_boosters: number; special_boosters: number; very_special_boosters: number; meme_money: number }[]>`
      select bonus_boosters, paid_boosters, special_boosters, very_special_boosters, meme_money
      from public.player_wallets where player_id = ${player.id}
    `,
    sql()<{ free_boosters_opened: number }[]>`
      select free_boosters_opened from public.daily_usage where player_id = ${player.id} and game_date = ${today}
    `,
  ]);
  const w = rows[0] ?? { bonus_boosters: 0, paid_boosters: 0, special_boosters: 0, very_special_boosters: 0, meme_money: 0 };
  const used = usage[0]?.free_boosters_opened ?? 0;
  return {
    freeLeft: Math.max(0, GAME_CONFIG.DAILY_FREE_BOOSTERS - used),
    freePerDay: GAME_CONFIG.DAILY_FREE_BOOSTERS,
    dailyReserve: w.bonus_boosters + w.paid_boosters,
    special: w.special_boosters,
    verySpecial: w.very_special_boosters,
    memeMoney: w.meme_money,
    nextReset: nextLocalMidnight(player.timezone).toISOString(),
  };
}

export interface OpenedBooster {
  kind: BoosterKind;
  /** Cartes dans l'ordre de révélation (de la plus courante à la plus rare). */
  cards: Card[];
  /** Identifiants des cartes que le joueur n'avait pas encore. */
  newCardIds: string[];
  pityTriggered: boolean;
}

/**
 * Ouvre un booster, dans une seule transaction : vérifie et consomme le
 * booster, tire les raretés (aléatoire cryptographique), choisit les cartes,
 * les ajoute à la collection, met à jour le pity, l'usage du jour et le journal.
 * Le résultat est enregistré AVANT toute animation : fermer l'app ne fait rien perdre.
 */
export async function openBooster(player: Player, kind: BoosterKind): Promise<OpenedBooster> {
  const today = gameDate(player.timezone);
  return sql().begin(async (tx) => {
    const [w] = await tx<
      { bonus_boosters: number; paid_boosters: number; special_boosters: number; very_special_boosters: number; pity_counter: number }[]
    >`
      select bonus_boosters, paid_boosters, special_boosters, very_special_boosters, pity_counter
      from public.player_wallets where player_id = ${player.id} for update
    `;
    if (!w) throw new ApiError(403, "profile_required");

    // Quel booster consommer : d'abord les gratuits du jour, puis les offerts, puis les achetés.
    let source: "free" | "bonus" | "paid";
    let walletColumn: "bonus_boosters" | "paid_boosters" | "special_boosters" | "very_special_boosters" | null = null;
    if (kind === "daily") {
      const [u] = await tx<{ free_boosters_opened: number }[]>`
        insert into public.daily_usage (player_id, game_date) values (${player.id}, ${today})
        on conflict (player_id, game_date) do update set free_boosters_opened = public.daily_usage.free_boosters_opened
        returning free_boosters_opened
      `;
      if (u.free_boosters_opened < GAME_CONFIG.DAILY_FREE_BOOSTERS) source = "free";
      else if (w.bonus_boosters > 0) [source, walletColumn] = ["bonus", "bonus_boosters"];
      else if (w.paid_boosters > 0) [source, walletColumn] = ["paid", "paid_boosters"];
      else throw new ApiError(409, "no_booster");
    } else if (kind === "special") {
      if (w.special_boosters < 1) throw new ApiError(409, "no_booster");
      [source, walletColumn] = ["paid", "special_boosters"];
    } else {
      if (w.very_special_boosters < 1) throw new ApiError(409, "no_booster");
      [source, walletColumn] = ["paid", "very_special_boosters"];
    }

    const draw = drawBoosterRarities(kind, secureRandom, kind === "daily" ? w.pity_counter : 0);

    // Cartes disponibles, par rareté. Si une rareté n'a aucune carte, on prend la plus proche en dessous.
    const pool = await tx<{ id: string; rarity: Rarity }[]>`
      select id, rarity from public.cards where is_active and is_droppable
    `;
    if (pool.length === 0) throw new ApiError(409, "no_cards");
    const byRarity = new Map<Rarity, string[]>();
    for (const c of pool) byRarity.set(c.rarity, [...(byRarity.get(c.rarity) ?? []), c.id]);
    const pick = (rarity: Rarity): string => {
      for (let i = RARITIES.indexOf(rarity); i >= 0; i--) {
        const ids = byRarity.get(RARITIES[i]);
        if (ids?.length) return ids[randomInt(0, ids.length)];
      }
      return pool[randomInt(0, pool.length)].id;
    };
    const cardIds = draw.rarities.map(pick);

    const owned = await tx<{ card_id: string }[]>`
      select card_id from public.user_cards where player_id = ${player.id} and card_id = any(${cardIds}::uuid[])
    `;
    const ownedSet = new Set(owned.map((o) => o.card_id));
    const counts = new Map<string, number>();
    for (const id of cardIds) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const [cardId, n] of counts) {
      await tx`
        insert into public.user_cards (player_id, card_id, quantity) values (${player.id}, ${cardId}, ${n})
        on conflict (player_id, card_id)
        do update set quantity = public.user_cards.quantity + ${n}, last_obtained_at = now()
      `;
    }

    if (source === "free") {
      await tx`update public.daily_usage set free_boosters_opened = free_boosters_opened + 1 where player_id = ${player.id} and game_date = ${today}`;
    }
    if (walletColumn) {
      await tx`update public.player_wallets set ${tx(walletColumn)} = ${tx(walletColumn)} - 1 where player_id = ${player.id}`;
    }
    if (kind === "daily") {
      // Pity : remis à zéro dès que l'emplacement au choix donne la rareté supérieure.
      const pity = draw.upgraded ? 0 : w.pity_counter + 1;
      await tx`update public.player_wallets set pity_counter = ${pity} where player_id = ${player.id}`;
    }

    const realRarities = await tx<{ id: string; rarity: Rarity }[]>`
      select id, rarity from public.cards where id = any(${cardIds}::uuid[])
    `;
    const rarityOf = new Map(realRarities.map((r) => [r.id, r.rarity]));
    const [opening] = await tx<{ id: string }[]>`
      insert into public.booster_openings (player_id, kind, source, card_ids, rarities, pity_triggered)
      values (${player.id}, ${kind}, ${source}, ${cardIds}::uuid[], ${cardIds.map((id) => rarityOf.get(id)!)}::public.rarity[], ${draw.pityTriggered})
      returning id
    `;
    await tx`
      insert into public.economy_ledger (player_id, kind, bonus_boosters_delta, paid_boosters_delta, ref_id, note)
      values (${player.id}, 'booster_open',
              ${walletColumn === "bonus_boosters" ? -1 : 0},
              ${walletColumn && walletColumn !== "bonus_boosters" ? -1 : 0},
              ${opening.id}, ${`${kind}:${source}`})
    `;

    const rows = await tx.unsafe(`select ${CARD_COLUMNS} from public.cards where id = any($1::uuid[])`, [cardIds]);
    const cardById = new Map(rows.map((r) => [r.id as string, toCard(r as unknown as Parameters<typeof toCard>[0])]));
    const cards = cardIds.map((id) => cardById.get(id)!).sort((a, b) => RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity));
    const newCardIds = [...new Set(cardIds.filter((id) => !ownedSet.has(id)))];
    return { kind, cards, newCardIds, pityTriggered: draw.pityTriggered };
  });
}

export const BUYABLE = {
  extra: { column: "paid_boosters", price: () => GAME_CONFIG.MEME_MONEY.EXTRA_DAILY_BOOSTER_PRICE },
  special: { column: "special_boosters", price: () => GAME_CONFIG.MEME_MONEY.SPECIAL_BOOSTER_PRICE },
  very_special: { column: "very_special_boosters", price: () => GAME_CONFIG.MEME_MONEY.VERY_SPECIAL_BOOSTER_PRICE },
} as const;
export type BuyableBooster = keyof typeof BUYABLE;

/** Achète un booster avec de la MemeMoney (débit et crédit dans la même transaction). */
export async function buyBooster(player: Player, item: BuyableBooster): Promise<void> {
  const { column, price } = BUYABLE[item];
  const cost = price();
  await sql().begin(async (tx) => {
    const [w] = await tx<{ meme_money: number }[]>`
      select meme_money from public.player_wallets where player_id = ${player.id} for update
    `;
    if (!w) throw new ApiError(403, "profile_required");
    if (w.meme_money < cost) throw new ApiError(409, "not_enough_meme_money");
    await tx`
      update public.player_wallets
      set meme_money = meme_money - ${cost}, ${tx(column)} = ${tx(column)} + 1
      where player_id = ${player.id}
    `;
    await tx`
      insert into public.economy_ledger (player_id, kind, meme_money_delta, paid_boosters_delta, note)
      values (${player.id}, 'meme_money_spend', ${-cost}, 1, ${`buy:${item}`})
    `;
  });
}
