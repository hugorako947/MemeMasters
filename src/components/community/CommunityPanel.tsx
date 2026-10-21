"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { ImagePicker } from "@/components/ui/ImagePicker";
import { toast } from "@/components/ui/Toast";
import { cardArtDataUri } from "@/lib/art/generate";
import { postForm, postJson } from "@/lib/client/api";
import { useErrorText } from "@/lib/client/errors";
import type { CommunityCard, CommunityView } from "@/lib/server/community";

const NAME_MAX = 40;
const DESCRIPTION_MAX = 140;

/**
 * Communauté : proposer une carte de meme, voter pour sa préférée (une voix,
 * qu'on peut déplacer), suivre ses propositions. L'équipe vérifie les
 * propositions avant le vote et fait sortir la plus votée dans le jeu.
 */
export function CommunityPanel({ view, meId, staff }: { view: CommunityView; meId: string; staff: boolean }) {
  const t = useTranslations("community");
  const errorText = useErrorText();
  const router = useRouter();
  // Vote affiché tout de suite (avant la réponse du serveur) : le jeu paraît instantané.
  // Il vaut pour les données reçues à ce moment-là ; les données suivantes du serveur le remplacent.
  const [optimistic, setOptimistic] = useState<{ base: CommunityView; vote: string | null } | null>(null);
  const myVote = optimistic && optimistic.base === view ? optimistic.vote : view.myVote;
  const voting = view.voting.map((c) => ({ ...c, votes: c.votes + (c.id === myVote ? 1 : 0) - (c.id === view.myVote ? 1 : 0) }));

  async function vote(card: CommunityCard) {
    const next = myVote === card.id ? null : card.id;
    setOptimistic({ base: view, vote: next });
    const res = await postJson("/api/community/vote", { cardId: next });
    if (!res.ok) {
      setOptimistic(null);
      toast.error(errorText(res.code));
      return;
    }
    toast.success(next ? t("voted", { name: card.name }) : t("unvoted"));
    router.refresh();
  }

  const leaderVotes = Math.max(1, ...voting.map((c) => c.votes));
  const ranked = [...voting].sort((a, b) => b.votes - a.votes || a.createdAt.localeCompare(b.createdAt));

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 rounded-[1.5rem] border-2 border-ink bg-surface p-4 shadow-[0_3px_0_0_var(--mm-shadow)] sm:p-5">
        <h2 className="font-display text-3xl leading-none">{t("title")}</h2>
        <p className="text-ink-soft">{t("lead")}</p>
        <ol className="grid grid-cols-2 gap-2 text-sm font-bold sm:grid-cols-4">
          {(["propose", "check", "vote", "release"] as const).map((step, i) => (
            <li key={step} className="flex items-center gap-2 rounded-xl bg-paper px-3 py-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-ink bg-sticker text-xs text-[#1a1238]">{i + 1}</span>
              {t(`steps.${step}`)}
            </li>
          ))}
        </ol>
      </section>

      {staff ? <StaffReview pending={view.pending} /> : null}

      <section className="grid gap-3" aria-labelledby="communaute-vote">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="communaute-vote" className="font-display text-2xl leading-none">
            {t("voteTitle")}
          </h3>
          <p className="text-sm font-semibold text-ink-soft">{myVote ? t("voteUsed") : t("voteFree")}</p>
        </div>
        {ranked.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-ink/40 p-5 text-center text-sm font-semibold text-ink-soft">{t("voteEmpty")}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ranked.map((c, i) => {
              const mine = c.authorId === meId;
              const chosen = myVote === c.id;
              return (
                <li key={c.id} className={`grid gap-2 rounded-2xl border-2 bg-surface p-3 ${chosen ? "border-candy shadow-[0_3px_0_0_var(--color-candy)]" : "border-ink"}`}>
                  <Art card={c} badge={i === 0 && c.votes > 0 ? t("leader") : null} />
                  <div className="grid gap-0.5">
                    <p className="font-extrabold leading-tight">{c.name}</p>
                    {c.description ? <p className="text-sm text-ink-soft">{c.description}</p> : null}
                    <p className="text-xs text-ink-soft">{t("by", { name: c.author ?? "?" })}</p>
                  </div>
                  <div className="grid gap-1">
                    <div className="h-2.5 overflow-hidden rounded-full border-2 border-ink bg-paper" aria-hidden="true">
                      <div className="h-full bg-candy transition-[width] duration-300" style={{ width: `${(c.votes / leaderVotes) * 100}%` }} />
                    </div>
                    <p className="text-sm font-bold">{t("votes", { count: c.votes })}</p>
                  </div>
                  {mine ? (
                    <p className="rounded-full bg-paper px-3 py-2 text-center text-sm font-bold">{t("yourCard")}</p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => vote(c)}
                      aria-pressed={chosen}
                      className={`mm-btn mm-online-only min-h-10 w-full px-4 text-sm ${chosen ? "mm-btn--primary" : "mm-btn--secondary"}`}
                    >
                      {chosen ? t("myVote") : myVote ? t("moveVote") : t("vote")}
                    </button>
                  )}
                  {staff ? (
                    <Link href={`/admin?section=cartes&nouvelle=1&communaute=${c.id}`} className="text-center text-xs font-bold underline">
                      {t("release")}
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ProposeForm canPropose={view.mine.filter((c) => c.status === "pending" || c.status === "voting").length < 2} />

      {view.mine.length > 0 ? <MyProposals cards={view.mine} /> : null}

      {view.released.length > 0 ? (
        <section className="grid gap-3" aria-labelledby="communaute-sorties">
          <h3 id="communaute-sorties" className="font-display text-2xl leading-none">
            {t("releasedTitle")}
          </h3>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {view.released.map((c) => (
              <li key={c.id} className="grid gap-1 text-sm">
                <Art card={c} />
                <p className="font-bold leading-tight">{c.name}</p>
                <p className="text-xs text-ink-soft">{t("by", { name: c.author ?? "?" })}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Art({ card, badge }: { card: CommunityCard; badge?: string | null }) {
  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-ink bg-paper">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={card.imageUrl ?? cardArtDataUri({ seed: card.artSeed, rarity: "commune" })} alt="" loading="lazy" className="aspect-[5/4] w-full object-cover" />
      {badge ? (
        <span className="absolute start-2 top-2 rounded-full border-2 border-ink bg-sticker px-2.5 py-0.5 text-xs font-extrabold text-[#1a1238]">{badge}</span>
      ) : null}
    </div>
  );
}

function ProposeForm({ canPropose }: { canPropose: boolean }) {
  const t = useTranslations("community");
  const tp = useTranslations("imagePicker");
  const errorText = useErrorText();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seed] = useState(() => Math.floor(Math.random() * 2_000_000_000));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2 || pending) return;
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("description", description.trim());
    if (image) fd.set("image", image);
    const res = await postForm("/api/community/propose", fd);
    setPending(false);
    if (!res.ok) {
      setError(errorText(res.code));
      toast.error(errorText(res.code));
      return;
    }
    toast.success(t("proposed"));
    setOpen(false);
    setName("");
    setDescription("");
    setImage(null);
    setPreview(null);
    router.refresh();
  }

  if (!open) {
    return (
      <div className="grid justify-items-start gap-1">
        <Button type="button" className="mm-online-only px-6" disabled={!canPropose} onClick={() => setOpen(true)}>
          {t("proposeButton")}
        </Button>
        {!canPropose ? <p className="text-sm text-ink-soft">{t("limitReached")}</p> : null}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-[1.5rem] border-2 border-ink bg-surface p-4 shadow-[0_3px_0_0_var(--mm-shadow)] sm:grid-cols-[minmax(0,1fr)_14rem] sm:p-5">
      <div className="grid content-start gap-3">
        <h3 className="font-display text-2xl leading-none">{t("proposeTitle")}</h3>
        <label className="grid gap-1 text-sm font-bold">
          {t("name")}
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} required minLength={2} placeholder={t("namePlaceholder")} className="min-h-12 rounded-xl border-2 border-ink bg-surface px-4 font-normal" />
        </label>
        <label className="grid gap-1 text-sm font-bold">
          {t("description")}
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={DESCRIPTION_MAX} rows={2} placeholder={t("descriptionPlaceholder")} className="rounded-xl border-2 border-ink bg-surface px-4 py-2 font-normal" />
          <span className="text-end text-xs font-normal text-ink-soft">
            {description.length} / {DESCRIPTION_MAX}
          </span>
        </label>
        <div className="grid gap-1.5">
          <p className="text-sm font-bold">{t("illustration")}</p>
          <ImagePicker
            labels={{
              image: tp("image"),
              photo: tp("photo"),
              capture: tp("capture"),
              cancel: tp("cancel"),
              preparing: tp("preparing"),
              cameraBlocked: tp("cameraBlocked"),
              cameraInsecure: tp("cameraInsecure"),
              unreadable: tp("unreadable"),
              notImage: tp("notImage"),
            }}
            onPick={(f) => {
              setImage(f);
              setPreview(URL.createObjectURL(f));
            }}
          />
          <p className="text-xs text-ink-soft">{image ? t("imageReady") : t("illustrationHint")}</p>
        </div>
        <p className="rounded-xl bg-paper px-3 py-2 text-xs text-ink-soft">{t("rules")}</p>
        {error ? (
          <p role="alert" className="text-sm font-bold text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" pending={pending} disabled={name.trim().length < 2} className="px-6">
            {pending ? t("sending") : t("send")}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
        </div>
      </div>
      <div className="grid content-start gap-2">
        <p className="text-sm font-bold text-ink-soft">{t("preview")}</p>
        <div className="overflow-hidden rounded-xl border-2 border-ink bg-paper">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview ?? cardArtDataUri({ seed, rarity: "commune" })} alt="" className="aspect-[5/4] w-full object-cover" />
        </div>
        <p className="font-extrabold leading-tight">{name || t("namePlaceholder")}</p>
        {image ? (
          <button
            type="button"
            className="justify-self-start text-xs font-bold underline"
            onClick={() => {
              setImage(null);
              setPreview(null);
            }}
          >
            {t("removeImage")}
          </button>
        ) : null}
      </div>
    </form>
  );
}

const STATUS_STYLE = {
  pending: "bg-sticker text-[#1a1238]",
  voting: "bg-[#d6ecff] text-[#123a7a]",
  rejected: "bg-[#ffd3dc] text-[#8a0f2c]",
  released: "bg-[#c9f2d8] text-[#0b5d33]",
} as const;

function MyProposals({ cards }: { cards: CommunityCard[] }) {
  const t = useTranslations("community");
  const format = useFormatter();
  const errorText = useErrorText();
  const router = useRouter();
  const [confirming, setConfirming] = useState<string | null>(null);

  async function withdraw(id: string) {
    const res = await postJson("/api/community/withdraw", { cardId: id });
    setConfirming(null);
    if (!res.ok) return toast.error(errorText(res.code));
    toast.success(t("withdrawn"));
    router.refresh();
  }

  return (
    <section className="grid gap-3" aria-labelledby="communaute-miennes">
      <h3 id="communaute-miennes" className="font-display text-2xl leading-none">
        {t("mineTitle")}
      </h3>
      <ul className="grid gap-2">
        {cards.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-ink bg-surface p-3">
            <div className="w-20 shrink-0">
              <Art card={c} />
            </div>
            <div className="grid min-w-0 flex-1 gap-1">
              <p className="font-extrabold leading-tight">{c.name}</p>
              <p className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full px-2.5 py-0.5 font-extrabold ${STATUS_STYLE[c.status]}`}>{t(`status.${c.status}`)}</span>
                {c.status === "voting" ? <span className="font-bold">{t("votes", { count: c.votes })}</span> : null}
                <span className="text-ink-soft">{format.dateTime(new Date(c.createdAt), { day: "numeric", month: "short" })}</span>
              </p>
              {c.status === "rejected" && c.rejectReason ? <p className="text-xs text-ink-soft">{t("rejectReason", { reason: c.rejectReason })}</p> : null}
            </div>
            {c.status !== "released" ? (
              confirming === c.id ? (
                <span className="flex gap-2">
                  <button type="button" onClick={() => withdraw(c.id)} className="mm-btn mm-btn--danger min-h-9 px-3 text-xs">
                    {t("confirmWithdraw")}
                  </button>
                  <button type="button" onClick={() => setConfirming(null)} className="mm-btn mm-btn--secondary min-h-9 px-3 text-xs">
                    {t("keep")}
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirming(c.id)} className="mm-btn mm-btn--ghost mm-online-only min-h-9 px-2 text-xs">
                  {t("withdraw")}
                </button>
              )
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Équipe : propositions à vérifier avant qu'elles ne passent au vote. */
function StaffReview({ pending }: { pending: CommunityCard[] }) {
  const t = useTranslations("community");
  const errorText = useErrorText();
  const router = useRouter();
  const [reasons, setReasons] = useState<Record<string, string>>({});

  async function decide(card: CommunityCard, decision: "approve" | "reject") {
    const res = await postJson("/api/community/review", { cardId: card.id, decision, reason: reasons[card.id]?.trim() || undefined });
    if (!res.ok) return toast.error(errorText(res.code));
    toast.success(decision === "approve" ? t("staff.approved", { name: card.name }) : t("staff.rejected", { name: card.name }));
    router.refresh();
  }

  return (
    <section className="grid gap-3 rounded-[1.5rem] border-2 border-dashed border-ink bg-surface p-4 sm:p-5" aria-labelledby="communaute-equipe">
      <h3 id="communaute-equipe" className="font-display text-2xl leading-none">
        {t("staff.title", { count: pending.length })}
      </h3>
      <p className="text-sm text-ink-soft">{t("staff.lead")}</p>
      {pending.length === 0 ? <p className="text-sm font-semibold">{t("staff.empty")}</p> : null}
      <ul className="grid gap-3 sm:grid-cols-2">
        {pending.map((c) => (
          <li key={c.id} className="grid gap-2 rounded-2xl border-2 border-ink bg-paper p-3">
            <Art card={c} />
            <p className="font-extrabold leading-tight">{c.name}</p>
            {c.description ? <p className="text-sm">{c.description}</p> : null}
            <p className="text-xs text-ink-soft">{t("by", { name: c.author ?? "?" })}</p>
            <input
              value={reasons[c.id] ?? ""}
              onChange={(e) => setReasons((r) => ({ ...r, [c.id]: e.target.value }))}
              maxLength={200}
              placeholder={t("staff.reasonPlaceholder")}
              aria-label={t("staff.reasonPlaceholder")}
              className="min-h-10 rounded-xl border-2 border-ink bg-surface px-3 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => decide(c, "approve")} className="mm-btn mm-btn--primary min-h-10 px-4 text-sm">
                {t("staff.approve")}
              </button>
              <button type="button" onClick={() => decide(c, "reject")} className="mm-btn mm-btn--secondary min-h-10 px-4 text-sm">
                {t("staff.reject")}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
