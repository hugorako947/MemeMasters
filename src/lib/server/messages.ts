import "server-only";
import { sql } from "./db";
import { ApiError } from "./http";
import type { Player } from "./players";

export const MESSAGE_RULES = {
  MAX_LENGTH: 500,
  /** Messages qu'on peut envoyer à un joueur qui n'est pas ami, tant qu'il n'a pas répondu. */
  NON_FRIEND_UNANSWERED: 3,
  PAGE: 60,
} as const;

export interface Conversation {
  other: { id: string; username: string; trophies: number };
  last: { body: string; createdAt: string; fromMe: boolean };
  unread: number;
}

export interface ThreadMessage {
  id: string;
  fromMe: boolean;
  body: string;
  createdAt: string;
  read: boolean;
}

export interface Thread {
  other: { id: string; username: string; trophies: number };
  messages: ThreadMessage[];
  friends: boolean;
  /** Pourquoi on ne peut pas écrire, le cas échéant. */
  blocked: "by_me" | "by_them" | null;
  /** Messages encore possibles avant une réponse (joueur non ami), sinon null. */
  remaining: number | null;
}

/** Conversations du joueur, la plus récente d'abord, avec le nombre de messages non lus. */
export async function listConversations(playerId: string): Promise<Conversation[]> {
  const rows = await sql()<
    { other_id: string; username: string; trophies: number; body: string; created_at: Date; sender_id: string; unread: number }[]
  >`
    with mine as (
      select case when sender_id = ${playerId} then recipient_id else sender_id end as other_id, body, created_at, sender_id
      from public.messages where ${playerId} in (sender_id, recipient_id)
    ), last as (
      select distinct on (other_id) other_id, body, created_at, sender_id from mine order by other_id, created_at desc
    ), unread as (
      select sender_id as other_id, count(*)::int as n from public.messages
      where recipient_id = ${playerId} and read_at is null group by sender_id
    )
    select last.other_id, p.username::text as username, p.trophies, last.body, last.created_at, last.sender_id, coalesce(unread.n, 0) as unread
    from last join public.profiles p on p.id = last.other_id
    left join unread on unread.other_id = last.other_id
    order by last.created_at desc
    limit 50
  `;
  return rows.map((r) => ({
    other: { id: r.other_id, username: r.username, trophies: r.trophies },
    last: { body: r.body, createdAt: r.created_at.toISOString(), fromMe: r.sender_id === playerId },
    unread: r.unread,
  }));
}

export async function unreadMessages(playerId: string): Promise<number> {
  const [r] = await sql()<{ n: number }[]>`select count(*)::int as n from public.messages where recipient_id = ${playerId} and read_at is null`;
  return r.n;
}

async function findPlayer(username: string) {
  const [p] = await sql()<{ id: string; username: string; trophies: number }[]>`
    select id, username::text as username, trophies from public.profiles where username = ${username}
  `;
  if (!p) throw new ApiError(404, "player_not_found");
  return p;
}

/** Situation entre deux joueurs : amis ? bloqués ? messages encore possibles ? */
async function status(playerId: string, otherId: string): Promise<Pick<Thread, "friends" | "blocked" | "remaining">> {
  const [r] = await sql()<{ friends: boolean; by_me: boolean; by_them: boolean; unanswered: number }[]>`
    select
      exists (select 1 from public.friendships where status = 'accepted'
              and least(requester_id, addressee_id) = least(${playerId}::uuid, ${otherId}::uuid)
              and greatest(requester_id, addressee_id) = greatest(${playerId}::uuid, ${otherId}::uuid)) as friends,
      exists (select 1 from public.player_blocks where blocker_id = ${playerId} and blocked_id = ${otherId}) as by_me,
      exists (select 1 from public.player_blocks where blocker_id = ${otherId} and blocked_id = ${playerId}) as by_them,
      (select count(*)::int from public.messages
        where sender_id = ${playerId} and recipient_id = ${otherId}
          and created_at > coalesce((select max(created_at) from public.messages where sender_id = ${otherId} and recipient_id = ${playerId}), '-infinity')
      ) as unanswered
  `;
  return {
    friends: r.friends,
    blocked: r.by_me ? "by_me" : r.by_them ? "by_them" : null,
    remaining: r.friends ? null : Math.max(0, MESSAGE_RULES.NON_FRIEND_UNANSWERED - r.unanswered),
  };
}

/** Conversation avec un joueur ; les messages reçus sont marqués comme lus. */
export async function getThread(player: Player, username: string): Promise<Thread> {
  const other = await findPlayer(username);
  if (other.id === player.id) throw new ApiError(409, "friend_self");
  const [rows] = await Promise.all([
    sql()<{ id: string; sender_id: string; body: string; created_at: Date; read_at: Date | null }[]>`
      select id, sender_id, body, created_at, read_at from public.messages
      where least(sender_id, recipient_id) = least(${player.id}::uuid, ${other.id}::uuid)
        and greatest(sender_id, recipient_id) = greatest(${player.id}::uuid, ${other.id}::uuid)
      order by created_at desc
      limit ${MESSAGE_RULES.PAGE}
    `,
    sql()`update public.messages set read_at = now() where recipient_id = ${player.id} and sender_id = ${other.id} and read_at is null`,
  ]);
  return {
    other,
    messages: rows.reverse().map((m) => ({ id: m.id, fromMe: m.sender_id === player.id, body: m.body, createdAt: m.created_at.toISOString(), read: m.read_at !== null })),
    ...(await status(player.id, other.id)),
  };
}

/** Envoie un message (refusé si l'un a bloqué l'autre, ou après 3 messages sans réponse à un non-ami). */
export async function sendMessage(player: Player, username: string, body: string): Promise<ThreadMessage> {
  const text = body.trim();
  if (text.length === 0 || text.length > MESSAGE_RULES.MAX_LENGTH) throw new ApiError(400, "invalid_input");
  const other = await findPlayer(username);
  if (other.id === player.id) throw new ApiError(409, "friend_self");
  const s = await status(player.id, other.id);
  if (s.blocked) throw new ApiError(403, "blocked");
  if (s.remaining === 0) throw new ApiError(409, "message_limit");
  const [m] = await sql()<{ id: string; created_at: Date }[]>`
    insert into public.messages (sender_id, recipient_id, body) values (${player.id}, ${other.id}, ${text}) returning id, created_at
  `;
  return { id: m.id, fromMe: true, body: text, createdAt: m.created_at.toISOString(), read: false };
}
