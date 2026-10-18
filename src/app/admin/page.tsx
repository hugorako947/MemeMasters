import type { Metadata } from "next";
import Link from "next/link";
import { GAME_CONFIG } from "@/config/game.config";
import { RANK_REWARDS, RANKS } from "@/config/ranks";
import { RARITIES } from "@/config/rarities";
import { VIBES } from "@/config/vibes";
import { adminCards, listAudit, listContact, listReports, overview, playerDetail, searchPlayers } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { listNews } from "@/lib/server/news";
import { staffRoleLabel } from "@/lib/server/players";
import type { Card } from "@/lib/validation/card";
import {
  banPlayer,
  createNews,
  deleteCard,
  deleteNews,
  deletePlayer,
  saveCard,
  setContactStatus,
  setReportStatus,
  setRole,
  unbanPlayer,
  updateChallenge,
  updatePlayerResources,
} from "./actions";
import { CardArtPicker } from "./CardArtPicker";
import { Box, dateFr, Field, Stat, Table } from "./ui";

export const metadata: Metadata = { title: "Tableau de bord", robots: { index: false } };

const SECTIONS = [
  ["apercu", "Vue d'ensemble"],
  ["joueurs", "Joueurs"],
  ["signalements", "Signalements"],
  ["contact", "Contact"],
  ["cartes", "Cartes"],
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
 */
export default async function AdminPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { player } = await requireAdmin();
  const params = await searchParams;
  const section = str(params.section) || "apercu";
  const ok = str(params.ok);
  const error = str(params.erreur);
  const isSuper = player.role === "superadmin";

  return (
    <main id="contenu" className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-6 md:px-8">
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

      <nav aria-label="Sections" className="flex flex-wrap gap-1.5">
        {SECTIONS.map(([key, label]) => (
          <Link
            key={key}
            href={`/admin?section=${key}`}
            aria-current={section === key ? "page" : undefined}
            className={`rounded-full border-2 border-ink px-3.5 py-1.5 text-sm font-bold ${section === key ? "bg-ink text-paper" : "bg-surface hover:bg-paper"}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {ok ? <p role="status" className="rounded-xl border-2 border-success bg-surface p-3 font-semibold">{ok}</p> : null}
      {error ? <p role="alert" className="rounded-xl border-2 border-danger bg-surface p-3 font-semibold">{error}</p> : null}

      {section === "apercu" ? <Overview /> : null}
      {section === "joueurs" ? <Players q={str(params.q)} id={str(params.id)} isSuper={isSuper} /> : null}
      {section === "signalements" ? <Reports status={str(params.statut) === "handled" ? "handled" : "new"} /> : null}
      {section === "contact" ? <Contact status={str(params.statut) === "handled" ? "handled" : "new"} /> : null}
      {section === "cartes" ? <Cards id={str(params.id)} isNew={str(params.nouvelle) === "1"} /> : null}
      {section === "news" ? <NewsAdmin /> : null}
      {section === "defis" ? <Challenges /> : null}
      {section === "config" ? <Config /> : null}
      {section === "journal" ? <Journal /> : null}
    </main>
  );
}

async function Overview() {
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

async function Players({ q, id, isSuper }: { q: string; id: string; isSuper: boolean }) {
  if (id) {
    const p = await playerDetail(id);
    if (!p) return <Box title="Joueur introuvable">{null}</Box>;
    const locked = p.role === "admin" && !isSuper;
    return (
      <>
        <Box title={p.username} aside={<Link href="/admin?section=joueurs" className="text-sm font-bold hover:underline">← Tous les joueurs</Link>}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            <Stat label="E-mail" value={<span className="break-all text-base">{p.email ?? "—"}</span>} />
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

        <Box title="Ressources">
          {locked ? <p className="text-sm text-ink-soft">Seul le Super Admin peut modifier un admin.</p> : null}
          <form action={updatePlayerResources} className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <input type="hidden" name="id" value={p.id} />
            <Field label="MemeMoney" name="memeMoney" type="number" defaultValue={p.meme_money} min={0} disabled={locked} />
            <Field label="Trophées" name="trophies" type="number" defaultValue={p.trophies} min={0} disabled={locked} />
            <Field label="Boosters en plus" name="bonus" type="number" defaultValue={p.bonus_boosters} min={0} disabled={locked} />
            <Field label="Boosters achetés" name="paid" type="number" defaultValue={p.paid_boosters} min={0} disabled={locked} />
            <Field label="Super Boosters" name="special" type="number" defaultValue={p.special_boosters} min={0} disabled={locked} />
            <Field label="Ultra Boosters" name="verySpecial" type="number" defaultValue={p.very_special_boosters} min={0} disabled={locked} />
            <button type="submit" disabled={locked} className="mm-btn mm-btn--primary px-5 sm:col-span-3 lg:col-span-6 lg:justify-self-start">
              Enregistrer
            </button>
          </form>
        </Box>

        <Box title="Modération">
          {p.banned_at ? (
            <form action={unbanPlayer} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="id" value={p.id} />
              <span className="text-sm">
                Banni le {dateFr(p.banned_at)} {p.ban_reason ? `— « ${p.ban_reason} »` : ""}
              </span>
              <button type="submit" disabled={locked} className="mm-btn mm-btn--secondary px-5">
                Lever le bannissement
              </button>
            </form>
          ) : (
            <form action={banPlayer} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={p.id} />
              <div className="min-w-64 flex-1">
                <Field label="Motif (montré au joueur)" name="reason" maxLength={300} disabled={locked} />
              </div>
              <button type="submit" disabled={locked} className="mm-btn mm-btn--danger px-5">
                Bannir
              </button>
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

        {isSuper && staffRoleLabel(p.id, p.role) !== "Super Admin" ? (
          <Box title="Super Admin">
            <form action={setRole} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="role" value={p.role === "admin" ? "player" : "admin"} />
              <button type="submit" className="mm-btn mm-btn--secondary px-5">
                {p.role === "admin" ? "Retirer le rôle d'admin" : "Nommer admin"}
              </button>
              <span className="text-sm text-ink-soft">Un admin accède à ce tableau de bord, sans pouvoir nommer d&apos;autres admins ni supprimer de comptes.</span>
            </form>
            <form action={deletePlayer} className="flex flex-wrap items-end gap-3 border-t-2 border-dashed border-line pt-3">
              <input type="hidden" name="id" value={p.id} />
              <div className="min-w-64 flex-1">
                <Field label={`Supprimer définitivement : retapez « ${p.username} »`} name="confirm" required />
              </div>
              <button type="submit" className="mm-btn mm-btn--danger px-5">
                Supprimer le compte
              </button>
            </form>
          </Box>
        ) : null}
      </>
    );
  }

  const rows = await searchPlayers(q);
  return (
    <Box title="Joueurs">
      <form className="flex flex-wrap gap-2">
        <input type="hidden" name="section" value="joueurs" />
        <input name="q" defaultValue={q} placeholder="Pseudo ou e-mail" className="min-h-10 min-w-64 flex-1 rounded-full border-2 border-ink bg-surface px-4" />
        <button type="submit" className="mm-btn mm-btn--primary px-5">
          Rechercher
        </button>
      </form>
      <Table head={["Pseudo", "E-mail", "Trophées", "MemeMoney", "Rôle", "Statut", "Dernière activité"]}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>
              <Link href={`/admin?section=joueurs&id=${r.id}`} className="font-bold underline">
                {r.username}
              </Link>
            </td>
            <td className="break-all">{r.email ?? "—"}</td>
            <td>{r.trophies}</td>
            <td>{r.meme_money}</td>
            <td>{staffRoleLabel(r.id, r.role)}</td>
            <td>{r.banned_at ? "Banni" : "Actif"}</td>
            <td>{dateFr(r.last_seen_at)}</td>
          </tr>
        ))}
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
                <button type="submit" className="mm-btn mm-btn--secondary min-h-9 px-3 text-xs">
                  {status === "new" ? "Marquer traité" : "Rouvrir"}
                </button>
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
                <button type="submit" className="mm-btn mm-btn--secondary min-h-9 px-3 text-xs">
                  {status === "new" ? "Marquer traité" : "Rouvrir"}
                </button>
              </form>
            </div>
          </article>
        ))}
      </div>
    </Box>
  );
}

async function Cards({ id, isNew }: { id: string; isNew: boolean }) {
  const cards = await adminCards();
  const card = id ? cards.find((c) => c.id === id) : null;
  if (card || isNew) return <CardForm card={card ?? null} />;
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

function CardForm({ card }: { card: (Card & { isActive?: boolean; isDroppable?: boolean }) | null }) {
  const d = card?.defenseAbility?.effect;
  const defenseValue = d && "percent" in d ? d.percent : d && "chance" in d ? d.chance : 10;
  return (
    <Box title={card ? `Modifier : ${card.name}` : "Nouvelle carte"} aside={<Link href="/admin?section=cartes" className="text-sm font-bold underline">← Toutes les cartes</Link>}>
      <form action={saveCard} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {card ? <input type="hidden" name="id" value={card.id} /> : null}
        <Field label="Nom" name="name" defaultValue={card?.name} maxLength={40} required />
        <label className="grid gap-1 text-sm font-bold">
          Rareté
          <select name="rarity" defaultValue={card?.rarity ?? "commune"} className="min-h-10 rounded-xl border-2 border-ink bg-surface px-3 font-normal">
            {RARITIES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-bold">
          Vibe
          <select name="vibe" defaultValue={card?.vibe ?? "chaos"} className="min-h-10 rounded-xl border-2 border-ink bg-surface px-3 font-normal">
            {VIBES.map((vibe) => (
              <option key={vibe} value={vibe}>
                {vibe}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-bold sm:col-span-2">
          Description
          <textarea name="description" defaultValue={card?.description} maxLength={280} rows={2} className="rounded-xl border-2 border-ink bg-surface px-3 py-2 font-normal" />
        </label>
        <Field label="PV (60–140)" name="hp" type="number" defaultValue={card?.hp ?? 90} min={60} max={140} />
        <Field label="Attaque (20–65)" name="atk" type="number" defaultValue={card?.atk ?? 40} min={20} max={65} />
        <Field label="Défense (20–65)" name="def" type="number" defaultValue={card?.def ?? 35} min={20} max={65} />
        <Field label="Vitesse (10–100)" name="spd" type="number" defaultValue={card?.spd ?? 70} min={10} max={100} />
        <Field label="Attaque : nom" name="attackName" defaultValue={card?.normalAttack.name} maxLength={32} required />
        <Field label="Attaque : puissance (25–35)" name="attackPower" type="number" defaultValue={card?.normalAttack.power ?? 30} min={25} max={35} />
        <Field label="Spéciale : nom" name="specialName" defaultValue={card?.specialAttack.name} maxLength={32} required />
        <Field label="Spéciale : puissance (50–90)" name="specialPower" type="number" defaultValue={card?.specialAttack.power ?? 60} min={50} max={90} />
        <Field label="Spéciale : énergie (2–4)" name="specialCost" type="number" defaultValue={card?.specialAttack.energyCost ?? 3} min={2} max={4} />
        <Field label="Défense : nom" name="defenseName" defaultValue={card?.defenseAbility.name} maxLength={32} required />
        <label className="grid gap-1 text-sm font-bold">
          Défense : effet
          <select name="defenseKind" defaultValue={d?.kind ?? "heal"} className="min-h-10 rounded-xl border-2 border-ink bg-surface px-3 font-normal">
            <option value="heal">Soin (%)</option>
            <option value="reflect">Renvoi de dégâts (%)</option>
            <option value="dodge">Esquive (% de chances)</option>
            <option value="cleanse">Annule les effets négatifs</option>
            <option value="recharge">Recharge 1 énergie</option>
          </select>
        </label>
        <Field label="Défense : valeur (soin 5–20, renvoi 10–50, esquive 5–40)" name="defenseValue" type="number" defaultValue={defenseValue} min={0} max={60} />
        <CardArtPicker
          artSeed={card?.artSeed ?? 1}
          vibe={card?.vibe ?? "chaos"}
          rarity={card?.rarity ?? "commune"}
          imageUrl={card?.imageUrl ?? null}
        />
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" name="active" defaultChecked={card ? card.isActive !== false : true} className="size-4" /> Active dans le jeu
        </label>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" name="droppable" defaultChecked={card ? card.isDroppable !== false : true} className="size-4" /> Peut sortir des boosters
        </label>
        <label className="flex items-center gap-2 text-sm font-bold sm:col-span-2">
          <input type="checkbox" name="announce" className="size-4" /> Annoncer dans les news (les joueurs reçoivent une notification)
        </label>
        <button type="submit" className="mm-btn mm-btn--primary px-6 sm:col-span-2 lg:col-span-4 lg:justify-self-start">
          {card ? "Enregistrer la carte" : "Créer la carte"}
        </button>
      </form>
      {card ? (
        <form action={deleteCard} className="grid gap-3 border-t-2 border-dashed border-line pt-4 sm:grid-cols-[1fr_auto]">
          <input type="hidden" name="id" value={card.id} />
          <Field label={`Supprimer définitivement : retapez « ${card.name} »`} name="confirm" required />
          <button type="submit" className="mm-btn mm-btn--danger min-h-10 self-end px-5">
            Supprimer la carte
          </button>
        </form>
      ) : null}
      <p className="text-xs text-ink-soft">
        Illustration générée automatiquement, ou image importée / photo prise sur l&apos;appareil. Les modifications s&apos;appliquent immédiatement à tous les joueurs.
      </p>
    </Box>
  );
}

async function NewsAdmin() {
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
          <button type="submit" className="mm-btn mm-btn--primary px-6 sm:justify-self-start">
            Publier (notifie tous les joueurs)
          </button>
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
                <button type="submit" className="mm-btn mm-btn--ghost min-h-9 px-3 text-xs">
                  Supprimer
                </button>
              </form>
            </article>
          ))}
        </div>
      </Box>
    </>
  );
}

async function Challenges() {
  const rows = await sql()<{ id: string; code: string; type: string; target: number; reward_boosters: number; weight: number; is_active: boolean; params: { difficulty?: string } }[]>`
    select id, code, type::text as type, target, reward_boosters, weight, is_active, params from public.challenge_templates order by is_active desc, type, target
  `;
  return (
    <Box title="Défis du jour">
      <p className="text-sm text-ink-soft">
        Chaque joueur reçoit un défi par jour, tiré au hasard parmi les défis actifs (le « poids » augmente sa probabilité). Récompense : des boosters en plus.
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
            <button type="submit" className="mm-btn mm-btn--secondary min-h-10 px-4 text-sm">
              Enregistrer
            </button>
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
