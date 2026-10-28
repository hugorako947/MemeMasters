import "server-only";
import { z } from "zod";
import { RARITIES } from "@/config/rarities";
import { rankIndex } from "@/config/ranks";
import { checkBudget } from "@/lib/cards/balance";
import { cardSchema, type Card } from "@/lib/validation/card";
import { audit } from "./admin";
import { removeCardArt } from "./card-art";
import { sql } from "./db";
import { deleteAccount, isSuperAdminId } from "./players";

/**
 * Opérations d'administration, telles qu'elles s'appliquent au jeu.
 * Le Super Admin les déclenche directement ; celles d'un admin passent d'abord
 * par une demande (admin_requests) que le Super Admin valide.
 */

/** Erreur métier : son message est montré tel quel dans le tableau de bord. */
export class AdminError extends Error {}

const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

export const DEFENSE_KINDS = ["heal", "reflect", "dodge", "cleanse", "recharge"] as const;

// ------------------------------------------------------------------ cartes

export const cardPayloadSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(40),
  description: z.string().trim().max(280).default(""),
  rarity: z.enum(RARITIES),
  hp: int(60, 140),
  atk: int(20, 65),
  def: int(20, 65),
  spd: int(10, 100),
  attackName: z.string().trim().min(1).max(32),
  attackPower: int(25, 35),
  specialName: z.string().trim().min(1).max(32),
  specialPower: int(50, 90),
  specialCost: int(2, 4),
  defenseName: z.string().trim().min(1).max(32),
  defenseKind: z.enum(DEFENSE_KINDS),
  defenseValue: int(0, 60),
  active: z.boolean(),
  droppable: z.boolean(),
  announce: z.boolean(),
  /** auto : illustration générée ; image : image téléversée (imagePath) ; keep : inchangée. */
  art: z.object({
    mode: z.enum(["auto", "image", "keep"]),
    reshuffle: z.boolean().default(false),
    imagePath: z.string().max(200).nullable().default(null),
  }),
  /** Carte de la Communauté qui sort dans le jeu grâce aux votes. */
  communityId: z.uuid().optional(),
});
export type CardPayload = z.infer<typeof cardPayloadSchema>;

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function defenseEffect(p: CardPayload): Card["defenseAbility"]["effect"] {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  switch (p.defenseKind) {
    case "heal":
      return { kind: "heal", percent: clamp(p.defenseValue, 5, 20) };
    case "reflect":
      return { kind: "reflect", percent: clamp(p.defenseValue, 10, 50) };
    case "dodge":
      return { kind: "dodge", chance: clamp(p.defenseValue, 5, 40) };
    case "recharge":
      return { kind: "recharge", amount: 1 };
    default:
      return { kind: "cleanse" };
  }
}

interface ExistingCard {
  special_attack: { effect?: unknown } | null;
  slug: string;
  art_seed: number;
  image_path: string | null;
}

/**
 * Construit et vérifie la carte (schéma et budget de statistiques) sans rien
 * écrire. Sert aussi à l'aperçu d'une demande dans le tableau de bord.
 */
export async function buildCard(p: CardPayload): Promise<{ card: Card; existing: ExistingCard | null; budgetNote: string }> {
  const existing = p.id
    ? ((await sql()<ExistingCard[]>`select special_attack, slug, art_seed, image_path from public.cards where id = ${p.id}`)[0] ?? null)
    : null;
  if (p.id && !existing) throw new AdminError("Cette carte n'existe plus.");
  const specialEffect =
    existing?.special_attack && typeof existing.special_attack === "object" && existing.special_attack.effect ? existing.special_attack.effect : { kind: "none" };
  const card = {
    id: p.id ?? "00000000-0000-4000-8000-000000000000",
    slug: existing?.slug ?? (slugify(p.name) || "carte"),
    name: p.name,
    description: p.description,
    rarity: p.rarity,
    hp: p.hp,
    atk: p.atk,
    def: p.def,
    spd: p.spd,
    normalAttack: { name: p.attackName, power: p.attackPower },
    specialAttack: { name: p.specialName, power: p.specialPower, energyCost: p.specialCost, effect: specialEffect as never },
    defenseAbility: { name: p.defenseName, effect: defenseEffect(p) },
    artSeed: existing?.art_seed ?? 1,
    imageUrl: null,
  };
  const valid = cardSchema.safeParse(card);
  if (!valid.success) {
    throw new AdminError("Carte invalide : " + valid.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join(" ; "));
  }
  const budget = checkBudget(card, card.rarity);
  const budgetNote = budget.withinTolerance
    ? ""
    : ` Attention : statistiques hors budget pour cette rareté (indice ${Math.round(budget.index)} pour ${Math.round(budget.budget)} attendu).`;
  return { card, existing, budgetNote };
}

/** Crée ou modifie une carte. Renvoie son identifiant et un éventuel avertissement de budget. */
export async function applyCardSave(p: CardPayload, actorId: string): Promise<{ id: string; budgetNote: string }> {
  const { card, existing, budgetNote } = await buildCard(p);
  const artSeed = p.art.mode === "auto" && (p.art.reshuffle || !existing) ? Math.floor(Math.random() * 2_000_000_000) : card.artSeed;
  const community = p.communityId
    ? (
        await sql()<{ status: string; author: string | null }[]>`
          select c.status, pr.username::text as author
          from public.community_cards c left join public.profiles pr on pr.id = c.author_id
          where c.id = ${p.communityId}
        `
      )[0]
    : null;
  if (p.communityId && (!community || community.status !== "voting")) throw new AdminError("Cette carte de la Communauté n'est plus au vote.");

  let id = p.id;
  try {
    await sql().begin(async (tx) => {
      if (p.id) {
        await tx`
          update public.cards set name = ${card.name}, description = ${card.description}, rarity = ${card.rarity}::public.rarity,
            hp = ${card.hp}, atk = ${card.atk}, def = ${card.def}, spd = ${card.spd},
            normal_attack = ${JSON.stringify(card.normalAttack)}::text::jsonb, special_attack = ${JSON.stringify(card.specialAttack)}::text::jsonb,
            defense_ability = ${JSON.stringify(card.defenseAbility)}::text::jsonb, art_seed = ${artSeed},
            is_active = ${p.active}, is_droppable = ${p.droppable}, updated_at = now()
          where id = ${p.id}
        `;
      } else {
        let slug = card.slug;
        const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from public.cards where slug = ${slug}`;
        if (n > 0) slug = `${slug}-${Date.now().toString(36)}`;
        const [row] = await tx<{ id: string }[]>`
          insert into public.cards (slug, name, description, rarity, hp, atk, def, spd, normal_attack, special_attack, defense_ability, art_seed, is_active, is_droppable)
          values (${slug}, ${card.name}, ${card.description}, ${card.rarity}::public.rarity, ${card.hp}, ${card.atk}, ${card.def}, ${card.spd},
                  ${JSON.stringify(card.normalAttack)}::text::jsonb, ${JSON.stringify(card.specialAttack)}::text::jsonb, ${JSON.stringify(card.defenseAbility)}::text::jsonb,
                  ${artSeed}, ${p.active}, ${p.droppable})
          returning id
        `;
        id = row.id;
      }
      if (p.art.mode === "auto") await tx`update public.cards set image_path = null where id = ${id!}`;
      if (p.art.mode === "image" && p.art.imagePath) await tx`update public.cards set image_path = ${p.art.imagePath} where id = ${id!}`;
      if (p.communityId) {
        await tx`update public.community_cards set status = 'released', card_id = ${id!}, released_at = now() where id = ${p.communityId}`;
        // Les votes de cette carte sont libérés : chacun peut voter pour la suivante.
        await tx`delete from public.community_votes where community_card_id = ${p.communityId}`;
      }
      if (p.announce) {
        const title = p.id ? `Carte rééquilibrée : ${card.name}` : `Nouvelle carte : ${card.name}`;
        const body = p.id
          ? `${card.name} a été modifiée : PV ${card.hp}, ATQ ${card.atk}, DÉF ${card.def}, VIT ${card.spd}.`
          : community
            ? `${card.name}, proposée par ${community.author ?? "un joueur"} et élue par la Communauté, sort dans le jeu en rareté ${card.rarity} !`
            : `${card.name} rejoint le jeu en rareté ${card.rarity}. Elle peut sortir des boosters dès maintenant.`;
        await tx`
          insert into public.news (kind, title, body, created_by)
          values (${p.id ? "change" : "news"}, ${JSON.stringify({ fr: title })}::text::jsonb, ${JSON.stringify({ fr: body })}::text::jsonb, ${actorId})
        `;
      }
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : "";
    if (code === "23505") throw new AdminError("Une carte avec ce nom existe déjà.");
    if (code === "23514") throw new AdminError("Une valeur dépasse les limites autorisées (statistiques ou nom).");
    throw error;
  }
  // Ancienne illustration remplacée : supprimée du stockage (sauf celle d'une carte de la Communauté).
  if (existing?.image_path && p.art.mode !== "keep" && existing.image_path !== p.art.imagePath && !existing.image_path.startsWith("communaute/")) {
    await removeCardArt(existing.image_path);
  }
  await audit(actorId, p.id ? "carte.modifier" : "carte.creer", id!, { name: card.name, rarity: card.rarity, communityId: p.communityId });
  return { id: id!, budgetNote };
}

/** Retire une carte du jeu (collections, decks, illustration). */
export async function applyCardDelete(cardId: string, actorId: string): Promise<string> {
  const [card] = await sql()<{ name: string; image_path: string | null }[]>`select name, image_path from public.cards where id = ${cardId}`;
  if (!card) throw new AdminError("Cette carte n'existe plus.");
  await sql().begin(async (tx) => {
    await tx`delete from public.user_cards where card_id = ${cardId}`;
    await tx`update public.decks set card_ids = array_remove(card_ids, ${cardId}::uuid)`;
    await tx`delete from public.decks where cardinality(card_ids) < 1`;
    await tx`delete from public.cards where id = ${cardId}`;
  });
  await removeCardArt(card.image_path);
  await audit(actorId, "carte.supprimer", cardId, { name: card.name });
  return card.name;
}

// ------------------------------------------------------------------ joueurs

export const resourcesSchema = z.object({
  memeMoney: int(0, 10_000_000),
  bonus: int(0, 100_000),
  paid: int(0, 100_000),
  special: int(0, 100_000),
  verySpecial: int(0, 100_000),
  trophies: int(0, 1_000_000),
});
export type Resources = z.infer<typeof resourcesSchema>;

export async function currentResources(playerId: string): Promise<Resources | null> {
  const [r] = await sql()<Resources[]>`
    select coalesce(w.meme_money, 0)::int as "memeMoney", coalesce(w.bonus_boosters, 0)::int as bonus, coalesce(w.paid_boosters, 0)::int as paid,
           coalesce(w.special_boosters, 0)::int as special, coalesce(w.very_special_boosters, 0)::int as "verySpecial", p.trophies::int as trophies
    from public.profiles p left join public.player_wallets w on w.player_id = p.id
    where p.id = ${playerId}
  `;
  return r ?? null;
}

/**
 * Applique un changement de ressources sous forme d'écart (« +50 MemeMoney »),
 * pas de valeur absolue : ce que le joueur a gagné ou dépensé entre la demande
 * et sa validation est conservé.
 */
export async function applyResources(playerId: string, before: Resources, after: Resources, actor: { id: string; username: string }): Promise<void> {
  const d = (k: keyof Resources) => after[k] - before[k];
  await sql().begin(async (tx) => {
    const [p] = await tx<{ trophies: number }[]>`select trophies from public.profiles where id = ${playerId} for update`;
    if (!p) throw new AdminError("Ce joueur n'existe plus.");
    await tx`
      update public.player_wallets
      set meme_money = greatest(0, meme_money + ${d("memeMoney")}), bonus_boosters = greatest(0, bonus_boosters + ${d("bonus")}),
          paid_boosters = greatest(0, paid_boosters + ${d("paid")}), special_boosters = greatest(0, special_boosters + ${d("special")}),
          very_special_boosters = greatest(0, very_special_boosters + ${d("verySpecial")})
      where player_id = ${playerId}
    `;
    if (d("trophies") !== 0) {
      const trophies = Math.max(0, p.trophies + d("trophies"));
      await tx`update public.profiles set trophies = ${trophies}, highest_rank = greatest(highest_rank, ${rankIndex(trophies)}) where id = ${playerId}`;
      await tx`insert into public.trophy_history (player_id, trophies, rank, reason) values (${playerId}, ${trophies}, ${rankIndex(trophies)}, 'admin')`;
    }
    await tx`insert into public.economy_ledger (player_id, kind, note) values (${playerId}, 'admin_adjust', ${`par ${actor.username}`})`;
  });
  await audit(actor.id, "joueur.ressources", playerId, { before, after });
}

export async function applyDeletePlayer(playerId: string, actorId: string): Promise<string> {
  // Seul le Super Admin peut supprimer le compte du Super Admin (y compris le sien).
  if (isSuperAdminId(playerId) && !isSuperAdminId(actorId)) throw new AdminError("Seul le Super Admin peut supprimer le compte du Super Admin.");
  const [p] = await sql()<{ username: string; role: string }[]>`
    select pr.username::text as username, pp.role from public.profiles pr join public.player_private pp on pp.player_id = pr.id where pr.id = ${playerId}
  `;
  if (!p) throw new AdminError("Ce compte n'existe plus.");
  await deleteAccount(playerId);
  await audit(actorId, "joueur.supprimer", playerId, { username: p.username });
  return p.username;
}

// ------------------------------------------------------------------ news et défis

export const newsSchema = z.object({
  kind: z.enum(["news", "update", "upcoming", "change"]),
  titleFr: z.string().trim().min(3).max(120),
  bodyFr: z.string().trim().min(3).max(1000),
  titleEn: z.string().trim().max(120).optional(),
  bodyEn: z.string().trim().max(1000).optional(),
});
export type NewsPayload = z.infer<typeof newsSchema>;

export async function applyNews(v: NewsPayload, actorId: string): Promise<void> {
  const title = { fr: v.titleFr, ...(v.titleEn ? { en: v.titleEn } : {}) };
  const body = { fr: v.bodyFr, ...(v.bodyEn ? { en: v.bodyEn } : {}) };
  await sql()`insert into public.news (kind, title, body, created_by) values (${v.kind}, ${JSON.stringify(title)}::text::jsonb, ${JSON.stringify(body)}::text::jsonb, ${actorId})`;
  await audit(actorId, "news.publier", v.titleFr);
}

export async function applyNewsDelete(id: string, actorId: string): Promise<void> {
  await sql()`delete from public.news where id = ${id}`;
  await audit(actorId, "news.supprimer", id);
}

export const challengeSchema = z.object({ id: z.uuid(), target: int(1, 1000), reward: int(0, 20), weight: int(1, 100), active: z.boolean() });
export type ChallengePayload = z.infer<typeof challengeSchema>;

export async function applyChallenge(d: ChallengePayload, actorId: string): Promise<void> {
  await sql()`
    update public.challenge_templates set target = ${d.target}, reward_boosters = ${d.reward}, weight = ${d.weight}, is_active = ${d.active}
    where id = ${d.id}
  `;
  await audit(actorId, "defi.modifier", d.id, d);
}
