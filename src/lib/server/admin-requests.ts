import "server-only";
import { z } from "zod";
import { audit } from "./admin";
import {
  AdminError,
  applyCardDelete,
  applyCardSave,
  applyChallenge,
  applyDeletePlayer,
  applyNews,
  applyNewsDelete,
  applyResources,
  cardPayloadSchema,
  challengeSchema,
  newsSchema,
  resourcesSchema,
} from "./admin-ops";
import { removeCardArt } from "./card-art";
import { sql, withMissingTable } from "./db";
import type { Player } from "./players";

/**
 * Demandes des admins : les actions importantes (cartes, ressources d'un joueur,
 * suppression de compte, news, défis) ne s'appliquent qu'une fois validées par
 * le Super Admin. Le contenu exact de l'action est gardé dans `payload`.
 */
export const REQUEST_ACTIONS = {
  "carte.creer": "Créer une carte",
  "carte.modifier": "Modifier une carte",
  "carte.supprimer": "Supprimer une carte",
  "communaute.sortir": "Faire sortir une carte de la Communauté",
  "joueur.ressources": "Modifier les ressources d'un joueur",
  "joueur.supprimer": "Supprimer un compte joueur",
  "news.publier": "Publier une news",
  "news.supprimer": "Supprimer une news",
  "defi.modifier": "Modifier un défi du jour",
} as const;
export type RequestAction = keyof typeof REQUEST_ACTIONS;

const payloads = {
  "carte.creer": cardPayloadSchema,
  "carte.modifier": cardPayloadSchema,
  "communaute.sortir": cardPayloadSchema,
  "carte.supprimer": z.object({ id: z.uuid(), name: z.string() }),
  "joueur.ressources": z.object({ id: z.uuid(), username: z.string(), before: resourcesSchema, after: resourcesSchema }),
  "joueur.supprimer": z.object({ id: z.uuid(), username: z.string() }),
  "news.publier": newsSchema,
  "news.supprimer": z.object({ id: z.uuid(), title: z.string() }),
  "defi.modifier": challengeSchema.extend({ code: z.string() }),
} satisfies Record<RequestAction, z.ZodType>;

export interface AdminRequest {
  id: string;
  created_at: Date;
  action: RequestAction;
  target: string | null;
  summary: string;
  payload: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "failed";
  reviewed_at: Date | null;
  review_note: string | null;
  requester: string | null;
  reviewer: string | null;
}

export async function createRequest(admin: Player, action: RequestAction, target: string | null, summary: string, payload: unknown): Promise<void> {
  const parsed = payloads[action].parse(payload);
  await sql()`
    insert into public.admin_requests (requested_by, action, target, summary, payload)
    values (${admin.id}, ${action}, ${target}, ${summary.slice(0, 300)}, ${JSON.stringify(parsed)}::text::jsonb)
  `;
  await audit(admin.id, `demande.${action}`, target, { summary });
}

export async function listRequests(filter: { status?: "pending" | "done"; requestedBy?: string }): Promise<AdminRequest[]> {
  return withMissingTable("Validations", [], () => loadRequests(filter));
}

async function loadRequests(filter: { status?: "pending" | "done"; requestedBy?: string }): Promise<AdminRequest[]> {
  const pending = filter.status === "pending";
  const done = filter.status === "done";
  return sql()<AdminRequest[]>`
    select r.id, r.created_at, r.action, r.target, r.summary, r.payload, r.status, r.reviewed_at, r.review_note,
           a.username::text as requester, b.username::text as reviewer
    from public.admin_requests r
    left join public.profiles a on a.id = r.requested_by
    left join public.profiles b on b.id = r.reviewed_by
    where (${!pending} or r.status = 'pending')
      and (${!done} or r.status <> 'pending')
      and (${filter.requestedBy ?? null}::uuid is null or r.requested_by = ${filter.requestedBy ?? null}::uuid)
    order by r.created_at desc
    limit 100
  `;
}

export async function pendingRequestCount(): Promise<number> {
  return withMissingTable("Validations", 0, async () => {
    const [r] = await sql()<{ n: number }[]>`select count(*)::int as n from public.admin_requests where status = 'pending'`;
    return r?.n ?? 0;
  });
}

/** Une demande en attente concerne-t-elle déjà cette cible ? (évite les doublons) */
export async function hasPendingRequest(action: RequestAction, target: string): Promise<boolean> {
  const rows = await sql()`select 1 from public.admin_requests where status = 'pending' and action = ${action} and target = ${target} limit 1`;
  return rows.length > 0;
}

/** Image téléversée avec une demande de carte (à supprimer si la demande est refusée). */
function requestImage(payload: Record<string, unknown>): string | null {
  const art = payload.art as { mode?: string; imagePath?: string | null } | undefined;
  return art?.mode === "image" && art.imagePath?.startsWith("demandes/") ? art.imagePath : null;
}

/**
 * Le Super Admin valide une demande : l'action est appliquée telle qu'elle a
 * été préparée (avec les vérifications du moment). Si elle n'est plus possible
 * (carte supprimée entre-temps…), la demande passe en « échec » avec la raison.
 */
export async function approveRequest(id: string, superAdmin: Player, note: string | null): Promise<{ ok: boolean; message: string }> {
  const [req] = await sql()<{ action: RequestAction; payload: Record<string, unknown>; status: string; requested_by: string | null }[]>`
    select action, payload, status, requested_by from public.admin_requests where id = ${id}
  `;
  if (!req) return { ok: false, message: "Demande introuvable." };
  if (req.status !== "pending") return { ok: false, message: "Cette demande a déjà été traitée." };
  // Verrou optimiste : une seule validation à la fois pour une même demande.
  const claimed = await sql()`update public.admin_requests set status = 'approved', reviewed_by = ${superAdmin.id}, reviewed_at = now(), review_note = ${note} where id = ${id} and status = 'pending' returning id`;
  if (claimed.length === 0) return { ok: false, message: "Cette demande a déjà été traitée." };
  try {
    const message = await execute(req.action, req.payload, superAdmin);
    await audit(superAdmin.id, `validation.${req.action}`, id, { requestedBy: req.requested_by });
    return { ok: true, message };
  } catch (error) {
    const reason = error instanceof AdminError || error instanceof z.ZodError ? (error instanceof AdminError ? error.message : "Contenu de la demande invalide.") : null;
    if (!reason) console.error("[admin] validation", error);
    const text = reason ?? "Erreur inattendue pendant l'application.";
    await sql()`update public.admin_requests set status = 'failed', review_note = ${text.slice(0, 300)} where id = ${id}`;
    return { ok: false, message: `Demande non appliquée : ${text}` };
  }
}

export async function rejectRequest(id: string, superAdmin: Player, note: string | null): Promise<boolean> {
  const rows = await sql()<{ payload: Record<string, unknown>; action: RequestAction }[]>`
    update public.admin_requests set status = 'rejected', reviewed_by = ${superAdmin.id}, reviewed_at = now(), review_note = ${note}
    where id = ${id} and status = 'pending'
    returning payload, action
  `;
  if (rows.length === 0) return false;
  await removeCardArt(requestImage(rows[0].payload));
  await audit(superAdmin.id, `refus.${rows[0].action}`, id, { note });
  return true;
}

/** L'admin annule sa propre demande tant qu'elle n'a pas été traitée. */
export async function cancelRequest(id: string, admin: Player): Promise<boolean> {
  const rows = await sql()<{ payload: Record<string, unknown> }[]>`
    delete from public.admin_requests where id = ${id} and requested_by = ${admin.id} and status = 'pending' returning payload
  `;
  if (rows.length === 0) return false;
  await removeCardArt(requestImage(rows[0].payload));
  return true;
}

async function execute(action: RequestAction, raw: unknown, superAdmin: Player): Promise<string> {
  switch (action) {
    case "carte.creer":
    case "carte.modifier":
    case "communaute.sortir": {
      const p = payloads[action].parse(raw);
      const { budgetNote } = await applyCardSave(p, superAdmin.id);
      return (action === "carte.modifier" ? "Carte modifiée." : "Carte créée.") + budgetNote;
    }
    case "carte.supprimer": {
      const p = payloads[action].parse(raw);
      return `Carte « ${await applyCardDelete(p.id, superAdmin.id)} » supprimée.`;
    }
    case "joueur.ressources": {
      const p = payloads[action].parse(raw);
      await applyResources(p.id, p.before, p.after, superAdmin);
      return `Ressources de ${p.username} mises à jour.`;
    }
    case "joueur.supprimer": {
      const p = payloads[action].parse(raw);
      const [t] = await sql()<{ role: string }[]>`select role from public.player_private where player_id = ${p.id}`;
      if (t && t.role !== "player") throw new AdminError("Ce compte est devenu admin entre-temps : supprimez-le directement si besoin.");
      return `Compte « ${await applyDeletePlayer(p.id, superAdmin.id)} » supprimé.`;
    }
    case "news.publier":
      await applyNews(payloads[action].parse(raw), superAdmin.id);
      return "News publiée : les joueurs reçoivent une notification.";
    case "news.supprimer":
      await applyNewsDelete(payloads[action].parse(raw).id, superAdmin.id);
      return "News supprimée.";
    case "defi.modifier": {
      const { id, target, reward, weight, active } = payloads[action].parse(raw);
      await applyChallenge({ id, target, reward, weight, active }, superAdmin.id);
      return "Défi enregistré.";
    }
  }
}
