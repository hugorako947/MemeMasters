import "server-only";
import { cache } from "react";
import { GAME_CONFIG } from "@/config/game.config";
import { LEGAL } from "@/config/legal.config";
import { daysBetween } from "@/lib/time/game-day";
import { ApiError } from "./http";
import { isPgError, PG_UNIQUE_VIOLATION, sql } from "./db";

export interface Player {
  id: string;
  username: string;
  level: number;
  xp: number;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  rankedGames: number;
  avatarCardId: string | null;
  timezone: string;
  timezoneChangedAt: Date | null;
  createdAt: Date;
  /** Vrai si le joueur a attesté sa majorité et accepté la version actuelle des conditions. */
  consentUpToDate: boolean;
}

interface PlayerRow {
  id: string;
  username: string;
  level: number;
  xp: number;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  ranked_games: number;
  avatar_card_id: string | null;
  timezone: string;
  timezone_changed_at: Date | null;
  created_at: Date;
  age_confirmed_at: Date | null;
  terms_version: string | null;
}

function toPlayer(r: PlayerRow): Player {
  return {
    id: r.id,
    username: r.username,
    level: r.level,
    xp: r.xp,
    elo: r.elo,
    wins: r.wins,
    losses: r.losses,
    draws: r.draws,
    rankedGames: r.ranked_games,
    avatarCardId: r.avatar_card_id,
    timezone: r.timezone,
    timezoneChangedAt: r.timezone_changed_at,
    createdAt: r.created_at,
    consentUpToDate: r.age_confirmed_at !== null && r.terms_version === LEGAL.TERMS_VERSION,
  };
}

/** Profil complet du joueur (données privées incluses) ou null s'il n'a pas fini l'inscription. */
export const getPlayer = cache(async (userId: string): Promise<Player | null> => {
  const rows = await sql()<PlayerRow[]>`
    select p.id, p.username::text as username, p.level, p.xp, p.elo, p.wins, p.losses, p.draws,
           p.ranked_games, p.avatar_card_id, p.created_at, pp.timezone, pp.timezone_changed_at,
           pp.age_confirmed_at, pp.terms_version
    from public.profiles p
    join public.player_private pp on pp.player_id = p.id
    where p.id = ${userId}
  `;
  return rows[0] ? toPlayer(rows[0]) : null;
});

export interface PublicProfile {
  username: string;
  level: number;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  createdAt: Date;
}

export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
  const rows = await sql()<
    { username: string; level: number; elo: number; wins: number; losses: number; draws: number; created_at: Date }[]
  >`
    select username::text as username, level, elo, wins, losses, draws, created_at
    from public.profiles where username = ${username}::extensions.citext
  `;
  const r = rows[0];
  return r
    ? { username: r.username, level: r.level, elo: r.elo, wins: r.wins, losses: r.losses, draws: r.draws, createdAt: r.created_at }
    : null;
}

export async function isUsernameTaken(username: string): Promise<boolean> {
  const rows = await sql()`select 1 from public.profiles where username = ${username}::extensions.citext limit 1`;
  return rows.length > 0;
}

/**
 * Crée le profil, les données privées (avec les consentements horodatés) et
 * le portefeuille en une transaction.
 * Appelée seulement après validation : majorité attestée et conditions acceptées.
 * Erreurs : 409 username_taken, 409 profile_exists.
 */
export async function createPlayer(userId: string, username: string, timezone: string): Promise<void> {
  try {
    await sql().begin(async (tx) => {
      const existing = await tx`select 1 from public.profiles where id = ${userId} for update`;
      if (existing.length > 0) throw new ApiError(409, "profile_exists");
      await tx`insert into public.profiles (id, username, elo) values (${userId}, ${username}, ${GAME_CONFIG.ELO.START})`;
      await tx`
        insert into public.player_private (player_id, timezone, age_confirmed_at, terms_accepted_at, terms_version)
        values (${userId}, ${timezone}, now(), now(), ${LEGAL.TERMS_VERSION})
      `;
      await tx`insert into public.player_wallets (player_id) values (${userId})`;
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (isPgError(error, PG_UNIQUE_VIOLATION)) {
      const constraint = (error as { constraint_name?: string }).constraint_name ?? "";
      throw new ApiError(409, constraint.includes("username") ? "username_taken" : "profile_exists");
    }
    throw error;
  }
}

/** Enregistre une nouvelle acceptation des conditions (version actuelle). */
export async function recordConsent(userId: string): Promise<void> {
  const rows = await sql()`
    update public.player_private
    set age_confirmed_at = coalesce(age_confirmed_at, now()),
        terms_accepted_at = now(),
        terms_version = ${LEGAL.TERMS_VERSION}
    where player_id = ${userId}
    returning player_id
  `;
  if (rows.length === 0) throw new ApiError(403, "profile_required");
}

/** Date à partir de laquelle le fuseau pourra de nouveau être changé (null = maintenant). */
export function timezoneUnlockDate(player: Pick<Player, "timezoneChangedAt">, now = new Date()): Date | null {
  if (!player.timezoneChangedAt) return null;
  const cooldown = GAME_CONFIG.TIMEZONE_CHANGE_COOLDOWN_DAYS;
  if (daysBetween(player.timezoneChangedAt, now) >= cooldown) return null;
  return new Date(player.timezoneChangedAt.getTime() + cooldown * 86_400_000);
}

/**
 * Change le fuseau, au plus une fois par période de recharge.
 * Erreur : 429 timezone_cooldown.
 */
export async function changeTimezone(userId: string, timezone: string): Promise<void> {
  await sql().begin(async (tx) => {
    const [row] = await tx<{ timezone: string; timezone_changed_at: Date | null }[]>`
      select timezone, timezone_changed_at from public.player_private where player_id = ${userId} for update
    `;
    if (!row) throw new ApiError(403, "profile_required");
    if (row.timezone === timezone) return;
    if (timezoneUnlockDate({ timezoneChangedAt: row.timezone_changed_at })) throw new ApiError(429, "timezone_cooldown");
    await tx`
      update public.player_private set timezone = ${timezone}, timezone_changed_at = now()
      where player_id = ${userId}
    `;
  });
}
