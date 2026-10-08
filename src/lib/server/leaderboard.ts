import "server-only";
import { GAME_CONFIG } from "@/config/game.config";
import { rankBounds, rankIndex } from "@/config/ranks";
import { sql } from "./db";

export type LeaderboardScope = "around" | "rank" | "world";

export interface LeaderboardRow {
  position: number;
  username: string;
  trophies: number;
  isMe: boolean;
}

export interface Leaderboard {
  rows: LeaderboardRow[];
  /** Position du joueur dans ce classement, et nombre de joueurs classés. */
  position: number;
  total: number;
}

const LIMIT = 50;

/**
 * Classements des joueurs par trophées (égalité : le plus ancien inscrit d'abord).
 * - around : joueurs à ± LEADERBOARD_AROUND trophées, positions mondiales ;
 * - rank   : joueurs du même rang, positions dans le rang ;
 * - world  : meilleurs joueurs du monde.
 */
export async function getLeaderboards(playerId: string, trophies: number): Promise<Record<LeaderboardScope, Leaderboard>> {
  const db = sql();
  const window = GAME_CONFIG.TROPHIES.LEADERBOARD_AROUND;
  const { min, max } = rankBounds(rankIndex(trophies));
  const rankMax = max ?? 2_147_483_647;

  type Row = { position: number; username: string; trophies: number; id: string };
  const [world, around, rank, counts] = await Promise.all([
    db<Row[]>`
      select id, username::text as username, trophies,
             row_number() over (order by trophies desc, created_at asc)::int as position
      from public.profiles order by position limit ${LIMIT}
    `,
    db<Row[]>`
      with ranked as (
        select id, username::text as username, trophies,
               row_number() over (order by trophies desc, created_at asc)::int as position
        from public.profiles
      )
      select * from ranked
      where trophies between ${Math.max(0, trophies - window)} and ${trophies + window}
      order by position limit ${LIMIT}
    `,
    db<Row[]>`
      select id, username::text as username, trophies,
             row_number() over (order by trophies desc, created_at asc)::int as position
      from public.profiles where trophies between ${min} and ${rankMax}
      order by position limit ${LIMIT}
    `,
    db<{ world_total: number; world_pos: number; rank_total: number; rank_pos: number; around_total: number }[]>`
      with me as (select trophies, created_at from public.profiles where id = ${playerId})
      select
        (select count(*) from public.profiles)::int as world_total,
        (select count(*) + 1 from public.profiles p, me
          where p.trophies > me.trophies or (p.trophies = me.trophies and p.created_at < me.created_at))::int as world_pos,
        (select count(*) from public.profiles where trophies between ${min} and ${rankMax})::int as rank_total,
        (select count(*) + 1 from public.profiles p, me
          where p.trophies between ${min} and ${rankMax}
            and (p.trophies > me.trophies or (p.trophies = me.trophies and p.created_at < me.created_at)))::int as rank_pos,
        (select count(*) from public.profiles where trophies between ${Math.max(0, trophies - window)} and ${trophies + window})::int as around_total
    `,
  ]);
  const c = counts[0];
  const mark = (rows: Row[]) => rows.map((r) => ({ position: r.position, username: r.username, trophies: r.trophies, isMe: r.id === playerId }));
  return {
    around: { rows: mark(around), position: c.world_pos, total: c.around_total },
    rank: { rows: mark(rank), position: c.rank_pos, total: c.rank_total },
    world: { rows: mark(world), position: c.world_pos, total: c.world_total },
  };
}
