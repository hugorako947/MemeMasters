import "server-only";
import { sql } from "./db";

/** Un joueur est « en ligne » s'il a été actif ces 2 dernières minutes. */
export const ONLINE_WINDOW_SECONDS = 120;

export async function touchPresence(playerId: string): Promise<void> {
  await sql()`
    update public.profiles set last_seen_at = now()
    where id = ${playerId} and (last_seen_at is null or last_seen_at < now() - interval '30 seconds')
  `;
}

let cache: { at: number; value: { accounts: number; online: number } } | null = null;

/** Comptes existants et joueurs en ligne (mis en cache 30 s : la requête est partagée par tous). */
export async function playerCounts(): Promise<{ accounts: number; online: number }> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  const [r] = await sql()<{ accounts: number; online: number }[]>`
    select count(*)::int as accounts,
           count(*) filter (where last_seen_at > now() - make_interval(secs => ${ONLINE_WINDOW_SECONDS}))::int as online
    from public.profiles
  `;
  cache = { at: Date.now(), value: r };
  return r;
}
