import "server-only";
import type { Rarity } from "@/config/rarities";
import { creditCents, maxSellable, nextUpgrade, planBulkUpgrade, sellValueCents, type Level } from "@/lib/economy/duplicates";
import { sql } from "./db";
import { ApiError } from "./http";
import type { Player } from "./players";

/** Fait évoluer une carte d'un niveau (★, ★★, ★★★, puis Divine) en utilisant des exemplaires en trop. */
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
 * « Tout faire évoluer » : chaque carte du joueur monte d'autant d'évolutions que ses exemplaires en trop le permettent
 * (calcul de planBulkUpgrade, sur les quantités lues et verrouillées dans la transaction). Rien à faire évoluer : 409.
 */
export async function upgradeAllCards(player: Player): Promise<{ cards: number; evolutions: number; used: number }> {
  return sql().begin(async (tx) => {
    const rows = await tx<{ card_id: string; quantity: number; upgrade_level: Level; rarity: Rarity }[]>`
      select uc.card_id, uc.quantity, uc.upgrade_level, c.rarity
      from public.user_cards uc join public.cards c on c.id = uc.card_id
      where uc.player_id = ${player.id} and uc.quantity > 1
      order by uc.card_id
      for update of uc
    `;
    const plan = planBulkUpgrade(rows.map((r) => ({ cardId: r.card_id, rarity: r.rarity, quantity: r.quantity, level: r.upgrade_level })));
    if (plan.lines.length === 0) throw new ApiError(409, "nothing_to_evolve");
    const ids = plan.lines.map((l) => l.cardId);
    const used = plan.lines.map((l) => l.used);
    const levels = plan.lines.map((l) => l.to);
    await tx`
      update public.user_cards uc set quantity = uc.quantity - v.used, upgrade_level = v.level
      from unnest(${ids}::uuid[], ${used}::int[], ${levels}::int[]) as v(card_id, used, level)
      where uc.player_id = ${player.id} and uc.card_id = v.card_id
    `;
    await tx`
      insert into public.economy_ledger (player_id, kind, cards_delta, note)
      select ${player.id}, 'card_upgrade', -v.used, v.card_id::text || ':niveau ' || v.level
      from unnest(${ids}::uuid[], ${used}::int[], ${levels}::int[]) as v(card_id, used, level)
    `;
    return { cards: plan.lines.length, evolutions: plan.evolutions, used: plan.used };
  });
}

/**
 * Revend des exemplaires (une ou plusieurs cartes). Tout ou rien : si une ligne
 * est invalide, rien n'est vendu. Aucune limite quotidienne de revente.
 */
export async function sellCards(player: Player, lines: Array<{ cardId: string; count: number }>): Promise<{ memeMoney: number; cents: number }> {
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
    let count = 0;
    for (const line of lines) {
      const card = byId.get(line.cardId);
      if (!card) throw new ApiError(404, "card_not_owned");
      if (line.count > maxSellable(card.quantity)) throw new ApiError(409, "cannot_sell");
      cents += sellValueCents(card.rarity, line.count);
      count += line.count;
    }

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
    await tx`
      insert into public.economy_ledger (player_id, kind, meme_money_delta, cards_delta, note)
      values (${player.id}, 'card_sell', ${credit.memeMoney}, ${-count}, ${`${cents} centièmes`})
    `;
    return { memeMoney: credit.memeMoney, cents };
  });
}
