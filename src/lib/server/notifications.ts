import "server-only";
import { isOfferActive, OFFERS } from "@/config/shop";
import { gameDate } from "@/lib/time/game-day";
import { getBoosterState } from "./boosters";
import { sql } from "./db";
import { getDailyChallenge } from "./challenges";
import { communityPendingCount } from "./community";
import { incomingCount } from "./friends";
import { latestNewsAt, unreadNewsCount } from "./news";
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
  community: number; // équipe : propositions de cartes à vérifier (onglet Communauté du profil)
}

/** Valeur « vue » de chaque notification à l'instant présent. */
export async function currentSeenValue(key: SeenKey, player: Player): Promise<string> {
  if (key === "news") return latestNewsAt();
  if (key === "boosters") return gameDate(player.timezone);
  return OFFERS.filter((o) => isOfferActive(o, new Date()))
    .map((o) => o.code)
    .sort()
    .join(",");
}

export async function getBadges(player: Player): Promise<Badges> {
  const [[row], boosters, incoming, unread, community] = await Promise.all([
    sql()<{ seen: Record<string, string> }[]>`select seen from public.player_private where player_id = ${player.id}`,
    getBoosterState(player),
    incomingCount(player.id),
    unreadMessages(player.id),
    player.role === "player" ? Promise.resolve(0) : communityPendingCount(),
  ]);
  const seen = row?.seen ?? {};
  const boostersNew = seen.boosters !== (await currentSeenValue("boosters", player)) ? boosters.freeLeft : 0;
  const [unreadNews, challenge] = await Promise.all([unreadNewsCount(seen.news), getDailyChallenge(player)]);
  // Défi du jour terminé mais pas encore récupéré : une notification sur l'Accueil.
  const challengeReady = challenge && challenge.completed && !challenge.claimed ? 1 : 0;
  const seenOffers = new Set((seen.shop ?? "").split(",").filter(Boolean));
  const newOffers = (await currentSeenValue("shop", player)).split(",").filter((code) => code && !seenOffers.has(code)).length;
  return { home: boostersNew + challengeReady, boosters: boostersNew, infos: unreadNews, news: unreadNews, shop: newOffers, profile: incoming + unread + community, friends: incoming, messages: unread, community };
}

export async function markSeen(player: Player, key: SeenKey): Promise<void> {
  await sql()`
    update public.player_private
    set seen = seen || jsonb_build_object(${key}::text, ${await currentSeenValue(key, player)}::text)
    where player_id = ${player.id}
  `;
}
