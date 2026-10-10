import "server-only";
import { sql } from "./db";
import { ApiError } from "./http";
import type { Player } from "./players";

export const FRIENDS_LIMITS = { MAX_FRIENDS: 200, MAX_PENDING_OUT: 50 } as const;

export interface FriendLite {
  id: string;
  username: string;
  trophies: number;
}

export interface FriendsOverview {
  friends: Array<FriendLite & { since: string }>;
  incoming: Array<{ requestId: string; from: FriendLite; createdAt: string }>;
  outgoing: Array<{ requestId: string; to: FriendLite; createdAt: string }>;
}

export type Relation =
  | { kind: "self" }
  | { kind: "none" }
  | { kind: "friends" }
  | { kind: "outgoing"; requestId: string }
  | { kind: "incoming"; requestId: string };

type Row = { id: string; status: "pending" | "accepted"; requester_id: string; addressee_id: string; created_at: Date; responded_at: Date | null; other_id: string; other_username: string; other_trophies: number };

/** Amis, demandes reçues et demandes envoyées du joueur. */
export async function getFriendsOverview(playerId: string): Promise<FriendsOverview> {
  const rows = await sql()<Row[]>`
    select f.id, f.status, f.requester_id, f.addressee_id, f.created_at, f.responded_at,
           p.id as other_id, p.username::text as other_username, p.trophies as other_trophies
    from public.friendships f
    join public.profiles p on p.id = case when f.requester_id = ${playerId} then f.addressee_id else f.requester_id end
    where ${playerId} in (f.requester_id, f.addressee_id)
    order by p.username
  `;
  const lite = (r: Row): FriendLite => ({ id: r.other_id, username: r.other_username, trophies: r.other_trophies });
  return {
    friends: rows.filter((r) => r.status === "accepted").map((r) => ({ ...lite(r), since: (r.responded_at ?? r.created_at).toISOString() })),
    incoming: rows
      .filter((r) => r.status === "pending" && r.addressee_id === playerId)
      .map((r) => ({ requestId: r.id, from: lite(r), createdAt: r.created_at.toISOString() })),
    outgoing: rows
      .filter((r) => r.status === "pending" && r.requester_id === playerId)
      .map((r) => ({ requestId: r.id, to: lite(r), createdAt: r.created_at.toISOString() })),
  };
}

/** Relation entre le joueur connecté et un autre joueur (bouton du profil). */
export async function relationWith(playerId: string, otherId: string): Promise<Relation> {
  if (playerId === otherId) return { kind: "self" };
  const [r] = await sql()<{ id: string; status: string; requester_id: string }[]>`
    select id, status, requester_id from public.friendships
    where least(requester_id, addressee_id) = least(${playerId}::uuid, ${otherId}::uuid)
      and greatest(requester_id, addressee_id) = greatest(${playerId}::uuid, ${otherId}::uuid)
  `;
  if (!r) return { kind: "none" };
  if (r.status === "accepted") return { kind: "friends" };
  return r.requester_id === playerId ? { kind: "outgoing", requestId: r.id } : { kind: "incoming", requestId: r.id };
}

/** Recherche de joueurs par début de pseudo (10 résultats), avec la relation de chacun. */
export async function searchPlayers(playerId: string, query: string): Promise<Array<FriendLite & { relation: Relation["kind"] }>> {
  const q = query.trim();
  if (q.length < 2) return [];
  const rows = await sql()<(FriendLite & { status: string | null; requester_id: string | null })[]>`
    select p.id, p.username::text as username, p.trophies, f.status::text as status, f.requester_id
    from public.profiles p
    left join public.friendships f
      on least(f.requester_id, f.addressee_id) = least(p.id, ${playerId}::uuid)
     and greatest(f.requester_id, f.addressee_id) = greatest(p.id, ${playerId}::uuid)
    where p.id <> ${playerId} and p.username ilike ${q.replace(/[%_\\]/g, "\\$&") + "%"}
      and not exists (
        select 1 from public.player_blocks b
        where (b.blocker_id = ${playerId} and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = ${playerId})
      )
    order by length(p.username), p.username
    limit 10
  `;
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    trophies: r.trophies,
    relation: !r.status ? "none" : r.status === "accepted" ? "friends" : r.requester_id === playerId ? "outgoing" : "incoming",
  }));
}

/**
 * Envoie une demande d'ami. Si l'autre joueur nous avait déjà envoyé une
 * demande, elle est acceptée directement (les deux le veulent).
 */
export async function sendRequest(player: Player, username: string): Promise<{ status: "sent" | "accepted" }> {
  return sql().begin(async (tx) => {
    const [target] = await tx<{ id: string }[]>`select id from public.profiles where username = ${username}`;
    if (!target) throw new ApiError(404, "player_not_found");
    if (target.id === player.id) throw new ApiError(409, "friend_self");
    const [blocked] = await tx`
      select 1 from public.player_blocks
      where (blocker_id = ${player.id} and blocked_id = ${target.id}) or (blocker_id = ${target.id} and blocked_id = ${player.id})
    `;
    if (blocked) throw new ApiError(403, "blocked");
    const [existing] = await tx<{ id: string; status: string; requester_id: string }[]>`
      select id, status, requester_id from public.friendships
      where least(requester_id, addressee_id) = least(${player.id}::uuid, ${target.id}::uuid)
        and greatest(requester_id, addressee_id) = greatest(${player.id}::uuid, ${target.id}::uuid)
      for update
    `;
    if (existing?.status === "accepted") throw new ApiError(409, "already_friends");
    if (existing && existing.requester_id === player.id) throw new ApiError(409, "already_requested");
    const [{ friends, pending }] = await tx<{ friends: number; pending: number }[]>`
      select count(*) filter (where status = 'accepted')::int as friends,
             count(*) filter (where status = 'pending' and requester_id = ${player.id})::int as pending
      from public.friendships where ${player.id} in (requester_id, addressee_id)
    `;
    if (friends >= FRIENDS_LIMITS.MAX_FRIENDS) throw new ApiError(409, "friends_limit");
    if (existing) {
      await tx`update public.friendships set status = 'accepted', responded_at = now() where id = ${existing.id}`;
      return { status: "accepted" };
    }
    if (pending >= FRIENDS_LIMITS.MAX_PENDING_OUT) throw new ApiError(409, "pending_limit");
    await tx`insert into public.friendships (requester_id, addressee_id) values (${player.id}, ${target.id})`;
    return { status: "sent" };
  });
}

/** Accepte ou refuse une demande reçue. */
export async function respondRequest(player: Player, requestId: string, accept: boolean): Promise<void> {
  const rows = accept
    ? await sql()`
        update public.friendships set status = 'accepted', responded_at = now()
        where id = ${requestId} and addressee_id = ${player.id} and status = 'pending' returning id`
    : await sql()`
        delete from public.friendships
        where id = ${requestId} and addressee_id = ${player.id} and status = 'pending' returning id`;
  if (rows.length === 0) throw new ApiError(404, "request_not_found");
}

/** Retire un ami, ou annule une demande envoyée (ou reçue). */
export async function removeRelation(player: Player, otherId: string): Promise<void> {
  await sql()`
    delete from public.friendships
    where least(requester_id, addressee_id) = least(${player.id}::uuid, ${otherId}::uuid)
      and greatest(requester_id, addressee_id) = greatest(${player.id}::uuid, ${otherId}::uuid)
  `;
}

export async function incomingCount(playerId: string): Promise<number> {
  const [r] = await sql()<{ n: number }[]>`
    select count(*)::int as n from public.friendships where addressee_id = ${playerId} and status = 'pending'
  `;
  return r.n;
}
