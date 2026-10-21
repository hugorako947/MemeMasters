import "server-only";
import { z } from "zod";
import { containsBannedWords } from "@/lib/validation/username";
import { audit } from "./admin";
import { cardArtPublicUrl, removeCardArt, uploadCardArt } from "./card-art";
import { sql } from "./db";
import { ApiError } from "./http";
import type { Player } from "./players";

/**
 * Communauté : les joueurs proposent des cartes de meme, l'équipe (admins et
 * Super Admin) vérifie chaque proposition, puis elle est soumise au vote.
 * Chaque joueur (équipe comprise) a une voix, qu'il peut déplacer ; la carte
 * la plus votée peut sortir pour de bon dans le jeu.
 */
export const COMMUNITY_RULES = {
  /** Propositions en attente ou au vote, par joueur. */
  MAX_ACTIVE: 2,
  NAME_MAX: 40,
  DESCRIPTION_MAX: 140,
} as const;

export const proposalSchema = z.object({
  name: z.string().trim().min(2).max(COMMUNITY_RULES.NAME_MAX),
  description: z.string().trim().max(COMMUNITY_RULES.DESCRIPTION_MAX).default(""),
});

export type CommunityStatus = "pending" | "voting" | "rejected" | "released";

export interface CommunityCard {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  artSeed: number;
  status: CommunityStatus;
  author: string | null;
  authorId: string;
  votes: number;
  createdAt: string;
  rejectReason: string | null;
  cardId: string | null;
}

export interface CommunityView {
  voting: CommunityCard[];
  released: CommunityCard[];
  mine: CommunityCard[];
  /** Propositions à vérifier (équipe seulement). */
  pending: CommunityCard[];
  myVote: string | null;
}

interface Row {
  id: string;
  name: string;
  description: string;
  image_path: string | null;
  art_seed: number;
  status: CommunityStatus;
  author: string | null;
  author_id: string;
  votes: number;
  created_at: Date;
  reject_reason: string | null;
  card_id: string | null;
}

const toCard = (r: Row): CommunityCard => ({
  id: r.id,
  name: r.name,
  description: r.description,
  imageUrl: cardArtPublicUrl(r.image_path),
  artSeed: r.art_seed,
  status: r.status,
  author: r.author,
  authorId: r.author_id,
  votes: r.votes,
  createdAt: r.created_at.toISOString(),
  rejectReason: r.reject_reason,
  cardId: r.card_id,
});

const COLUMNS = (s: ReturnType<typeof sql>) => s`
  c.id, c.name, c.description, c.image_path, c.art_seed, c.status, p.username::text as author, c.author_id,
  (select count(*) from public.community_votes v where v.community_card_id = c.id)::int as votes,
  c.created_at, c.reject_reason, c.card_id
`;

async function byStatus(status: "voting" | "released" | "pending"): Promise<CommunityCard[]> {
  const s = sql();
  const order = status === "voting" ? s`votes desc, c.created_at asc` : status === "released" ? s`c.released_at desc nulls last` : s`c.created_at asc`;
  const list = await s<Row[]>`
    select ${COLUMNS(s)}
    from public.community_cards c left join public.profiles p on p.id = c.author_id
    where c.status = ${status}
    order by ${order}
    limit ${status === "released" ? 6 : 60}
  `;
  return list.map(toCard);
}

async function byAuthor(authorId: string): Promise<CommunityCard[]> {
  const s = sql();
  const list = await s<Row[]>`
    select ${COLUMNS(s)}
    from public.community_cards c left join public.profiles p on p.id = c.author_id
    where c.author_id = ${authorId}
    order by c.created_at desc
    limit 20
  `;
  return list.map(toCard);
}

export async function getCommunity(player: Player): Promise<CommunityView> {
  const staff = player.role !== "player";
  const [voting, released, mine, pending, vote] = await Promise.all([
    byStatus("voting"),
    byStatus("released"),
    byAuthor(player.id),
    staff ? byStatus("pending") : Promise.resolve([]),
    sql()<{ community_card_id: string }[]>`select community_card_id from public.community_votes where player_id = ${player.id}`,
  ]);
  return { voting, released, mine, pending, myVote: vote[0]?.community_card_id ?? null };
}

export async function communityPendingCount(): Promise<number> {
  const [r] = await sql()<{ n: number }[]>`select count(*)::int as n from public.community_cards where status = 'pending'`;
  return r?.n ?? 0;
}

export async function getCommunityCard(id: string): Promise<CommunityCard | null> {
  const s = sql();
  const [r] = await s<Row[]>`
    select ${COLUMNS(s)}
    from public.community_cards c left join public.profiles p on p.id = c.author_id
    where c.id = ${id}
  `;
  return r ? toCard(r) : null;
}

/** Classement du vote, pour le tableau de bord. */
export const votingRanking = () => byStatus("voting");

/** Nouvelle proposition (en attente de vérification par l'équipe). */
export async function propose(player: Player, input: z.infer<typeof proposalSchema>, image: File | null): Promise<string> {
  if (containsBannedWords(`${input.name} ${input.description}`)) throw new ApiError(400, "community_inappropriate");
  const [{ n }] = await sql()<{ n: number }[]>`
    select count(*)::int as n from public.community_cards where author_id = ${player.id} and status in ('pending', 'voting')
  `;
  if (n >= COMMUNITY_RULES.MAX_ACTIVE) throw new ApiError(409, "community_limit");
  const [{ id }] = await sql()<{ id: string }[]>`
    insert into public.community_cards (author_id, name, description) values (${player.id}, ${input.name}, ${input.description}) returning id
  `;
  if (image) {
    try {
      const path = await uploadCardArt("communaute", id, image);
      await sql()`update public.community_cards set image_path = ${path} where id = ${id}`;
    } catch (error) {
      await sql()`delete from public.community_cards where id = ${id}`;
      console.error("[communauté] illustration", error);
      throw new ApiError(400, "community_image");
    }
  }
  return id;
}

/** Vote (ou retire son vote avec null). Une seule voix par joueur, jamais pour sa propre carte. */
export async function vote(player: Player, cardId: string | null): Promise<void> {
  if (!cardId) {
    await sql()`delete from public.community_votes where player_id = ${player.id}`;
    return;
  }
  const [c] = await sql()<{ status: string; author_id: string }[]>`select status, author_id from public.community_cards where id = ${cardId}`;
  if (!c || c.status !== "voting") throw new ApiError(404, "community_not_found");
  if (c.author_id === player.id) throw new ApiError(400, "community_own_vote");
  await sql()`
    insert into public.community_votes (player_id, community_card_id) values (${player.id}, ${cardId})
    on conflict (player_id) do update set community_card_id = excluded.community_card_id, created_at = now()
  `;
}

/** L'auteur retire sa proposition (tant qu'elle n'est pas sortie dans le jeu). */
export async function withdraw(player: Player, cardId: string): Promise<void> {
  const deleted = await sql()<{ image_path: string | null }[]>`
    delete from public.community_cards where id = ${cardId} and author_id = ${player.id} and status <> 'released' returning image_path
  `;
  if (deleted.length === 0) throw new ApiError(404, "community_not_found");
  await removeCardArt(deleted[0].image_path);
}

/** L'équipe vérifie une proposition : soumise au vote, ou refusée avec un motif montré à l'auteur. */
export async function review(staff: Player, cardId: string, decision: "approve" | "reject", reason: string | null): Promise<void> {
  if (staff.role === "player") throw new ApiError(403, "forbidden");
  const updated = await sql()`
    update public.community_cards
    set status = ${decision === "approve" ? "voting" : "rejected"}, reviewed_by = ${staff.id}, reviewed_at = now(),
        reject_reason = ${decision === "reject" ? reason : null}
    where id = ${cardId} and status in ('pending', 'voting')
    returning id
  `;
  if (updated.length === 0) throw new ApiError(404, "community_not_found");
  // Une carte retirée du vote perd ses voix : ses votants peuvent en choisir une autre.
  if (decision === "reject") await sql()`delete from public.community_votes where community_card_id = ${cardId}`;
  await audit(staff.id, decision === "approve" ? "communaute.valider" : "communaute.refuser", cardId, { reason });
}
