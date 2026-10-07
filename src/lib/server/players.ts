import "server-only";
import { cache } from "react";
import { GAME_CONFIG } from "@/config/game.config";
import { LEGAL } from "@/config/legal.config";
import { daysBetween } from "@/lib/time/game-day";
import { ApiError } from "./http";
import { isPgError, PG_UNIQUE_VIOLATION, sql } from "./db";

export type ThemeName = "light" | "dark" | "inverted" | "custom";

export interface ThemePreference {
  theme: ThemeName;
  accent: string | null;
  base: "light" | "dark" | null;
}

export interface Player {
  id: string;
  username: string;
  trophies: number;
  /** Rang le plus haut jamais atteint (0 = bronze … 9 = immortel). */
  highestRank: number;
  memeMoney: number;
  wins: number;
  losses: number;
  draws: number;
  rankedGames: number;
  avatarCardId: string | null;
  timezone: string;
  timezoneChangedAt: Date | null;
  locale: string | null;
  appearance: ThemePreference;
  createdAt: Date;
  /** Vrai si le joueur a attesté sa majorité et accepté la version actuelle des conditions. */
  consentUpToDate: boolean;
}

interface PlayerRow {
  id: string;
  username: string;
  trophies: number;
  highest_rank: number;
  meme_money: number;
  wins: number;
  losses: number;
  draws: number;
  ranked_games: number;
  avatar_card_id: string | null;
  timezone: string;
  timezone_changed_at: Date | null;
  locale: string | null;
  theme: ThemeName;
  theme_accent: string | null;
  theme_base: "light" | "dark" | null;
  created_at: Date;
  age_confirmed_at: Date | null;
  terms_version: string | null;
}

function toPlayer(r: PlayerRow): Player {
  return {
    id: r.id,
    username: r.username,
    trophies: r.trophies,
    highestRank: r.highest_rank,
    memeMoney: r.meme_money,
    wins: r.wins,
    losses: r.losses,
    draws: r.draws,
    rankedGames: r.ranked_games,
    avatarCardId: r.avatar_card_id,
    timezone: r.timezone,
    timezoneChangedAt: r.timezone_changed_at,
    locale: r.locale,
    appearance: { theme: r.theme, accent: r.theme_accent, base: r.theme_base },
    createdAt: r.created_at,
    consentUpToDate: r.age_confirmed_at !== null && r.terms_version === LEGAL.TERMS_VERSION,
  };
}

/** Profil complet du joueur (données privées incluses) ou null s'il n'a pas fini l'inscription. */
export const getPlayer = cache(async (userId: string): Promise<Player | null> => {
  const rows = await sql()<PlayerRow[]>`
    select p.id, p.username::text as username, p.trophies, p.highest_rank, p.wins, p.losses, p.draws,
           p.ranked_games, p.avatar_card_id, p.created_at, pp.timezone, pp.timezone_changed_at,
           pp.locale, pp.theme, pp.theme_accent, pp.theme_base,
           pp.age_confirmed_at, pp.terms_version, coalesce(w.meme_money, 0) as meme_money
    from public.profiles p
    join public.player_private pp on pp.player_id = p.id
    left join public.player_wallets w on w.player_id = p.id
    where p.id = ${userId}
  `;
  return rows[0] ? toPlayer(rows[0]) : null;
});

export interface TrophyPoint {
  at: string;
  trophies: number;
  rank: number;
}

export interface PublicProfile {
  id: string;
  username: string;
  trophies: number;
  highestRank: number;
  wins: number;
  losses: number;
  draws: number;
  createdAt: Date;
  /** Série de victoires en cours et meilleure série (batailles classées). */
  currentStreak: number;
  bestStreak: number;
  /** Points du graphique de progression, du plus ancien au plus récent. */
  history: TrophyPoint[];
  /** Instant de lecture des données : même référence de temps côté serveur et navigateur. */
  asOf: string;
}

/** Profil public : statistiques de bataille et historique des trophées. */
export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
  const db = sql();
  const rows = await db<
    { id: string; username: string; trophies: number; highest_rank: number; wins: number; losses: number; draws: number; created_at: Date }[]
  >`
    select id, username::text as username, trophies, highest_rank, wins, losses, draws, created_at
    from public.profiles where username = ${username}::extensions.citext
  `;
  const r = rows[0];
  if (!r) return null;

  const [battles, history] = await Promise.all([
    db<{ won: boolean | null }[]>`
      select case
               when winner_side is null then null
               when (winner_side = 'a' and player_a = ${r.id}) or (winner_side = 'b' and player_b = ${r.id}) then true
               else false
             end as won
      from public.battles
      where status = 'finished' and mode = 'ranked' and ${r.id} in (player_a, player_b)
      order by finished_at desc
      limit 1000
    `,
    db<{ at: Date; trophies: number; rank: number }[]>`
      select created_at as at, trophies, rank from (
        select created_at, trophies, rank from public.trophy_history
        where player_id = ${r.id} order by created_at desc limit 2000
      ) h order by at
    `,
  ]);

  const { current, best } = winStreaks(battles.map((b) => b.won));
  return {
    id: r.id,
    username: r.username,
    trophies: r.trophies,
    highestRank: r.highest_rank,
    wins: r.wins,
    losses: r.losses,
    draws: r.draws,
    createdAt: r.created_at,
    currentStreak: current,
    bestStreak: best,
    history: history.map((h) => ({ at: h.at.toISOString(), trophies: h.trophies, rank: h.rank })),
    asOf: new Date().toISOString(),
  };
}

/**
 * Séries de victoires, à partir des résultats du plus récent au plus ancien
 * (true = victoire, false = défaite, null = nul ; un nul interrompt la série).
 */
export function winStreaks(resultsNewestFirst: Array<boolean | null>): { current: number; best: number } {
  let current = 0;
  while (current < resultsNewestFirst.length && resultsNewestFirst[current] === true) current++;
  let best = 0;
  let run = 0;
  for (const won of resultsNewestFirst) {
    run = won === true ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return { current, best };
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
      await tx`insert into public.profiles (id, username) values (${userId}, ${username})`;
      await tx`
        insert into public.player_private (player_id, timezone, age_confirmed_at, terms_accepted_at, terms_version)
        values (${userId}, ${timezone}, now(), now(), ${LEGAL.TERMS_VERSION})
      `;
      await tx`insert into public.player_wallets (player_id) values (${userId})`;
      await tx`insert into public.trophy_history (player_id, trophies, rank, reason) values (${userId}, 0, 0, 'start')`;
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

/** Enregistre la langue choisie par le joueur. */
export async function saveLocale(userId: string, locale: string): Promise<void> {
  await sql()`update public.player_private set locale = ${locale} where player_id = ${userId}`;
}

/** Enregistre le thème choisi par le joueur. */
export async function saveAppearance(userId: string, pref: ThemePreference): Promise<void> {
  await sql()`
    update public.player_private
    set theme = ${pref.theme}, theme_accent = ${pref.accent}, theme_base = ${pref.base}
    where player_id = ${userId}
  `;
}

/**
 * Suppression définitive du compte. Supprimer l'utilisateur d'authentification
 * efface en cascade le profil, la collection, les decks, les défis, le
 * portefeuille et l'historique. Les achats sont conservés sans lien avec le
 * joueur (obligation comptable), les combats restent pour l'adversaire.
 */
export async function deleteAccount(userId: string): Promise<void> {
  await sql()`delete from auth.users where id = ${userId}`;
}
