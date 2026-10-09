import "server-only";
import { NEWS } from "@/content/news";
import { isOfferActive, OFFERS } from "@/config/shop";
import { gameDate } from "@/lib/time/game-day";
import { getBoosterState } from "./boosters";
import { sql } from "./db";
import { incomingCount } from "./friends";
import type { Player } from "./players";

export const SEEN_KEYS = ["news", "boosters", "shop"] as const;
export type SeenKey = (typeof SEEN_KEYS)[number];

/** Points rouges de notification, calculés par le serveur. */
export interface Badges {
  home: boolean; //    boosters gratuits revenus (nouveau jour) et pas encore vus
  boosters: boolean; // même chose, sur l'onglet Boosters
  infos: boolean; //   news pas encore lue
  news: boolean;
  shop: boolean; //    nouvelle offre dans la boutique
  profile: boolean; // demandes d'ami reçues
}

/** Valeur « vue » de chaque notification à l'instant présent. */
export function currentSeenValue(key: SeenKey, player: Player): string {
  if (key === "news") return NEWS[0]?.date ?? "";
  if (key === "boosters") return gameDate(player.timezone);
  return OFFERS.filter((o) => isOfferActive(o, new Date()))
    .map((o) => o.code)
    .sort()
    .join(",");
}

export async function getBadges(player: Player): Promise<Badges> {
  const [[row], boosters, incoming] = await Promise.all([
    sql()<{ seen: Record<string, string> }[]>`select seen from public.player_private where player_id = ${player.id}`,
    getBoosterState(player),
    incomingCount(player.id),
  ]);
  const seen = row?.seen ?? {};
  const boostersNew = boosters.freeLeft > 0 && seen.boosters !== currentSeenValue("boosters", player);
  const newsNew = (seen.news ?? "") < currentSeenValue("news", player);
  const shopValue = currentSeenValue("shop", player);
  return {
    home: boostersNew,
    boosters: boostersNew,
    infos: newsNew,
    news: newsNew,
    shop: shopValue !== "" && seen.shop !== shopValue,
    profile: incoming > 0,
  };
}

export async function markSeen(player: Player, key: SeenKey): Promise<void> {
  await sql()`
    update public.player_private
    set seen = seen || jsonb_build_object(${key}::text, ${currentSeenValue(key, player)}::text)
    where player_id = ${player.id}
  `;
}
