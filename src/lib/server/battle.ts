import "server-only";
import { sql } from "./db";
import { ApiError } from "./http";
import type { Player } from "./players";

/**
 * Personnage du Battle Royale choisi par le joueur (une carte de sa collection), ou null s'il n'en a pas
 * encore choisi. Une carte qu'il ne possède plus (ou retirée du jeu) ne compte pas.
 */
export async function getBattleCharacterId(playerId: string): Promise<string | null> {
  const rows = await sql()<{ card_id: string }[]>`
    select b.card_id
    from public.br_characters b
    join public.user_cards uc on uc.player_id = b.player_id and uc.card_id = b.card_id and uc.quantity >= 1
    join public.cards c on c.id = b.card_id and c.is_active
    where b.player_id = ${playerId}
  `;
  return rows[0]?.card_id ?? null;
}

/** Choisit le personnage du Battle Royale : une carte active que le joueur possède. Erreur : 403 card_not_owned. */
export async function chooseBattleCharacter(player: Player, cardId: string): Promise<{ cardId: string }> {
  return sql().begin(async (tx) => {
    const owned = await tx`
      select 1 from public.user_cards uc
      join public.cards c on c.id = uc.card_id and c.is_active
      where uc.player_id = ${player.id} and uc.card_id = ${cardId} and uc.quantity >= 1
    `;
    if (owned.length === 0) throw new ApiError(403, "card_not_owned");
    await tx`
      insert into public.br_characters (player_id, card_id) values (${player.id}, ${cardId})
      on conflict (player_id) do update set card_id = excluded.card_id, updated_at = now()
    `;
    return { cardId };
  });
}
