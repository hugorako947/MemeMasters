"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { RARITIES } from "@/config/rarities";
import { rankIndex } from "@/config/ranks";
import { checkBudget } from "@/lib/cards/balance";
import { VIBES } from "@/config/vibes";
import { audit } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/auth";
import { removeCardArt, uploadCardArt } from "@/lib/server/card-art";
import { sql } from "@/lib/server/db";
import { deleteAccount, isSuperAdminId } from "@/lib/server/players";
import { cardSchema } from "@/lib/validation/card";

/** Retour vers une section du tableau de bord avec un message. */
function back(section: string, message: string, extra = ""): never {
  revalidatePath("/", "layout");
  redirect(`/admin?section=${section}${extra}&ok=${encodeURIComponent(message)}`);
}
function fail(section: string, message: string, extra = ""): never {
  redirect(`/admin?section=${section}${extra}&erreur=${encodeURIComponent(message)}`);
}
const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

function isControlFlow(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("digest" in error)) return false;
  const digest = String((error as { digest: unknown }).digest);
  return digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND");
}

function saveCardFailMessage(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : "";
  const message = error instanceof Error ? error.message : "";
  if (code === "23505") return "Une carte avec ce nom existe déjà.";
  if (code === "42804" || /rarity|vibe/i.test(message)) return "Rareté ou vibe refusée par la base. Réessayez.";
  if (code === "23514") return "Une valeur dépasse les limites autorisées (statistiques ou nom).";
  if (message) return message.slice(0, 180);
  return "Impossible d'enregistrer la carte. Réessayez.";
}

/** Garde-fous : personne ne touche au Super Admin ; seul le Super Admin agit sur un admin. */
async function assertCanManage(actor: { id: string; role: string }, targetId: string, section: string) {
  if (isSuperAdminId(targetId)) fail(section, "Le compte du Super Admin ne peut pas être modifié ici.", `&id=${targetId}`);
  const [t] = await sql()<{ role: string }[]>`select role from public.player_private where player_id = ${targetId}`;
  if (!t) fail(section, "Joueur introuvable.");
  if (t.role === "admin" && actor.role !== "superadmin") fail(section, "Seul le Super Admin peut agir sur un admin.", `&id=${targetId}`);
}

// ------------------------------------------------------------------ joueurs

export async function updatePlayerResources(form: FormData) {
  const { player: admin } = await requireAdmin();
  const d = z
    .object({
      id: z.uuid(),
      memeMoney: int(0, 10_000_000),
      bonus: int(0, 100_000),
      paid: int(0, 100_000),
      special: int(0, 100_000),
      verySpecial: int(0, 100_000),
      trophies: int(0, 1_000_000),
    })
    .parse(Object.fromEntries(form));
  await assertCanManage(admin, d.id, "joueurs");
  await sql().begin(async (tx) => {
    const [before] = await tx<{ trophies: number }[]>`select trophies from public.profiles where id = ${d.id} for update`;
    await tx`
      update public.player_wallets
      set meme_money = ${d.memeMoney}, bonus_boosters = ${d.bonus}, paid_boosters = ${d.paid},
          special_boosters = ${d.special}, very_special_boosters = ${d.verySpecial}
      where player_id = ${d.id}
    `;
    if (before && before.trophies !== d.trophies) {
      await tx`
        update public.profiles set trophies = ${d.trophies}, highest_rank = greatest(highest_rank, ${rankIndex(d.trophies)})
        where id = ${d.id}
      `;
      await tx`
        insert into public.trophy_history (player_id, trophies, rank, reason)
        values (${d.id}, ${d.trophies}, ${rankIndex(d.trophies)}, 'admin')
      `;
    }
    await tx`
      insert into public.economy_ledger (player_id, kind, note) values (${d.id}, 'admin_adjust', ${`par ${admin.username}`})
    `;
  });
  await audit(admin.id, "joueur.ressources", d.id, d);
  back("joueurs", "Ressources mises à jour.", `&id=${d.id}`);
}

export async function banPlayer(form: FormData) {
  const { player: admin } = await requireAdmin();
  const d = z.object({ id: z.uuid(), reason: z.string().trim().max(300) }).parse(Object.fromEntries(form));
  await assertCanManage(admin, d.id, "joueurs");
  await sql()`update public.player_private set banned_at = now(), ban_reason = ${d.reason || null} where player_id = ${d.id}`;
  await audit(admin.id, "joueur.bannir", d.id, { reason: d.reason });
  back("joueurs", "Joueur banni.", `&id=${d.id}`);
}

export async function unbanPlayer(form: FormData) {
  const { player: admin } = await requireAdmin();
  const { id } = z.object({ id: z.uuid() }).parse(Object.fromEntries(form));
  await assertCanManage(admin, id, "joueurs");
  await sql()`update public.player_private set banned_at = null, ban_reason = null where player_id = ${id}`;
  await audit(admin.id, "joueur.debannir", id);
  back("joueurs", "Bannissement levé.", `&id=${id}`);
}

/** Nommer ou révoquer un admin : réservé au Super Admin. */
export async function setRole(form: FormData) {
  const { player: admin } = await requireAdmin("superadmin");
  const d = z.object({ id: z.uuid(), role: z.enum(["player", "admin"]) }).parse(Object.fromEntries(form));
  if (isSuperAdminId(d.id)) fail("joueurs", "Le Super Admin est défini par SUPER_ADMIN_IDS.", `&id=${d.id}`);
  await sql()`update public.player_private set role = ${d.role} where player_id = ${d.id}`;
  await audit(admin.id, d.role === "admin" ? "admin.nommer" : "admin.revoquer", d.id);
  back("joueurs", d.role === "admin" ? "Joueur nommé admin." : "Rôle d'admin retiré.", `&id=${d.id}`);
}

/** Supprimer un compte : réservé au Super Admin, avec le pseudo retapé. */
export async function deletePlayer(form: FormData) {
  const { player: admin } = await requireAdmin("superadmin");
  const d = z.object({ id: z.uuid(), confirm: z.string().trim() }).parse(Object.fromEntries(form));
  if (isSuperAdminId(d.id)) fail("joueurs", "Impossible de supprimer le Super Admin.");
  const [p] = await sql()<{ username: string }[]>`select username::text as username from public.profiles where id = ${d.id}`;
  if (!p || p.username.toLowerCase() !== d.confirm.toLowerCase()) fail("joueurs", "Pseudo de confirmation incorrect.", `&id=${d.id}`);
  await deleteAccount(d.id);
  await audit(admin.id, "joueur.supprimer", d.id, { username: p.username });
  back("joueurs", `Compte « ${p.username} » supprimé.`);
}

// ------------------------------------------------------------------ signalements et contact

export async function setReportStatus(form: FormData) {
  const { player: admin } = await requireAdmin();
  const d = z.object({ id: z.uuid(), status: z.enum(["new", "handled"]) }).parse(Object.fromEntries(form));
  await sql()`update public.player_reports set status = ${d.status}::public.report_status where id = ${d.id}`;
  await audit(admin.id, "signalement." + d.status, d.id);
  back("signalements", d.status === "handled" ? "Signalement traité." : "Signalement rouvert.");
}

export async function setContactStatus(form: FormData) {
  const { player: admin } = await requireAdmin();
  const d = z.object({ id: z.uuid(), status: z.enum(["new", "handled"]) }).parse(Object.fromEntries(form));
  await sql()`update public.contact_messages set status = ${d.status}::public.contact_status where id = ${d.id}`;
  await audit(admin.id, "contact." + d.status, d.id);
  back("contact", d.status === "handled" ? "Message traité." : "Message rouvert.");
}

// ------------------------------------------------------------------ cartes

const DEFENSE_KINDS = ["heal", "reflect", "dodge", "cleanse", "recharge"] as const;

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

/** Créer ou modifier une carte (avec annonce facultative dans les news). */
export async function saveCard(form: FormData) {
  const { player: admin } = await requireAdmin();
  const artFile = form.get("art");
  const art = artFile instanceof File && artFile.size > 0 ? artFile : null;
  const raw = Object.fromEntries([...form.entries()].filter(([, value]) => typeof value === "string")) as Record<string, string>;
  if (raw.id === "") delete raw.id;
  const extra = raw.id ? `&id=${raw.id}` : "&nouvelle=1";
  try {
    const d = z
      .object({
        id: z.uuid().optional(),
        name: z.string().trim().min(1).max(40),
        description: z.string().trim().max(280).optional(),
        rarity: z.enum(RARITIES),
        vibe: z.enum(VIBES).optional(),
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
        active: z.string().optional(),
        droppable: z.string().optional(),
        announce: z.string().optional(),
        artSource: z.enum(["auto", "upload"]).optional(),
        reshuffleArt: z.string().optional(),
      })
      .safeParse(raw);
    if (!d.success) fail("cartes", "Champs invalides : " + d.error.issues.map((i) => i.path.join(".") || i.message).join(", "), extra);
    const v = d.data;
    const idOpt = v.id || undefined;
    const defenseEffect =
      v.defenseKind === "heal"
        ? { kind: "heal" as const, percent: Math.max(5, Math.min(20, v.defenseValue)) }
        : v.defenseKind === "reflect"
          ? { kind: "reflect" as const, percent: Math.max(10, Math.min(50, v.defenseValue)) }
          : v.defenseKind === "dodge"
            ? { kind: "dodge" as const, chance: Math.max(5, Math.min(40, v.defenseValue)) }
            : v.defenseKind === "recharge"
              ? { kind: "recharge" as const, amount: 1 as const }
              : { kind: "cleanse" as const };
    const existing = idOpt
      ? (
          await sql()<{
            special_attack: { effect?: unknown } | null;
            slug: string;
            art_seed: number;
            vibe: (typeof VIBES)[number];
            image_path: string | null;
          }[]>`select special_attack, slug, art_seed, vibe, image_path from public.cards where id = ${idOpt}`
        )[0]
      : null;
    if (idOpt && !existing) fail("cartes", "Carte introuvable.", extra);
    const specialEffect = existing?.special_attack && typeof existing.special_attack === "object" && existing.special_attack.effect
      ? existing.special_attack.effect
      : { kind: "none" };
    const artSeed =
      v.reshuffleArt === "on" || !existing ? Math.floor(Math.random() * 2_000_000_000) : existing.art_seed;
    const vibe = v.vibe ?? existing?.vibe ?? "chaos";
    const card = {
      id: idOpt || "00000000-0000-4000-8000-000000000000",
      slug: existing?.slug ?? slugify(v.name),
      name: v.name,
      description: v.description ?? "",
      rarity: v.rarity,
      vibe,
      hp: v.hp,
      atk: v.atk,
      def: v.def,
      spd: v.spd,
      normalAttack: { name: v.attackName, power: v.attackPower },
      specialAttack: { name: v.specialName, power: v.specialPower, energyCost: v.specialCost, effect: specialEffect as never },
      defenseAbility: { name: v.defenseName, effect: defenseEffect },
      artSeed,
      imageUrl: null,
    };
    const valid = cardSchema.safeParse(card);
    if (!valid.success) {
      fail("cartes", "Carte invalide : " + valid.error.issues.map((i) => i.path.join(".") + " " + i.message).join(" ; "), extra);
    }
    const budget = checkBudget(card, card.rarity);
    let id = idOpt;
    if (idOpt) {
      await sql()`
        update public.cards set name = ${card.name}, description = ${card.description},
          rarity = ${card.rarity}::public.rarity, vibe = ${card.vibe}::public.vibe,
          hp = ${card.hp}, atk = ${card.atk}, def = ${card.def}, spd = ${card.spd},
          normal_attack = ${JSON.stringify(card.normalAttack)}::jsonb, special_attack = ${JSON.stringify(card.specialAttack)}::jsonb,
          defense_ability = ${JSON.stringify(card.defenseAbility)}::jsonb, art_seed = ${card.artSeed},
          is_active = ${v.active === "on"}, is_droppable = ${v.droppable === "on"}, updated_at = now()
        where id = ${idOpt}
      `;
    } else {
      let slug = card.slug || "carte";
      const [{ n }] = await sql()<{ n: number }[]>`select count(*)::int as n from public.cards where slug = ${slug}`;
      if (n > 0) slug = `${slug}-${Date.now().toString(36)}`;
      const [row] = await sql()<{ id: string }[]>`
        insert into public.cards (slug, name, description, rarity, vibe, hp, atk, def, spd, normal_attack, special_attack, defense_ability, art_seed, is_active, is_droppable)
        values (${slug}, ${card.name}, ${card.description}, ${card.rarity}::public.rarity, ${card.vibe}::public.vibe, ${card.hp}, ${card.atk}, ${card.def}, ${card.spd},
                ${JSON.stringify(card.normalAttack)}::jsonb, ${JSON.stringify(card.specialAttack)}::jsonb, ${JSON.stringify(card.defenseAbility)}::jsonb,
                ${card.artSeed}, ${v.active === "on"}, ${v.droppable === "on"})
        returning id
      `;
      id = row.id;
    }
    if (!id) fail("cartes", "La carte n'a pas pu être créée.", extra);

    const artSource = v.artSource ?? (art ? "upload" : "auto");
    if (artSource === "auto" && existing?.image_path) {
      await removeCardArt(existing.image_path);
      await sql()`update public.cards set image_path = null where id = ${id}`;
    } else if (artSource === "upload" && art) {
      const path = await uploadCardArt(id, art);
      await sql()`update public.cards set image_path = ${path} where id = ${id}`;
    }

    if (v.announce === "on") {
      const title = idOpt ? `Carte rééquilibrée : ${card.name}` : `Nouvelle carte : ${card.name}`;
      const body = idOpt
        ? `${card.name} a été modifiée : PV ${card.hp}, ATQ ${card.atk}, DÉF ${card.def}, VIT ${card.spd}.`
        : `${card.name} rejoint le jeu en rareté ${card.rarity}. Elle peut sortir des boosters dès maintenant.`;
      await sql()`
        insert into public.news (kind, title, body, created_by)
        values (${idOpt ? "change" : "news"}, ${JSON.stringify({ fr: title })}::jsonb, ${JSON.stringify({ fr: body })}::jsonb, ${admin.id})
      `;
    }
    await audit(admin.id, idOpt ? "carte.modifier" : "carte.creer", id, { name: card.name, rarity: card.rarity });
    const note = budget.withinTolerance
      ? ""
      : ` Attention : statistiques hors budget pour cette rareté (indice ${Math.round(budget.index)} pour ${Math.round(budget.budget)} attendu).`;
    back("cartes", (idOpt ? "Carte enregistrée." : "Carte créée.") + note, `&id=${id}`);
  } catch (error) {
    if (isControlFlow(error)) throw error;
    console.error("[admin] saveCard", error);
    fail("cartes", saveCardFailMessage(error), extra);
  }
}

/** Retirer une carte du jeu (collections, decks, illustration). */
export async function deleteCard(form: FormData) {
  const { player: admin } = await requireAdmin();
  const d = z.object({ id: z.uuid(), confirm: z.string().trim() }).safeParse(Object.fromEntries(form));
  if (!d.success) fail("cartes", "Confirmation invalide.");
  try {
    const [card] = await sql()<{ name: string; image_path: string | null }[]>`
      select name, image_path from public.cards where id = ${d.data.id}
    `;
    if (!card) fail("cartes", "Carte introuvable.");
    if (card.name.toLowerCase() !== d.data.confirm.toLowerCase()) {
      fail("cartes", "Retapez exactement le nom de la carte pour confirmer.", `&id=${d.data.id}`);
    }
    await sql().begin(async (tx) => {
      await tx`delete from public.user_cards where card_id = ${d.data.id}`;
      await tx`update public.decks set card_ids = array_remove(card_ids, ${d.data.id}::uuid)`;
      await tx`delete from public.decks where cardinality(card_ids) < 1`;
      await tx`delete from public.cards where id = ${d.data.id}`;
    });
    await removeCardArt(card.image_path);
    await audit(admin.id, "carte.supprimer", d.data.id, { name: card.name });
    back("cartes", `Carte « ${card.name} » supprimée.`);
  } catch (error) {
    if (isControlFlow(error)) throw error;
    console.error("[admin] deleteCard", error);
    fail("cartes", "Impossible de supprimer cette carte pour le moment.", `&id=${d.data.id}`);
  }
}

// ------------------------------------------------------------------ news et défis

export async function createNews(form: FormData) {
  const { player: admin } = await requireAdmin();
  const d = z
    .object({
      kind: z.enum(["news", "update", "upcoming", "change"]),
      titleFr: z.string().trim().min(3).max(120),
      bodyFr: z.string().trim().min(3).max(1000),
      titleEn: z.string().trim().max(120).optional(),
      bodyEn: z.string().trim().max(1000).optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!d.success) fail("news", "Titre et texte en français obligatoires (3 caractères minimum).");
  const v = d.data;
  const title = { fr: v.titleFr, ...(v.titleEn ? { en: v.titleEn } : {}) };
  const body = { fr: v.bodyFr, ...(v.bodyEn ? { en: v.bodyEn } : {}) };
  await sql()`insert into public.news (kind, title, body, created_by) values (${v.kind}, ${JSON.stringify(title)}::jsonb, ${JSON.stringify(body)}::jsonb, ${admin.id})`;
  await audit(admin.id, "news.publier", v.titleFr);
  back("news", "News publiée : les joueurs reçoivent une notification.");
}

export async function deleteNews(form: FormData) {
  const { player: admin } = await requireAdmin();
  const { id } = z.object({ id: z.uuid() }).parse(Object.fromEntries(form));
  await sql()`delete from public.news where id = ${id}`;
  await audit(admin.id, "news.supprimer", id);
  back("news", "News supprimée.");
}

export async function updateChallenge(form: FormData) {
  const { player: admin } = await requireAdmin();
  const d = z
    .object({ id: z.uuid(), target: int(1, 1000), reward: int(0, 20), weight: int(1, 100), active: z.string().optional() })
    .parse(Object.fromEntries(form));
  await sql()`
    update public.challenge_templates
    set target = ${d.target}, reward_boosters = ${d.reward}, weight = ${d.weight}, is_active = ${d.active === "on"}
    where id = ${d.id}
  `;
  await audit(admin.id, "defi.modifier", d.id, d);
  back("defis", "Défi enregistré (s'applique aux défis tirés à partir de maintenant).");
}
