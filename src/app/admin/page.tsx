import type { Metadata } from "next";
import Link from "next/link";
import { MemeCard } from "@/components/card/MemeCard";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { GAME_CONFIG } from "@/config/game.config";
import { RANK_REWARDS, RANKS } from "@/config/ranks";
import { RARITIES } from "@/config/rarities";
import { adminCards, listAudit, listContact, listReports, overview, playerDetail, searchPlayers } from "@/lib/server/admin";
import { buildCard, cardPayloadSchema } from "@/lib/server/admin-ops";
import { listRequests, pendingRequestCount, REQUEST_ACTIONS, type AdminRequest } from "@/lib/server/admin-requests";
import { requireAdmin } from "@/lib/server/auth";
import { cardArtPublicUrl } from "@/lib/server/card-art";
import { communityPendingCount, getCommunityCard, votingRanking } from "@/lib/server/community";
import { sql } from "@/lib/server/db";
import { listNews } from "@/lib/server/news";
import { isSuperAdminId, staffRoleLabel, type Player } from "@/lib/server/players";
import type { Card } from "@/lib/validation/card";
import {
  banPlayer,
  cancelMyRequest,
  createNews,
  deleteCard,
  deleteNews,
  deletePlayer,
  reviewRequest,
  setContactStatus,
  setReportStatus,
  setRole,
  unbanPlayer,
  updateChallenge,
  updatePlayerResources,
} from "./actions";
import { AdminFlash } from "./AdminFlash";
import { CardEditor } from "./CardEditor";
import { Box, dateFr, Field, Stat, Table } from "./ui";

export const metadata: Metadata = { title: "Tableau de bord", robots: { index: false } };

const SECTIONS = [
  ["apercu", "Vue d'ensemble"],
  ["validations", "Validations"],
  ["joueurs", "Joueurs"],
  ["signalements", "Signalements"],
  ["contact", "Contact"],
  ["cartes", "Cartes"],
  ["communaute", "Communauté"],
  ["news", "News"],
  ["defis", "Défis"],
  ["config", "Configuration"],
  ["journal", "Journal"],
] as const;

type Params = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

/**
 * Tableau de bord d'administration : réservé aux admins et au Super Admin
 * (404 pour tous les autres). Chaque action est consignée dans le journal.
 * Les actions importantes d'un admin attendent la validation du Super Admin.
 */
export default async function AdminPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { player } = await requireAdmin();
  const params = await searchParams;
  const section = str(params.section) || "apercu";
  const ok = str(params.ok);
  const error = str(params.erreur);
  const isSuper = player.role === "superadmin";
  const [pending, communityPending, myPending] = await Promise.all([
    isSuper ? pendingRequestCount() : Promise.resolve(0),
    communityPendingCount(),
    isSuper ? Promise.resolve(0) : listRequests({ status: "pending", requestedBy: player.id }).then((r) => r.length),
  ]);
  const counts: Record<string, number> = { validations: isSuper ? pending : myPending, communaute: communityPending };

  return (
    <main id="contenu" className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-6 md:px-8">
      <AdminFlash ok={ok} error={error} />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/parametres" className="text-sm font-bold text-ink-soft hover:underline">
            ← Retour au jeu
          </Link>
          <h1 className="font-display text-5xl leading-none">Tableau de bord</h1>
        </div>
        <span className={`rounded-full px-4 py-1.5 text-sm font-extrabold ${isSuper ? "bg-[#1a1238] text-white" : "bg-sticker text-[#1a1238]"}`}>
          {isSuper ? "Super Admin" : "Admin"} · {player.username}
        </span>
      </header>

      {isSuper ? null : (
        <p className="rounded-xl border-2 border-dashed border-ink bg-surface p-3 text-sm">
          <strong>Admin :</strong> vous gérez les joueurs (pas les autres admins ni le Super Admin). Les actions importantes — cartes, ressources, suppression de compte, news, défis —
          sont envoyées au Super Admin, qui les valide avant qu&apos;elles ne s&apos;appliquent. Bannir, traiter un signalement ou un message de contact reste immédiat.
        </p>
      )}

      <nav aria-label="Sections" className="flex flex-wrap gap-1.5">
        {SECTIONS.map(([key, label]) => (
          <Link
            key={key}
            href={`/admin?section=${key}`}
            aria-current={section === key ? "page" : undefined}
            className={`relative rounded-full border-2 border-ink px-3.5 py-1.5 text-sm font-bold ${section === key ? "bg-ink text-paper" : "bg-surface hover:bg-paper"}`}
          >
            {label}
            {counts[key] ? (
              <span className="ms-1.5 inline-grid min-w-5 place-items-center rounded-full bg-candy px-1.5 text-xs text-[var(--mm-accent-ink)]">{counts[key]}</span>
            ) : null}
          </Link>
        ))}
      </nav>

      {ok ? <p role="status" className="rounded-xl border-2 border-success bg-surface p-3 font-semibold">{ok}</p> : null}
      {error ? <p role="alert" className="rounded-xl border-2 border-danger bg-surface p-3 font-semibold">{error}</p> : null}

      {section === "apercu" ? <Overview pending={pending} isSuper={isSuper} communityPending={communityPending} /> : null}
      {section === "validations" ? <Validations viewer={player} /> : null}
      {section === "joueurs" ? <Players q={str(params.q)} id={str(params.id)} viewer={player} /> : null}
      {section === "signalements" ? <Reports status={str(params.statut) === "handled" ? "handled" : "new"} /> : null}
      {section === "contact" ? <Contact status={str(params.statut) === "handled" ? "handled" : "new"} /> : null}
      {section === "cartes" ? <Cards id={str(params.id)} isNew={str(params.nouvelle) === "1"} communityId={str(params.communaute)} isSuper={isSuper} /> : null}
      {section === "communaute" ? <CommunityAdmin username={player.username} /> : null}
      {section === "news" ? <NewsAdmin isSuper={isSuper} /> : null}
      {section === "defis" ? <Challenges isSuper={isSuper} /> : null}
      {section === "config" ? <Config /> : null}
      {section === "journal" ? <Journal /> : null}
    </main>
  );
}

async function Overview({ pending, isSuper, communityPending }: { pending: number; isSuper: boolean; communityPending: number }) {
  const { stats: s, recent } = await overview();
  return (
    <>
      <Box title="En ce moment">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          <Stat label="Comptes" value={s.accounts} />
          <Stat label="En ligne" value={s.online} />
          <Stat label="Inscrits (24 h)" value={s.new_24h} />
          <Stat label="Inscrits (7 j)" value={s.new_7d} />
          <Stat label="Boosters ouverts (24 h)" value={s.boosters_today} />
          <Stat label="Messages (24 h)" value={s.messages_today} />
          <Stat label="Signalements à traiter" value={s.reports_new} tone={s.reports_new > 0 ? "alert" : undefined} />
          <Stat label="Messages de contact" value={s.contact_new} tone={s.contact_new > 0 ? "alert" : undefined} />
          {isSuper ? <Stat label="Demandes d'admins à valider" value={pending} tone={pending > 0 ? "alert" : undefined} /> : null}
          <Stat label="Propositions Communauté à vérifier" value={communityPending} tone={communityPending > 0 ? "alert" : undefined} />
          <Stat label="Joueurs bannis" value={s.banned} />
          <Stat label="Admins" value={s.admins} />
          <Stat label="MemeMoney en circulation" value={s.meme_money} />
        </div>
      </Box>
      <Box title="Derniers inscrits">
        <ul className="grid gap-1">
          {recent.map((r) => (
            <li key={r.id} className="flex justify-between gap-3 rounded-lg bg-paper px-3 py-2 text-sm">
              <Link href={`/admin?section=joueurs&id=${r.id}`} className="font-bold hover:underline">
                {r.username}
              </Link>
              <span className="text-ink-soft">{dateFr(r.created_at)}</span>
            </li>
          ))}
        </ul>
      </Box>
    </>
  );
}

// ------------------------------------------------------------------ validations

const STATUS_LABEL: Record<AdminRequest["status"], string> = {
  pending: "En attente",
  approved: "Validée",
  rejected: "Refusée",
  failed: "Échec",
};
const STATUS_STYLE: Record<AdminRequest["status"], string> = {
  pending: "bg-sticker text-[#1a1238]",
  approved: "bg-[#c9f2d8] text-[#0b5d33]",
  rejected: "bg-[#ffd3dc] text-[#8a0f2c]",
  failed: "bg-[#ffd3dc] text-[#8a0f2c]",
};

/** Aperçu de la carte décrite par une demande (création, modification, sortie de la Communauté). */
async function requestCardPreview(r: AdminRequest): Promise<Card | null> {
  if (r.action !== "carte.creer" && r.action !== "carte.modifier" && r.action !== "communaute.sortir") return null;
  const p = cardPayloadSchema.safeParse(r.payload);
  if (!p.success) return null;
  try {
    const { card } = await buildCard(p.data);
    const image = p.data.art.mode === "image" ? cardArtPublicUrl(p.data.art.imagePath) : null;
    if (p.data.art.mode === "keep" && p.data.id) {
      const [c] = await sql()<{ image_path: string | null }[]>`select image_path from public.cards where id = ${p.data.id}`;
      return { ...card, imageUrl: cardArtPublicUrl(c?.image_path) };
    }
    return { ...card, imageUrl: image };
  } catch {
    return null;
  }
}

async function RequestItem({ r, viewer, current }: { r: AdminRequest; viewer: Player; current: Card | undefined }) {
  const preview = await requestCardPreview(r);
  const isSuper = viewer.role === "superadmin";
  const changes =
    preview && current
      ? (["hp", "atk", "def", "spd"] as const).filter((k) => preview[k] !== current[k]).map((k) => `${k.toUpperCase()} ${current[k]} → ${preview[k]}`)
      : [];
  return (
    <article className="grid gap-3 rounded-xl bg-paper p-3 sm:grid-cols-[1fr_auto]">
      <div className="grid content-start gap-1.5 text-sm">
        <p className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
          <strong>{REQUEST_ACTIONS[r.action] ?? r.action}</strong>
          <span className="text-ink-soft">
            par {r.requester ?? "compte supprimé"} · {dateFr(r.created_at)}
          </span>
        </p>
        <p className="font-semibold">{r.summary}</p>
        {changes.length > 0 ? <p className="text-ink-soft">Changements : {changes.join(", ")}</p> : null}
        {r.target && r.action.startsWith("joueur.") ? (
          <Link href={`/admin?section=joueurs&id=${r.target}`} className="font-bold underline">
            Voir le joueur
          </Link>
        ) : null}
        {r.target && (r.action === "carte.modifier" || r.action === "carte.supprimer") ? (
          <Link href={`/admin?section=cartes&id=${r.target}`} className="font-bold underline">
            Voir la carte actuelle
          </Link>
        ) : null}
        {r.status !== "pending" ? (
          <p className="text-ink-soft">
            {STATUS_LABEL[r.status]} {r.reviewer ? `par ${r.reviewer}` : ""} {r.reviewed_at ? `le ${dateFr(r.reviewed_at)}` : ""}
            {r.review_note ? ` — « ${r.review_note} »` : ""}
          </p>
        ) : null}
        {r.status === "pending" && isSuper ? (
          <form action={reviewRequest} className="mt-1 flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={r.id} />
            <label className="grid min-w-56 flex-1 gap-1 text-xs font-bold">
              Réponse à l&apos;admin (facultatif)
              <input name="note" maxLength={300} className="min-h-10 rounded-xl border-2 border-ink bg-surface px-3 text-sm font-normal" />
            </label>
            <SubmitButton name="decision" value="approve" className="min-h-10 px-4 text-sm" pendingLabel="Application…">
              Valider
            </SubmitButton>
            <SubmitButton name="decision" value="reject" variant="secondary" className="min-h-10 px-4 text-sm">
              Refuser
            </SubmitButton>
          </form>
        ) : null}
        {r.status === "pending" && !isSuper ? (
          <form action={cancelMyRequest}>
            <input type="hidden" name="id" value={r.id} />
            <SubmitButton variant="ghost" className="min-h-9 px-2 text-xs">
              Annuler ma demande
            </SubmitButton>
          </form>
        ) : null}
      </div>
      {preview ? (
        <div className="w-40 justify-self-center">
          <MemeCard card={preview} size="compact" static />
        </div>
      ) : null}
    </article>
  );
}

async function Validations({ viewer }: { viewer: Player }) {
  const isSuper = viewer.role === "superadmin";
  const filter = isSuper ? {} : { requestedBy: viewer.id };
  const [pending, done, cards] = await Promise.all([
    listRequests({ ...filter, status: "pending" }),
    listRequests({ ...filter, status: "done" }),
    adminCards(),
  ]);
  const byId = new Map(cards.map((c) => [c.id, c]));
  return (
    <>
      <Box title={isSuper ? `Demandes à valider (${pending.length})` : `Mes demandes en attente (${pending.length})`}>
        <p className="text-sm text-ink-soft">
          {isSuper
            ? "Les actions importantes des admins n'ont pas encore d'effet dans le jeu. « Valider » les applique aussitôt (avec les vérifications du moment) ; « Refuser » les annule, avec une réponse facultative pour l'admin."
            : "Vos demandes s'appliqueront dès que le Super Admin les aura validées. Vous pouvez annuler une demande tant qu'elle n'a pas été traitée."}
        </p>
        {pending.length === 0 ? <p className="text-sm font-semibold">Aucune demande en attente.</p> : null}
        <div className="grid gap-2">
          {pending.map((r) => (
            <RequestItem key={r.id} r={r} viewer={viewer} current={r.target ? byId.get(r.target) : undefined} />
          ))}
        </div>
      </Box>
      <Box title="Historique">
        {done.length === 0 ? <p className="text-sm text-ink-soft">Rien pour le moment.</p> : null}
        <div className="grid gap-2">
          {done.slice(0, 40).map((r) => (
            <RequestItem key={r.id} r={r} viewer={viewer} current={undefined} />
          ))}
        </div>
      </Box>
    </>
  );
}

// ------------------------------------------------------------------ joueurs

async function Players({ q, id, viewer }: { q: string; id: string; viewer: Player }) {
  const isSuper = viewer.role === "superadmin";
  if (id) {
    const p = await playerDetail(id);
    if (!p) return <Box title="Joueur introuvable">{null}</Box>;
    const targetIsSuper = isSuperAdminId(p.id);
    const targetIsStaff = targetIsSuper || p.role === "admin";
    // Le Super Admin n'est modifiable par personne ; un admin ne gère que les joueurs (pas lui-même).
    const locked = targetIsSuper || (!isSuper && (targetIsStaff || p.id === viewer.id));
    const lockReason = targetIsSuper
      ? "Le compte du Super Admin ne peut être modifié par personne."
      : p.id === viewer.id && !isSuper
        ? "Vous ne pouvez pas modifier votre propre compte : demandez au Super Admin."
        : "Seul le Super Admin peut agir sur un admin.";
    const hideEmail = !isSuper && targetIsStaff;
    return (
      <>
        <Box title={p.username} aside={<Link href="/admin?section=joueurs" className="text-sm font-bold hover:underline">← Tous les joueurs</Link>}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            <Stat label="E-mail" value={<span className="break-all text-base">{hideEmail ? "masqué" : (p.email ?? "—")}</span>} />
            <Stat label="Rôle" value={staffRoleLabel(p.id, p.role)} />
            <Stat label="Statut" value={p.banned_at ? "Banni" : "Actif"} tone={p.banned_at ? "alert" : undefined} />
            <Stat label="Inscrit le" value={<span className="text-base">{dateFr(p.created_at)}</span>} />
            <Stat label="Dernière activité" value={<span className="text-base">{dateFr(p.last_seen_at)}</span>} />
            <Stat label="Victoires / Nuls / Défaites" value={`${p.wins} / ${p.draws} / ${p.losses}`} />
            <Stat label="Cartes différentes" value={p.cards} />
            <Stat label="Exemplaires" value={p.copies} />
            <Stat label="Amis" value={p.friends} />
          </div>
          <p className="text-sm">
            <Link href={`/profil/${encodeURIComponent(p.username)}`} className="font-bold underline">
              Voir son profil dans le jeu
            </Link>
          </p>
        </Box>

        {locked ? (
          <Box title="Accès limité">
            <p className="text-sm">{lockReason}</p>
          </Box>
        ) : (
          <>
            <Box title="Ressources">
              {!isSuper ? <p className="text-sm text-ink-soft">Le changement sera appliqué après validation du Super Admin (sous forme d&apos;écart : ce que le joueur gagne d&apos;ici là est conservé).</p> : null}
              <form action={updatePlayerResources} className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <input type="hidden" name="id" value={p.id} />
                <Field label="MemeMoney" name="memeMoney" type="number" defaultValue={p.meme_money} min={0} />
                <Field label="Trophées" name="trophies" type="number" defaultValue={p.trophies} min={0} />
                <Field label="Boosters en plus" name="bonus" type="number" defaultValue={p.bonus_boosters} min={0} />
                <Field label="Boosters achetés" name="paid" type="number" defaultValue={p.paid_boosters} min={0} />
                <Field label="Super Boosters" name="special" type="number" defaultValue={p.special_boosters} min={0} />
                <Field label="Ultra Boosters" name="verySpecial" type="number" defaultValue={p.very_special_boosters} min={0} />
                <SubmitButton className="px-5 sm:col-span-3 lg:col-span-6 lg:justify-self-start" pendingLabel="Enregistrement…">
                  {isSuper ? "Enregistrer" : "Demander la modification"}
                </SubmitButton>
              </form>
            </Box>

            <Box title="Modération">
              {p.banned_at ? (
                <form action={unbanPlayer} className="flex flex-wrap items-center gap-3">
                  <input type="hidden" name="id" value={p.id} />
                  <span className="text-sm">
                    Banni le {dateFr(p.banned_at)} {p.ban_reason ? `— « ${p.ban_reason} »` : ""}
                  </span>
                  <SubmitButton variant="secondary" className="px-5">
                    Lever le bannissement
                  </SubmitButton>
                </form>
              ) : (
                <form action={banPlayer} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="id" value={p.id} />
                  <div className="min-w-64 flex-1">
                    <Field label="Motif (montré au joueur)" name="reason" maxLength={300} />
                  </div>
                  <SubmitButton variant="danger" className="px-5">
                    Bannir
                  </SubmitButton>
                </form>
              )}
              {p.reports.length > 0 ? (
                <div className="grid gap-1">
                  <p className="text-sm font-bold">Signalements reçus ({p.reports.length})</p>
                  {p.reports.map((r) => (
                    <p key={r.id} className="rounded-lg bg-paper px-3 py-2 text-sm">
                      {dateFr(r.created_at)} · {r.reason} {r.details ? `— ${r.details}` : ""} · par {r.reporter ?? "compte supprimé"} · {r.status === "new" ? "à traiter" : "traité"}
                    </p>
                  ))}
                </div>
              ) : null}
            </Box>

            <Box title="Compte">
              {isSuper ? (
                <form action={setRole} className="flex flex-wrap items-center gap-3">
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="role" value={p.role === "admin" ? "player" : "admin"} />
                  <SubmitButton variant="secondary" className="px-5">
                    {p.role === "admin" ? "Retirer le rôle d'admin" : "Nommer admin"}
                  </SubmitButton>
                  <span className="text-sm text-ink-soft">Un admin gère les joueurs ; ses actions importantes vous sont soumises pour validation.</span>
                </form>
              ) : null}
              <form action={deletePlayer} className={`flex flex-wrap items-end gap-3 ${isSuper ? "border-t-2 border-dashed border-line pt-3" : ""}`}>
                <input type="hidden" name="id" value={p.id} />
                <div className="min-w-64 flex-1">
                  <Field label={`Supprimer définitivement : retapez « ${p.username} »`} name="confirm" required />
                </div>
                <SubmitButton variant="danger" className="px-5" pendingLabel="Envoi…">
                  {isSuper ? "Supprimer le compte" : "Demander la suppression"}
                </SubmitButton>
              </form>
            </Box>
          </>
        )}
      </>
    );
  }

  const rows = await searchPlayers(q);
  return (
    <Box title="Joueurs">
      <form className="flex flex-wrap gap-2">
        <input type="hidden" name="section" value="joueurs" />
        <input name="q" defaultValue={q} placeholder="Pseudo ou e-mail" className="min-h-10 min-w-64 flex-1 rounded-full border-2 border-ink bg-surface px-4" />
        <SubmitButton className="px-5">Rechercher</SubmitButton>
      </form>
      <Table head={["Pseudo", "E-mail", "Trophées", "MemeMoney", "Rôle", "Statut", "Dernière activité"]}>
        {rows.map((r) => {
          const staff = isSuperAdminId(r.id) || r.role === "admin";
          return (
            <tr key={r.id}>
              <td>
                <Link href={`/admin?section=joueurs&id=${r.id}`} className="font-bold underline">
                  {r.username}
                </Link>
              </td>
              <td className="break-all">{!isSuper && staff ? "masqué" : (r.email ?? "—")}</td>
              <td>{r.trophies}</td>
              <td>{r.meme_money}</td>
              <td>{staffRoleLabel(r.id, r.role)}</td>
              <td>{r.banned_at ? "Banni" : "Actif"}</td>
              <td>{dateFr(r.last_seen_at)}</td>
            </tr>
          );
        })}
      </Table>
    </Box>
  );
}

async function Reports({ status }: { status: "new" | "handled" }) {
  const rows = await listReports(status);
  return (
    <Box
      title={status === "new" ? "Signalements à traiter" : "Signalements traités"}
      aside={<Link href={`/admin?section=signalements&statut=${status === "new" ? "handled" : "new"}`} className="text-sm font-bold underline">{status === "new" ? "Voir les traités" : "Voir ceux à traiter"}</Link>}
    >
      {rows.length === 0 ? <p className="text-sm text-ink-soft">Rien ici.</p> : null}
      <Table head={["Date", "Joueur signalé", "Motif", "Précisions", "Par", ""]}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>{dateFr(r.created_at)}</td>
            <td>
              <Link href={`/admin?section=joueurs&id=${r.reported_id}`} className="font-bold underline">
                {r.reported}
              </Link>
            </td>
            <td>{r.reason}</td>
            <td className="max-w-80 whitespace-pre-wrap">{r.details ?? "—"}</td>
            <td>{r.reporter ?? "—"}</td>
            <td>
              <form action={setReportStatus}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="status" value={status === "new" ? "handled" : "new"} />
                <SubmitButton variant="secondary" className="min-h-9 px-3 text-xs">
                  {status === "new" ? "Marquer traité" : "Rouvrir"}
                </SubmitButton>
              </form>
            </td>
          </tr>
        ))}
      </Table>
    </Box>
  );
}

async function Contact({ status }: { status: "new" | "handled" }) {
  const rows = await listContact(status);
  return (
    <Box
      title={status === "new" ? "Messages de contact à traiter" : "Messages traités"}
      aside={<Link href={`/admin?section=contact&statut=${status === "new" ? "handled" : "new"}`} className="text-sm font-bold underline">{status === "new" ? "Voir les traités" : "Voir ceux à traiter"}</Link>}
    >
      {rows.length === 0 ? <p className="text-sm text-ink-soft">Rien ici.</p> : null}
      <div className="grid gap-2">
        {rows.map((c) => (
          <article key={c.id} className="grid gap-1 rounded-xl bg-paper p-3 text-sm">
            <p className="font-bold">
              {c.category}
              {c.subject ? ` — ${c.subject}` : ""} · {dateFr(c.created_at)} · {c.username ?? "visiteur"} ({c.locale ?? "?"})
            </p>
            <p className="whitespace-pre-wrap">{c.message}</p>
            <div className="flex flex-wrap gap-2">
              <a href={`mailto:${c.email}`} className="mm-btn mm-btn--primary min-h-9 px-3 text-xs">
                Répondre à {c.email}
              </a>
              <form action={setContactStatus}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="status" value={status === "new" ? "handled" : "new"} />
                <SubmitButton variant="secondary" className="min-h-9 px-3 text-xs">
                  {status === "new" ? "Marquer traité" : "Rouvrir"}
                </SubmitButton>
              </form>
            </div>
          </article>
        ))}
      </div>
    </Box>
  );
}

// ------------------------------------------------------------------ cartes

async function Cards({ id, isNew, communityId, isSuper }: { id: string; isNew: boolean; communityId: string; isSuper: boolean }) {
  const cards = await adminCards();
  const card = id ? cards.find((c) => c.id === id) : null;
  if (card || isNew) {
    const community = communityId ? await getCommunityCard(communityId) : null;
    const usableCommunity = community && community.status === "voting" ? community : null;
    return (
      <Box
        title={card ? `Modifier : ${card.name}` : usableCommunity ? `Faire sortir : ${usableCommunity.name}` : "Nouvelle carte"}
        aside={<Link href="/admin?section=cartes" className="text-sm font-bold underline">← Toutes les cartes</Link>}
      >
        {communityId && !usableCommunity ? <p className="text-sm font-semibold text-danger">Cette carte de la Communauté n&apos;est plus au vote.</p> : null}
        <CardEditor
          card={card ?? null}
          isSuper={isSuper}
          community={
            usableCommunity
              ? {
                  id: usableCommunity.id,
                  name: usableCommunity.name,
                  description: usableCommunity.description,
                  imageUrl: usableCommunity.imageUrl,
                  artSeed: usableCommunity.artSeed,
                  author: usableCommunity.author,
                  votes: usableCommunity.votes,
                }
              : null
          }
        />
        {card ? (
          <form action={deleteCard} className="grid gap-3 border-t-2 border-dashed border-line pt-4 sm:grid-cols-[1fr_auto]">
            <input type="hidden" name="id" value={card.id} />
            <Field label={`Supprimer définitivement : retapez « ${card.name} »`} name="confirm" required />
            <SubmitButton variant="danger" className="min-h-10 self-end px-5" pendingLabel="Suppression…">
              {isSuper ? "Supprimer la carte" : "Demander la suppression"}
            </SubmitButton>
          </form>
        ) : null}
        <p className="text-xs text-ink-soft">
          {isSuper ? "Les modifications s'appliquent immédiatement à tous les joueurs." : "Rien ne change dans le jeu avant la validation du Super Admin."}
        </p>
      </Box>
    );
  }
  return (
    <Box title={`Cartes (${cards.length})`} aside={<Link href="/admin?section=cartes&nouvelle=1" className="mm-btn mm-btn--primary min-h-9 px-4 text-sm">Nouvelle carte</Link>}>
      <Table head={["Nom", "Rareté", "PV", "ATQ", "DÉF", "VIT", "Active"]}>
        {cards.map((c) => (
          <tr key={c.id}>
            <td>
              <Link href={`/admin?section=cartes&id=${c.id}`} className="font-bold underline">
                {c.name}
              </Link>
            </td>
            <td>{c.rarity}</td>
            <td>{c.hp}</td>
            <td>{c.atk}</td>
            <td>{c.def}</td>
            <td>{c.spd}</td>
            <td>{c.isActive ? "oui" : "non"}</td>
          </tr>
        ))}
      </Table>
    </Box>
  );
}

async function CommunityAdmin({ username }: { username: string }) {
  const [ranking, pending] = await Promise.all([votingRanking(), communityPendingCount()]);
  return (
    <Box title="Communauté" aside={<Link href={`/profil/${encodeURIComponent(username)}?vue=communaute`} className="text-sm font-bold underline">Ouvrir la Communauté dans le jeu</Link>}>
      <p className="text-sm text-ink-soft">
        Les joueurs proposent des cartes, l&apos;équipe les vérifie dans le jeu (Profil → Communauté), puis elles sont soumises au vote. « Faire sortir » ouvre la création de carte
        préremplie : choisissez la rareté et les statistiques. {pending > 0 ? `${pending} proposition(s) attendent une vérification.` : ""}
      </p>
      {ranking.length === 0 ? <p className="text-sm font-semibold">Aucune carte au vote pour le moment.</p> : null}
      <Table head={["#", "Carte", "Proposée par", "Votes", ""]}>
        {ranking.map((c, i) => (
          <tr key={c.id}>
            <td className="font-display text-xl">{i + 1}</td>
            <td>
              <strong>{c.name}</strong>
              {c.description ? <span className="block text-ink-soft">{c.description}</span> : null}
            </td>
            <td>{c.author ?? "—"}</td>
            <td className="font-bold">{c.votes}</td>
            <td>
              <Link href={`/admin?section=cartes&nouvelle=1&communaute=${c.id}`} className={`mm-btn ${i === 0 ? "mm-btn--primary" : "mm-btn--secondary"} min-h-9 px-3 text-xs`}>
                Faire sortir
              </Link>
            </td>
          </tr>
        ))}
      </Table>
    </Box>
  );
}

// ------------------------------------------------------------------ news, défis, configuration, journal

async function NewsAdmin({ isSuper }: { isSuper: boolean }) {
  const news = await listNews(50);
  return (
    <>
      <Box title="Publier une news">
        <form action={createNews} className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-bold">
            Type
            <select name="kind" className="min-h-10 rounded-xl border-2 border-ink bg-surface px-3 font-normal">
              <option value="news">Nouveauté</option>
              <option value="update">Mise à jour</option>
              <option value="change">Changement</option>
              <option value="upcoming">À venir</option>
            </select>
          </label>
          <span />
          <Field label="Titre (français, obligatoire)" name="titleFr" maxLength={120} required />
          <Field label="Titre (anglais, facultatif)" name="titleEn" maxLength={120} />
          <label className="grid gap-1 text-sm font-bold">
            Texte (français, obligatoire)
            <textarea name="bodyFr" rows={4} maxLength={1000} required className="rounded-xl border-2 border-ink bg-surface px-3 py-2 font-normal" />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Texte (anglais, facultatif)
            <textarea name="bodyEn" rows={4} maxLength={1000} className="rounded-xl border-2 border-ink bg-surface px-3 py-2 font-normal" />
          </label>
          <SubmitButton className="px-6 sm:justify-self-start" pendingLabel="Publication…">
            {isSuper ? "Publier (notifie tous les joueurs)" : "Proposer au Super Admin"}
          </SubmitButton>
        </form>
        <p className="text-xs text-ink-soft">Les autres langues affichent le texte français tant qu&apos;aucune traduction n&apos;est fournie.</p>
      </Box>
      <Box title="News publiées">
        <div className="grid gap-2">
          {news.map((n) => (
            <article key={n.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-paper p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-bold">
                  {n.title.fr} <span className="font-normal text-ink-soft">· {n.kind} · {dateFr(new Date(n.publishedAt))}</span>
                </p>
                <p className="text-ink-soft">{n.body.fr}</p>
              </div>
              <form action={deleteNews}>
                <input type="hidden" name="id" value={n.id} />
                <SubmitButton variant="ghost" className="min-h-9 px-3 text-xs">
                  {isSuper ? "Supprimer" : "Demander la suppression"}
                </SubmitButton>
              </form>
            </article>
          ))}
        </div>
      </Box>
    </>
  );
}

async function Challenges({ isSuper }: { isSuper: boolean }) {
  const rows = await sql()<{ id: string; code: string; type: string; target: number; reward_boosters: number; weight: number; is_active: boolean; params: { difficulty?: string } }[]>`
    select id, code, type::text as type, target, reward_boosters, weight, is_active, params from public.challenge_templates order by is_active desc, type, target
  `;
  return (
    <Box title="Défis du jour">
      <p className="text-sm text-ink-soft">
        Chaque joueur reçoit un défi par jour, tiré au hasard parmi les défis actifs (le « poids » augmente sa probabilité). Récompense : des boosters en plus.
        {isSuper ? "" : " Vos modifications sont soumises au Super Admin."}
      </p>
      <div className="grid gap-2">
        {rows.map((c) => (
          <form key={c.id} action={updateChallenge} className="grid items-end gap-2 rounded-xl bg-paper p-3 sm:grid-cols-[1fr_repeat(3,7rem)_auto_auto]">
            <input type="hidden" name="id" value={c.id} />
            <p className="text-sm font-bold">
              {c.code} <span className="font-normal text-ink-soft">· {c.type} · {c.params?.difficulty ?? "—"}</span>
            </p>
            <Field label="Objectif" name="target" type="number" defaultValue={c.target} min={1} />
            <Field label="Boosters" name="reward" type="number" defaultValue={c.reward_boosters} min={0} />
            <Field label="Poids" name="weight" type="number" defaultValue={c.weight} min={1} />
            <label className="flex min-h-10 items-center gap-2 text-sm font-bold">
              <input type="checkbox" name="active" defaultChecked={c.is_active} className="size-4" /> Actif
            </label>
            <SubmitButton variant="secondary" className="min-h-10 px-4 text-sm">
              {isSuper ? "Enregistrer" : "Proposer"}
            </SubmitButton>
          </form>
        ))}
      </div>
    </Box>
  );
}

function Config() {
  const { DUPLICATES, MEME_MONEY, TROPHIES, DAILY_FREE_BOOSTERS, PITY_THRESHOLD } = GAME_CONFIG;
  return (
    <>
      <Box title="Configuration du jeu">
        <p className="text-sm text-ink-soft">
          Ces réglages sont dans le code (<code>src/config/game.config.ts</code>, <code>ranks.ts</code>, <code>shop.ts</code>) : ils sont vérifiés automatiquement à chaque démarrage et
          par les tests. Pour les changer, modifiez le fichier puis redéployez. Leur édition directe depuis ce tableau de bord pourra être ajoutée plus tard.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Boosters gratuits par jour" value={DAILY_FREE_BOOSTERS} />
          <Stat label="Pity (légendaire garantie)" value={`${PITY_THRESHOLD} boosters`} />
          <Stat label="Booster en plus" value={`${MEME_MONEY.EXTRA_DAILY_BOOSTER_PRICE} MM`} />
          <Stat label="Super / Ultra Booster" value={`${MEME_MONEY.SPECIAL_BOOSTER_PRICE} / ${MEME_MONEY.VERY_SPECIAL_BOOSTER_PRICE} MM`} />
          <Stat label="Trophées victoire / défaite" value={`+${TROPHIES.WIN} / −${TROPHIES.LOSS}`} />
          <Stat label="Plafond de revente" value={`${DUPLICATES.DAILY_SELL_CAP} MM / jour`} />
        </div>
      </Box>
      <Box title="Évolutions (exemplaires ★ / ★★ / ★★★) et revente">
        <Table head={["Rareté", "★", "★★", "★★★", "Revente (MM)"]}>
          {RARITIES.map((r) => (
            <tr key={r}>
              <td>{r}</td>
              <td>{DUPLICATES.UPGRADES[r][0]}</td>
              <td>{DUPLICATES.UPGRADES[r][1]}</td>
              <td>{DUPLICATES.UPGRADES[r][2]}</td>
              <td>{DUPLICATES.SELL_CENTS[r] / 100}</td>
            </tr>
          ))}
        </Table>
      </Box>
      <Box title="Rangs et récompenses">
        <Table head={["Rang", "Boosters", "MemeMoney"]}>
          {RANKS.map((r) => (
            <tr key={r}>
              <td>{r}</td>
              <td>{RANK_REWARDS[r].boosters}</td>
              <td>{RANK_REWARDS[r].memeMoney}</td>
            </tr>
          ))}
        </Table>
      </Box>
    </>
  );
}

async function Journal() {
  const rows = await listAudit();
  return (
    <Box title="Journal des actions d'administration">
      <Table head={["Date", "Admin", "Action", "Cible", "Détails"]}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>{dateFr(r.created_at)}</td>
            <td>{r.admin ?? "—"}</td>
            <td className="font-bold">{r.action}</td>
            <td className="break-all">{r.target ?? "—"}</td>
            <td className="max-w-96 break-all font-mono text-xs">{r.diff ? JSON.stringify(r.diff) : ""}</td>
          </tr>
        ))}
      </Table>
    </Box>
  );
}
