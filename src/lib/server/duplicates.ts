import "server-only";
import { GAME_CONFIG } from "@/config/game.config";
import type { Rarity } from "@/config/rarities";
import { countsTowardCap, creditCents, maxSellable, nextUpgrade, sellValueCents, type Level } from "@/lib/economy/duplicates";
import { gameDate } from "@/lib/time/game-day";
import { sql } from "./db";
import { ApiError } from "./http";
import type { Player } from "./players";

/** Revente encore possible aujourd'hui (communes, rares, épiques), en centièmes de MemeMoney. */
export async function resaleLeftCents(player: Player): Promise<number> {
  const rows = await sql()<{ resale_cents: number }[]>`
    select resale_cents from public.daily_usage where player_id = ${player.id} and game_date = ${gameDate(player.timezone)}
  `;
  return Math.max(0, GAME_CONFIG.DUPLICATES.DAILY_SELL_CAP * 100 - (rows[0]?.resale_cents ?? 0));
}

/** Améliore une carte d'un niveau (Dorée ★, Dorée ★★, Divine ★★★) en utilisant des exemplaires en trop. */
export async function upgradeCard(player: Player, cardId: string): Promise<{ level: Level }> {
  return sql().begin(async (tx) => {
    const [row] = await tx<{ quantity: number; upgrade_level: Level; rarity: Rarity }[]>`
      select uc.quantity, uc.upgrade_level, c.rarity
      from public.user_cards uc join public.cards c on c.id = uc.card_id
      where uc.player_id = ${player.id} and uc.card_id = ${cardId}
      for update of uc
    `;
    if (!row) throw new ApiError(404, "card_not_owned");
    const next = nextUpgrade(row.rarity, row.upgrade_level);
    if (!next) throw new ApiError(409, "already_max_variant");
    if (row.quantity - 1 < next.cost) throw new ApiError(409, "not_enough_duplicates");
    await tx`
      update public.user_cards set quantity = quantity - ${next.cost}, upgrade_level = ${next.to}
      where player_id = ${player.id} and card_id = ${cardId}
    `;
    await tx`
      insert into public.economy_ledger (player_id, kind, cards_delta, note)
      values (${player.id}, 'card_upgrade', ${-next.cost}, ${`${cardId}:niveau ${next.to}`})
    `;
    return { level: next.to };
  });
}

/**
 * Revend des exemplaires (une ou plusieurs cartes). Tout ou rien : si une ligne
 * est invalide ou si le plafond du jour serait dépassé, rien n'est vendu.
 */
export async function sellCards(player: Player, lines: Array<{ cardId: string; count: number }>): Promise<{ memeMoney: number; cents: number }> {
  const today = gameDate(player.timezone);
  return sql().begin(async (tx) => {
    const ids = lines.map((l) => l.cardId);
    const owned = await tx<{ card_id: string; quantity: number; rarity: Rarity }[]>`
      select uc.card_id, uc.quantity, c.rarity
      from public.user_cards uc join public.cards c on c.id = uc.card_id
      where uc.player_id = ${player.id} and uc.card_id = any(${ids}::uuid[])
      for update of uc
    `;
    const byId = new Map(owned.map((o) => [o.card_id, o]));
    let cents = 0;
    let cappedCents = 0;
    let count = 0;
    for (const line of lines) {
      const card = byId.get(line.cardId);
      if (!card) throw new ApiError(404, "card_not_owned");
      if (line.count > maxSellable(card.quantity)) throw new ApiError(409, "cannot_sell");
      const value = sellValueCents(card.rarity, line.count);
      cents += value;
      if (countsTowardCap(card.rarity)) cappedCents += value;
      count += line.count;
    }

    const [usage] = await tx<{ resale_cents: number }[]>`
      insert into public.daily_usage (player_id, game_date) values (${player.id}, ${today})
      on conflict (player_id, game_date) do update set resale_cents = public.daily_usage.resale_cents
      returning resale_cents
    `;
    if (usage.resale_cents + cappedCents > GAME_CONFIG.DUPLICATES.DAILY_SELL_CAP * 100) throw new ApiError(409, "daily_sell_cap");

    for (const line of lines) {
      // Le premier exemplaire reste toujours : la carte ne quitte jamais la collection.
      await tx`update public.user_cards set quantity = quantity - ${line.count} where player_id = ${player.id} and card_id = ${line.cardId}`;
    }

    const [w] = await tx<{ meme_money_cents: number }[]>`
      select meme_money_cents from public.player_wallets where player_id = ${player.id} for update
    `;
    const credit = creditCents(w.meme_money_cents, cents);
    await tx`
      update public.player_wallets
      set meme_money = meme_money + ${credit.memeMoney}, meme_money_cents = ${credit.carryCents}
      where player_id = ${player.id}
    `;
    await tx`update public.daily_usage set resale_cents = resale_cents + ${cappedCents} where player_id = ${player.id} and game_date = ${today}`;
    await tx`
      insert into public.economy_ledger (player_id, kind, meme_money_delta, cards_delta, note)
      values (${player.id}, 'card_sell', ${credit.memeMoney}, ${-count}, ${`${cents} centièmes`})
    `;
    return { memeMoney: credit.memeMoney, cents };
  });
}
