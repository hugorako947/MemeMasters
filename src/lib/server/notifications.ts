import "server-only";
import { NEWS } from "@/content/news";
import { isOfferActive, OFFERS } from "@/config/shop";
import { gameDate } from "@/lib/time/game-day";
import { getBoosterState } from "./boosters";
import { sql } from "./db";
import { incomingCount } from "./friends";
import { unreadMessages } from "./messages";
import type { Player } from "./players";

export const SEEN_KEYS = ["news", "boosters", "shop"] as const;
export type SeenKey = (typeof SEEN_KEYS)[number];

/** Nombre de notifications par page (0 = rien de nouveau), calculé par le serveur. */
export interface Badges {
  home: number; //    boosters gratuits revenus (nouveau jour) et pas encore vus : combien à ouvrir
  boosters: number; // même chose, sur l'onglet Boosters
  infos: number; //   news pas encore lues
  news: number;
  shop: number; //    nouvelles offres dans la boutique
  profile: number; // demandes d'ami reçues + messages non lus
  friends: number; //  demandes d'ami reçues (onglet Amis du profil)
  messages: number; // messages non lus (onglet Messages du profil)
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
  const [[row], boosters, incoming, unread] = await Promise.all([
    sql()<{ seen: Record<string, string> }[]>`select seen from public.player_private where player_id = ${player.id}`,
    getBoosterState(player),
    incomingCount(player.id),
    unreadMessages(player.id),
  ]);
  const seen = row?.seen ?? {};
  const boostersNew = seen.boosters !== currentSeenValue("boosters", player) ? boosters.freeLeft : 0;
  const unreadNews = NEWS.filter((n) => n.date > (seen.news ?? "")).length;
  const seenOffers = new Set((seen.shop ?? "").split(",").filter(Boolean));
  const newOffers = currentSeenValue("shop", player).split(",").filter((code) => code && !seenOffers.has(code)).length;
  return { home: boostersNew, boosters: boostersNew, infos: unreadNews, news: unreadNews, shop: newOffers, profile: incoming + unread, friends: incoming, messages: unread };
}

export async function markSeen(player: Player, key: SeenKey): Promise<void> {
  await sql()`
    update public.player_private
    set seen = seen || jsonb_build_object(${key}::text, ${currentSeenValue(key, player)}::text)
    where player_id = ${player.id}
  `;
}
