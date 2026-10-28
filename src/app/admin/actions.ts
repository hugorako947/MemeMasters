"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/server/admin";
import {
  AdminError,
  applyCardDelete,
  applyCardSave,
  applyChallenge,
  applyDeletePlayer,
  applyNews,
  applyNewsDelete,
  applyResources,
  buildCard,
  cardPayloadSchema,
  challengeSchema,
  currentResources,
  newsSchema,
  resourcesSchema,
  type CardPayload,
} from "@/lib/server/admin-ops";
import { approveRequest, cancelRequest, createRequest, hasPendingRequest, rejectRequest } from "@/lib/server/admin-requests";
import { requireAdmin } from "@/lib/server/auth";
import { CardArtError, removeCardArt, uploadCardArt } from "@/lib/server/card-art";
import { sql } from "@/lib/server/db";
import { isSuperAdminId, type Player } from "@/lib/server/players";

/**
 * Actions du tableau de bord. Règles :
 * - le Super Admin agit sur les admins, les joueurs et leurs informations ;
 * - un admin n'agit que sur les joueurs (ni sur un autre admin, ni sur le Super Admin, ni sur lui-même) ;
 * - les actions importantes d'un admin (cartes, ressources, suppression de compte, news, défis)
 *   deviennent des demandes que le Super Admin valide avant qu'elles ne s'appliquent.
 */

/** Retour vers une section du tableau de bord avec un message. */
function back(section: string, message: string, extra = ""): never {
  revalidatePath("/", "layout");
  redirect(`/admin?section=${section}${extra}&ok=${encodeURIComponent(message)}`);
}
function fail(section: string, message: string, extra = ""): never {
  redirect(`/admin?section=${section}${extra}&erreur=${encodeURIComponent(message)}`);
}
const PENDING_MESSAGE = "Demande envoyée au Super Admin : elle s'appliquera dès qu'il l'aura validée (suivi dans « Validations »).";

const isSuper = (p: Player) => p.role === "superadmin";

/** Garde-fous : seul le Super Admin touche au compte du Super Admin (y compris le sien) ; un admin n'agit que sur les joueurs. */
async function assertCanManage(actor: Player, targetId: string, section: string): Promise<{ username: string; role: string }> {
  const extra = `&id=${targetId}`;
  if (isSuperAdminId(targetId) && !isSuper(actor)) fail(section, "Seul le Super Admin peut agir sur le compte du Super Admin.", extra);
  const [t] = await sql()<{ role: string; username: string }[]>`
    select pp.role, pr.username::text as username
    from public.player_private pp join public.profiles pr on pr.id = pp.player_id
    where pp.player_id = ${targetId}
  `;
  if (!t) fail(section, "Joueur introuvable.");
  if (!isSuper(actor)) {
    if (targetId === actor.id) fail(section, "Un admin ne peut pas modifier son propre compte : demandez au Super Admin.", extra);
    if (t.role === "admin") fail(section, "Un admin ne peut pas modifier un autre admin : seul le Super Admin le peut.", extra);
  }
  return t;
}

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof AdminError || error instanceof CardArtError) return error.message;
  console.error("[admin]", error);
  return fallback;
}

// ------------------------------------------------------------------ joueurs

export async function updatePlayerResources(form: FormData) {
  const { player: admin } = await requireAdmin();
  const parsed = resourcesSchema.extend({ id: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!parsed.success) fail("joueurs", "Valeurs invalides : nombres entiers positifs attendus.");
  const { id, ...after } = parsed.data;
  const target = await assertCanManage(admin, id, "joueurs");
  const before = await currentResources(id);
  if (!before) fail("joueurs", "Joueur introuvable.");
  if (JSON.stringify(before) === JSON.stringify(after)) fail("joueurs", "Aucune valeur n'a changé.", `&id=${id}`);
  if (isSuper(admin)) {
    try {
      await applyResources(id, before, after, admin);
    } catch (error) {
      fail("joueurs", messageOf(error, "Impossible d'enregistrer les ressources. Réessayez."), `&id=${id}`);
    }
    back("joueurs", "Ressources mises à jour.", `&id=${id}`);
  }
  const changes = (Object.keys(after) as Array<keyof typeof after>)
    .filter((k) => after[k] !== before[k])
    .map((k) => `${k} ${before[k]} → ${after[k]}`)
    .join(", ");
  await createRequest(admin, "joueur.ressources", id, `Ressources de ${target.username} : ${changes}`, { id, username: target.username, before, after });
  back("joueurs", PENDING_MESSAGE, `&id=${id}`);
}

export async function banPlayer(form: FormData) {
  const { player: admin } = await requireAdmin();
  const d = z.object({ id: z.uuid(), reason: z.string().trim().max(300) }).safeParse(Object.fromEntries(form));
  if (!d.success) fail("joueurs", "Motif trop long (300 caractères au plus).");
  await assertCanManage(admin, d.data.id, "joueurs");
  // Même le Super Admin ne peut pas se bannir lui-même : il se verrouillerait dehors sans retour possible.
  if (d.data.id === admin.id) fail("joueurs", "Tu ne peux pas te bannir toi-même.", `&id=${d.data.id}`);
  await sql()`update public.player_private set banned_at = now(), ban_reason = ${d.data.reason || null} where player_id = ${d.data.id}`;
  await audit(admin.id, "joueur.bannir", d.data.id, { reason: d.data.reason });
  back("joueurs", "Joueur banni : il voit le motif à sa prochaine visite.", `&id=${d.data.id}`);
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

/** Supprimer un compte, avec le pseudo retapé. Un admin ne supprime qu'un joueur, après validation du Super Admin. */
export async function deletePlayer(form: FormData) {
  const { player: admin } = await requireAdmin();
  const d = z.object({ id: z.uuid(), confirm: z.string().trim() }).parse(Object.fromEntries(form));
  const target = await assertCanManage(admin, d.id, "joueurs");
  if (target.username.toLowerCase() !== d.confirm.toLowerCase()) fail("joueurs", "Pseudo de confirmation incorrect.", `&id=${d.id}`);
  if (isSuper(admin)) {
    try {
      const name = await applyDeletePlayer(d.id, admin.id);
      back("joueurs", `Compte « ${name} » supprimé.`);
    } catch (error) {
      if (error instanceof AdminError) fail("joueurs", error.message, `&id=${d.id}`);
      throw error;
    }
  }
  if (await hasPendingRequest("joueur.supprimer", d.id)) fail("joueurs", "Une demande de suppression de ce compte attend déjà le Super Admin.", `&id=${d.id}`);
  await createRequest(admin, "joueur.supprimer", d.id, `Supprimer le compte de ${target.username}`, { id: d.id, username: target.username });
  back("joueurs", PENDING_MESSAGE, `&id=${d.id}`);
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

export interface CardFormState {
  status: "idle" | "error" | "done";
  message: string;
  /** Page à ouvrir après l'enregistrement. */
  next?: string;
}

const on = (v: FormDataEntryValue | null) => v === "on" || v === "true";

/**
 * Créer ou modifier une carte (formulaire avec illustration). Renvoie un état
 * au lieu de rediriger : en cas d'erreur, le formulaire garde tout ce qui a été saisi.
 */
export async function saveCard(_prev: CardFormState, form: FormData): Promise<CardFormState> {
  const { player: admin } = await requireAdmin();
  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : undefined;
  };
  const file = form.get("art");
  const art = file instanceof File && file.size > 0 ? file : null;
  const id = str("id") || undefined;
  const communityId = str("communityId") || undefined;
  let mode = str("artMode") === "image" ? "image" : "auto";

  let communityImage: string | null = null;
  if (communityId) {
    const [c] = await sql()<{ image_path: string | null; status: string }[]>`select image_path, status from public.community_cards where id = ${communityId}`;
    if (!c || c.status !== "voting") return { status: "error", message: "Cette carte de la Communauté n'est plus au vote." };
    communityImage = c.image_path;
  }
  const existingImage = id ? ((await sql()<{ image_path: string | null }[]>`select image_path from public.cards where id = ${id}`)[0]?.image_path ?? null) : null;
  // Mode « image » sans nouveau fichier : on garde l'image actuelle (ou celle de la Communauté).
  const keptImage = mode === "image" && !art ? (communityImage ?? existingImage) : null;
  if (mode === "image" && !art && !keptImage) return { status: "error", message: "Choisissez une image ou prenez une photo, ou revenez à l'illustration générée." };
  if (mode === "image" && !art && keptImage === existingImage && id) mode = "keep";

  const draft = {
    id,
    name: str("name"),
    description: str("description") ?? "",
    rarity: str("rarity"),
    hp: str("hp"),
    atk: str("atk"),
    def: str("def"),
    spd: str("spd"),
    attackName: str("attackName"),
    attackPower: str("attackPower"),
    specialName: str("specialName"),
    specialPower: str("specialPower"),
    specialCost: str("specialCost"),
    defenseName: str("defenseName"),
    defenseKind: str("defenseKind"),
    defenseValue: str("defenseValue"),
    active: on(form.get("active")),
    droppable: on(form.get("droppable")),
    announce: on(form.get("announce")),
    art: { mode, reshuffle: on(form.get("reshuffleArt")), imagePath: keptImage },
    communityId,
  };
  const parsed = cardPayloadSchema.safeParse(draft);
  if (!parsed.success) {
    const LABELS: Record<string, string> = {
      name: "nom",
      rarity: "rareté",
      hp: "PV (60–140)",
      atk: "attaque (20–65)",
      def: "défense (20–65)",
      spd: "vitesse (10–100)",
      attackName: "nom de l'attaque",
      attackPower: "puissance de l'attaque (25–35)",
      specialName: "nom de la spéciale",
      specialPower: "puissance de la spéciale (50–90)",
      specialCost: "énergie (2–4)",
      defenseName: "nom de la défense",
      defenseValue: "valeur de la défense",
    };
    const fields = [...new Set(parsed.error.issues.map((i) => LABELS[String(i.path[0])] ?? String(i.path[0])))];
    return { status: "error", message: `À corriger : ${fields.join(", ")}.` };
  }
  const payload: CardPayload = parsed.data;

  // Vérifie la carte avant de téléverser quoi que ce soit.
  let budgetNote = "";
  try {
    budgetNote = (await buildCard(payload)).budgetNote;
  } catch (error) {
    return { status: "error", message: messageOf(error, "Carte invalide.") };
  }

  const superAdmin = isSuper(admin);
  let uploaded: string | null = null;
  try {
    if (art && mode === "image") {
      uploaded = await uploadCardArt(superAdmin ? "cartes" : "demandes", (id ?? "nouvelle").slice(0, 36), art);
      payload.art.imagePath = uploaded;
    }
    if (superAdmin) {
      const saved = await applyCardSave(payload, admin.id);
      revalidatePath("/", "layout");
      return {
        status: "done",
        message: (id ? "Carte enregistrée : les joueurs voient déjà la nouvelle version." : communityId ? "Carte de la Communauté sortie dans le jeu !" : "Carte créée : elle est dans le jeu.") + budgetNote,
        next: `/admin?section=cartes&id=${saved.id}`,
      };
    }
    const action = communityId ? "communaute.sortir" : id ? "carte.modifier" : "carte.creer";
    if (id && (await hasPendingRequest("carte.modifier", id))) {
      if (uploaded) await removeCardArt(uploaded);
      return { status: "error", message: "Une modification de cette carte attend déjà le Super Admin. Annulez-la dans « Validations » pour en envoyer une autre." };
    }
    const summary = `${communityId ? "Faire sortir" : id ? "Modifier" : "Créer"} « ${payload.name} » (${payload.rarity}, PV ${payload.hp}, ATQ ${payload.atk}, DÉF ${payload.def}, VIT ${payload.spd})`;
    await createRequest(admin, action, id ?? communityId ?? null, summary, payload);
    return { status: "done", message: PENDING_MESSAGE + budgetNote, next: "/admin?section=validations" };
  } catch (error) {
    if (uploaded) await removeCardArt(uploaded);
    return { status: "error", message: messageOf(error, "Impossible d'enregistrer la carte. Réessayez dans un instant.") };
  }
}

/** Retirer une carte du jeu (collections, decks, illustration). */
export async function deleteCard(form: FormData) {
  const { player: admin } = await requireAdmin();
  const d = z.object({ id: z.uuid(), confirm: z.string().trim() }).safeParse(Object.fromEntries(form));
  if (!d.success) fail("cartes", "Confirmation invalide.");
  const [card] = await sql()<{ name: string }[]>`select name from public.cards where id = ${d.data.id}`;
  if (!card) fail("cartes", "Carte introuvable.");
  if (card.name.toLowerCase() !== d.data.confirm.toLowerCase()) fail("cartes", "Retapez exactement le nom de la carte pour confirmer.", `&id=${d.data.id}`);
  if (isSuper(admin)) {
    try {
      const name = await applyCardDelete(d.data.id, admin.id);
      back("cartes", `Carte « ${name} » supprimée.`);
    } catch (error) {
      if (error instanceof AdminError) fail("cartes", error.message, `&id=${d.data.id}`);
      throw error;
    }
  }
  if (await hasPendingRequest("carte.supprimer", d.data.id)) fail("cartes", "La suppression de cette carte attend déjà le Super Admin.", `&id=${d.data.id}`);
  await createRequest(admin, "carte.supprimer", d.data.id, `Supprimer la carte « ${card.name} »`, { id: d.data.id, name: card.name });
  back("cartes", PENDING_MESSAGE, `&id=${d.data.id}`);
}

// ------------------------------------------------------------------ news et défis

export async function createNews(form: FormData) {
  const { player: admin } = await requireAdmin();
  const d = newsSchema.safeParse(Object.fromEntries(form));
  if (!d.success) fail("news", "Titre et texte en français obligatoires (3 caractères minimum).");
  if (isSuper(admin)) {
    await applyNews(d.data, admin.id);
    back("news", "News publiée : les joueurs reçoivent une notification.");
  }
  await createRequest(admin, "news.publier", null, `Publier la news « ${d.data.titleFr} »`, d.data);
  back("news", PENDING_MESSAGE);
}

export async function deleteNews(form: FormData) {
  const { player: admin } = await requireAdmin();
  const { id } = z.object({ id: z.uuid() }).parse(Object.fromEntries(form));
  const [n] = await sql()<{ title: { fr?: string } }[]>`select title from public.news where id = ${id}`;
  if (!n) fail("news", "Cette news n'existe plus.");
  if (isSuper(admin)) {
    await applyNewsDelete(id, admin.id);
    back("news", "News supprimée.");
  }
  if (await hasPendingRequest("news.supprimer", id)) fail("news", "La suppression de cette news attend déjà le Super Admin.");
  await createRequest(admin, "news.supprimer", id, `Supprimer la news « ${n.title.fr ?? ""} »`, { id, title: n.title.fr ?? "" });
  back("news", PENDING_MESSAGE);
}

export async function updateChallenge(form: FormData) {
  const { player: admin } = await requireAdmin();
  const raw = Object.fromEntries(form);
  const d = challengeSchema.safeParse({ ...raw, active: raw.active === "on" });
  if (!d.success) fail("defis", "Valeurs invalides (objectif 1–1000, boosters 0–20, poids 1–100).");
  if (isSuper(admin)) {
    await applyChallenge(d.data, admin.id);
    back("defis", "Défi enregistré (s'applique aux défis tirés à partir de maintenant).");
  }
  const [c] = await sql()<{ code: string }[]>`select code from public.challenge_templates where id = ${d.data.id}`;
  if (!c) fail("defis", "Ce défi n'existe plus.");
  await createRequest(
    admin,
    "defi.modifier",
    d.data.id,
    `Défi ${c.code} : objectif ${d.data.target}, ${d.data.reward} booster(s), poids ${d.data.weight}, ${d.data.active ? "actif" : "inactif"}`,
    { ...d.data, code: c.code },
  );
  back("defis", PENDING_MESSAGE);
}

// ------------------------------------------------------------------ validations

/** Le Super Admin valide ou refuse une demande d'admin. */
export async function reviewRequest(form: FormData) {
  const { player } = await requireAdmin("superadmin");
  const d = z
    .object({ id: z.uuid(), decision: z.enum(["approve", "reject"]), note: z.string().trim().max(300).optional() })
    .safeParse(Object.fromEntries(form));
  if (!d.success) fail("validations", "Demande invalide.");
  const note = d.data.note || null;
  if (d.data.decision === "reject") {
    const ok = await rejectRequest(d.data.id, player, note);
    if (!ok) fail("validations", "Cette demande a déjà été traitée.");
    back("validations", "Demande refusée : l'admin voit votre réponse dans ses demandes.");
  }
  const result = await approveRequest(d.data.id, player, note);
  if (!result.ok) fail("validations", result.message);
  back("validations", `Demande validée. ${result.message}`);
}

/** Un admin annule une de ses demandes encore en attente. */
export async function cancelMyRequest(form: FormData) {
  const { player } = await requireAdmin();
  const { id } = z.object({ id: z.uuid() }).parse(Object.fromEntries(form));
  if (!(await cancelRequest(id, player))) fail("validations", "Cette demande a déjà été traitée.");
  back("validations", "Demande annulée.");
}
