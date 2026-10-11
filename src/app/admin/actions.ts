"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { RARITIES } from "@/config/rarities";
import { rankIndex } from "@/config/ranks";
import { checkBudget } from "@/lib/cards/balance";
import { audit } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/auth";
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
  const raw = Object.fromEntries(form);
  const d = z
    .object({
      id: z.string().optional(),
      name: z.string().trim().min(1).max(40),
      description: z.string().trim().max(280),
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
      active: z.string().optional(),
      droppable: z.string().optional(),
      announce: z.string().optional(),
    })
    .safeParse(raw);
  const extra = raw.id ? `&id=${raw.id}` : "&nouvelle=1";
  if (!d.success) fail("cartes", "Champs invalides : " + d.error.issues.map((i) => i.path.join(".")).join(", "), extra);
  const v = d.data;
  const defenseEffect =
    v.defenseKind === "heal" || v.defenseKind === "reflect"
      ? { kind: v.defenseKind, percent: Math.max(5, Math.min(40, v.defenseValue)) }
      : v.defenseKind === "dodge"
        ? { kind: "dodge" as const, chance: Math.max(5, Math.min(40, v.defenseValue)) }
        : v.defenseKind === "recharge"
          ? { kind: "recharge" as const, amount: 1 }
          : { kind: "cleanse" as const };
  const existing = v.id
    ? (await sql()<{ special_attack: { effect: unknown }; slug: string; art_seed: number }[]>`select special_attack, slug, art_seed from public.cards where id = ${v.id}`)[0]
    : null;
  const card = {
    id: v.id || "00000000-0000-4000-8000-000000000000",
    slug: existing?.slug ?? slugify(v.name),
    name: v.name,
    description: v.description,
    rarity: v.rarity,
    vibe: "chaos" as const,
    hp: v.hp,
    atk: v.atk,
    def: v.def,
    spd: v.spd,
    normalAttack: { name: v.attackName, power: v.attackPower },
    specialAttack: { name: v.specialName, power: v.specialPower, energyCost: v.specialCost, effect: (existing?.special_attack.effect as never) ?? { kind: "none" } },
    defenseAbility: { name: v.defenseName, effect: defenseEffect },
    artSeed: existing?.art_seed ?? Math.floor(Math.random() * 2_000_000_000),
    imageUrl: null,
  };
  const valid = cardSchema.safeParse(card);
  if (!valid.success) fail("cartes", "Carte invalide : " + valid.error.issues.map((i) => i.path.join(".") + " " + i.message).join(" ; "), extra);
  const budget = checkBudget(card, card.rarity);
  let id = v.id;
  if (v.id) {
    await sql()`
      update public.cards set name = ${card.name}, description = ${card.description}, rarity = ${card.rarity},
        hp = ${card.hp}, atk = ${card.atk}, def = ${card.def}, spd = ${card.spd},
        normal_attack = ${JSON.stringify(card.normalAttack)}::jsonb, special_attack = ${JSON.stringify(card.specialAttack)}::jsonb,
        defense_ability = ${JSON.stringify(card.defenseAbility)}::jsonb,
        is_active = ${v.active === "on"}, is_droppable = ${v.droppable === "on"}, updated_at = now()
      where id = ${v.id}
    `;
  } else {
    let slug = card.slug || "carte";
    const [{ n }] = await sql()<{ n: number }[]>`select count(*)::int as n from public.cards where slug = ${slug}`;
    if (n > 0) slug = `${slug}-${Date.now().toString(36)}`;
    const [row] = await sql()<{ id: string }[]>`
      insert into public.cards (slug, name, description, rarity, vibe, hp, atk, def, spd, normal_attack, special_attack, defense_ability, art_seed, is_active, is_droppable)
      values (${slug}, ${card.name}, ${card.description}, ${card.rarity}, 'chaos', ${card.hp}, ${card.atk}, ${card.def}, ${card.spd},
              ${JSON.stringify(card.normalAttack)}::jsonb, ${JSON.stringify(card.specialAttack)}::jsonb, ${JSON.stringify(card.defenseAbility)}::jsonb,
              ${card.artSeed}, ${v.active === "on"}, ${v.droppable === "on"})
      returning id
    `;
    id = row.id;
  }
  if (v.announce === "on") {
    const title = v.id ? `Carte rééquilibrée : ${card.name}` : `Nouvelle carte : ${card.name}`;
    const body = v.id
      ? `${card.name} a été modifiée : PV ${card.hp}, ATQ ${card.atk}, DÉF ${card.def}, VIT ${card.spd}.`
      : `${card.name} rejoint le jeu en rareté ${card.rarity}. Elle peut sortir des boosters dès maintenant.`;
    await sql()`
      insert into public.news (kind, title, body, created_by)
      values (${v.id ? "change" : "news"}, ${JSON.stringify({ fr: title })}::jsonb, ${JSON.stringify({ fr: body })}::jsonb, ${admin.id})
    `;
  }
  await audit(admin.id, v.id ? "carte.modifier" : "carte.creer", id ?? null, { name: card.name, rarity: card.rarity });
  const note = budget.withinTolerance ? "" : ` Attention : statistiques hors budget pour cette rareté (indice ${Math.round(budget.index)} pour ${Math.round(budget.budget)} attendu).`;
  back("cartes", (v.id ? "Carte enregistrée." : "Carte créée.") + note, `&id=${id}`);
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
