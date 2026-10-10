import "server-only";
import { z } from "zod";
import { sql } from "./db";
import { ApiError } from "./http";
import type { Player } from "./players";

export const REPORT_REASONS = ["spam", "harassment", "hate", "inappropriate_name", "cheating", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const reportSchema = z.object({
  playerId: z.uuid(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(500).optional(),
  messageId: z.uuid().optional(),
});

/** Vrai si l'un des deux joueurs a bloqué l'autre. */
export async function isBlockedBetween(a: string, b: string): Promise<boolean> {
  const rows = await sql()`
    select 1 from public.player_blocks
    where (blocker_id = ${a} and blocked_id = ${b}) or (blocker_id = ${b} and blocked_id = ${a})
    limit 1
  `;
  return rows.length > 0;
}

/** Vrai si le joueur a lui-même bloqué l'autre (pour afficher « Débloquer »). */
export async function hasBlocked(playerId: string, otherId: string): Promise<boolean> {
  const rows = await sql()`select 1 from public.player_blocks where blocker_id = ${playerId} and blocked_id = ${otherId}`;
  return rows.length > 0;
}

/** Joueurs bloqués par le joueur (liste dans le profil, pour pouvoir débloquer). */
export async function blockedPlayers(playerId: string): Promise<Array<{ id: string; username: string; trophies: number }>> {
  return sql()<{ id: string; username: string; trophies: number }[]>`
    select p.id, p.username::text as username, p.trophies
    from public.player_blocks b join public.profiles p on p.id = b.blocked_id
    where b.blocker_id = ${playerId}
    order by p.username
  `;
}

/** Bloque un joueur : supprime l'amitié ou les demandes en cours entre les deux. */
export async function blockPlayer(player: Player, otherId: string): Promise<void> {
  if (otherId === player.id) throw new ApiError(409, "friend_self");
  await sql().begin(async (tx) => {
    const [exists] = await tx`select 1 from public.profiles where id = ${otherId}`;
    if (!exists) throw new ApiError(404, "player_not_found");
    await tx`insert into public.player_blocks (blocker_id, blocked_id) values (${player.id}, ${otherId}) on conflict do nothing`;
    await tx`
      delete from public.friendships
      where least(requester_id, addressee_id) = least(${player.id}::uuid, ${otherId}::uuid)
        and greatest(requester_id, addressee_id) = greatest(${player.id}::uuid, ${otherId}::uuid)
    `;
  });
}

export async function unblockPlayer(player: Player, otherId: string): Promise<void> {
  await sql()`delete from public.player_blocks where blocker_id = ${player.id} and blocked_id = ${otherId}`;
}

/** Enregistre un signalement (5 par jour au plus contre un même joueur, pour éviter les abus). */
export async function reportPlayer(player: Player, input: z.infer<typeof reportSchema>): Promise<void> {
  if (input.playerId === player.id) throw new ApiError(409, "friend_self");
  const [{ n }] = await sql()<{ n: number }[]>`
    select count(*)::int as n from public.player_reports
    where reporter_id = ${player.id} and reported_id = ${input.playerId} and created_at > now() - interval '1 day'
  `;
  if (n >= 5) throw new ApiError(429, "rate_limited");
  await sql()`
    insert into public.player_reports (reporter_id, reported_id, reason, details, message_id)
    values (${player.id}, ${input.playerId}, ${input.reason}, ${input.details || null}, ${input.messageId ?? null})
  `;
}
