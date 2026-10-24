"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { RankShield } from "@/components/player/RankBadge";
import { ReportButton } from "@/components/moderation/ReportButton";
import { FormMessage } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { rankFor } from "@/config/ranks";
import { toast } from "@/components/ui/Toast";
import { postJson } from "@/lib/client/api";
import { useErrorText } from "@/lib/client/errors";
import type { Conversation, Thread, ThreadMessage } from "@/lib/server/messages";

const MAX = 500;

/**
 * Messagerie : liste des conversations, puis la conversation choisie.
 * Les nouveaux messages arrivent automatiquement (vérification toutes les
 * 4 secondes quand une conversation est ouverte, 15 secondes sinon).
 */
export function MessagesPanel({
  initial,
  openWith,
  friends,
}: {
  initial: Conversation[];
  openWith?: string;
  /** Amis à qui écrire directement (« Nouveau message »). */
  friends: Array<{ id: string; username: string; trophies: number }>;
}) {
  const t = useTranslations("messages");
  const [conversations, setConversations] = useState(initial);
  const [current, setCurrent] = useState<string | null>(openWith ?? null);
  const [picking, setPicking] = useState(false);
  const [filter, setFilter] = useState("");

  // La liste est rechargée dès qu'on y revient (conversation créée, supprimée, lue…), puis toutes les 15 s.
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (current) return;
    let cancelled = false;
    const refresh = async () => {
      const res = await fetch("/api/messages");
      if (res.ok && !cancelled) setConversations((await res.json()).conversations);
    };
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, 15_000);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [current, version]);

  if (current)
    return (
      <ThreadView
        username={current}
        onBack={() => {
          setCurrent(null);
          setVersion((v) => v + 1);
        }}
        onHidden={(name) => {
          setConversations((list) => list.filter((c) => c.other.username !== name));
          setCurrent(null);
          setVersion((v) => v + 1);
        }}
      />
    );

  const shownFriends = friends.filter((f) => f.username.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <section className="mm-online-only grid gap-3 rounded-[1.5rem] border-2 border-ink bg-surface p-4 shadow-[0_3px_0_0_var(--mm-shadow)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-3xl leading-none">{t("title")}</h2>
        <button type="button" onClick={() => setPicking((p) => !p)} aria-expanded={picking} className="mm-btn mm-btn--primary min-h-10 px-4 text-sm">
          {picking ? t("cancelNew") : t("new")}
        </button>
      </div>

      {/* Nouveau message : on choisit parmi ses amis. Pour un autre joueur : son profil, bouton « Écrire ». */}
      {picking ? (
        <div className="grid gap-2 rounded-xl border-2 border-ink bg-paper p-3">
          <p className="text-sm font-bold">{t("pickFriend")}</p>
          {friends.length === 0 ? (
            <p className="text-sm text-ink-soft">{t("noFriends")}</p>
          ) : (
            <>
              {friends.length > 6 ? (
                <input
                  type="search"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder={t("filterFriends")}
                  aria-label={t("filterFriends")}
                  className="min-h-10 rounded-full border-2 border-ink bg-surface px-4 text-sm"
                />
              ) : null}
              <ul className="grid gap-1">
                {shownFriends.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPicking(false);
                        setCurrent(f.username);
                      }}
                      className="flex min-h-11 w-full items-center gap-3 rounded-xl bg-surface px-3 text-start font-bold hover:bg-[color-mix(in_srgb,var(--color-candy),transparent_88%)]"
                    >
                      <RankShield rank={rankFor(f.trophies)} size={24} />
                      {f.username}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}
      {conversations.length === 0 ? (
        <p className="rounded-xl bg-paper p-4 text-sm font-semibold">{t("empty")}</p>
      ) : (
        <ul className="grid gap-1.5">
          {conversations.map((c) => (
            <li key={c.other.id}>
              <button
                type="button"
                onClick={() => setCurrent(c.other.username)}
                className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-start transition-colors hover:bg-paper ${c.unread > 0 ? "bg-[color-mix(in_srgb,var(--color-candy),transparent_90%)]" : ""}`}
              >
                <RankShield rank={rankFor(c.other.trophies)} size={30} />
                <span className="grid min-w-0 flex-1">
                  <span className="truncate font-extrabold">{c.other.username}</span>
                  <span className={`truncate text-sm ${c.unread > 0 ? "font-bold text-ink" : "text-ink-soft"}`}>
                    {c.last.fromMe ? `${t("you")} : ` : ""}
                    {c.last.body}
                  </span>
                </span>
                {c.unread > 0 ? (
                  <span className="grid min-w-6 place-items-center rounded-full bg-[#e5193f] px-1.5 text-xs font-extrabold text-white">{c.unread}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ThreadView({ username, onBack, onHidden }: { username: string; onBack: () => void; onHidden: (username: string) => void }) {
  const t = useTranslations("messages");
  const tf = useTranslations("feedback");
  const te = useTranslations("errors");
  const tl = useTranslations("loading");
  const errorText = useErrorText();
  const format = useFormatter();
  const router = useRouter();
  const [thread, setThread] = useState<Thread | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);
  const [confirmHide, setConfirmHide] = useState(false);

  async function removeMessage(id: string) {
    const res = await postJson("/api/messages/delete", { messageId: id });
    if (res.ok) {
      setThread((th) => (th ? { ...th, messages: th.messages.filter((m) => m.id !== id) } : th));
      toast.success(tf("messageDeleted"));
    } else setError(errorText(res.code));
    setConfirmMsg(null);
  }

  async function hide() {
    const res = await postJson("/api/messages/hide", { username });
    if (res.ok) {
      toast.success(tf("conversationDeleted"));
      router.refresh();
      onHidden(username);
    } else setError(errorText(res.code));
  }
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/messages/thread?avec=${encodeURIComponent(username)}`);
    if (!res.ok) {
      setError(te("player_not_found"));
      return;
    }
    const data: Thread = await res.json();
    setThread(data);
    // Des messages non lus viennent d'être lus : la notification s'efface aussitôt (navigation, onglets).
    if (data.newlyRead > 0) router.refresh();
  }, [username, te, router]);

  useEffect(() => {
    const first = setTimeout(load, 0); // premier chargement, hors du rendu
    const timer = setInterval(load, 4_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [thread?.messages.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const res = await postJson<ThreadMessage>("/api/messages/send", { to: username, body });
    setSending(false);
    if (res.ok) {
      setText("");
      setThread((th) => (th ? { ...th, messages: [...th.messages, res.data], remaining: th.remaining === null ? null : Math.max(0, th.remaining - 1) } : th));
    } else {
      setError(errorText(res.code));
    }
  }

  const blocked = thread?.blocked;
  const limitReached = thread?.remaining === 0;

  return (
    <section className="grid gap-3 rounded-[1.5rem] border-2 border-ink bg-surface p-4 shadow-[0_3px_0_0_var(--mm-shadow)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="inline-flex min-h-10 items-center font-bold text-ink-soft hover:text-ink">
          <span aria-hidden="true" className="me-1 inline-block rtl:rotate-180">←</span> {t("back")}
        </button>
        {thread ? (
          <span className="flex items-center gap-2">
            <Link href={`/profil/${encodeURIComponent(thread.other.username)}?depuis=messages`} className="flex items-center gap-2 font-extrabold hover:underline">
              <RankShield rank={rankFor(thread.other.trophies)} size={26} />
              {thread.other.username}
            </Link>
            <ReportButton playerId={thread.other.id} compact />
          </span>
        ) : null}
      </div>
      {confirmHide ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-paper p-3 text-sm">
          <span className="flex-1 font-semibold">{t("hideConfirm")}</span>
          <button type="button" onClick={hide} className="mm-btn mm-btn--danger min-h-10 px-4 text-sm">
            {t("delete")}
          </button>
          <button type="button" onClick={() => setConfirmHide(false)} className="mm-btn mm-btn--secondary min-h-10 px-4 text-sm">
            {t("keep")}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirmHide(true)} className="justify-self-end text-xs font-bold text-ink-soft underline-offset-4 hover:text-ink hover:underline">
          {t("hide")}
        </button>
      )}

      <div className="grid max-h-[55vh] min-h-48 content-start gap-2 overflow-y-auto rounded-xl bg-paper p-3" aria-live="polite">
        {/* Conversation en cours de chargement : un cercle tourne à la place des messages. */}
        {!thread && !error ? (
          <div className="grid min-h-40 place-items-center">
            <Spinner size="2rem" label={tl("title")} />
          </div>
        ) : null}
        {thread && thread.messages.length === 0 ? <p className="text-center text-sm text-ink-soft">{t("start", { username })}</p> : null}
        {thread?.messages.map((m) => (
          <div key={m.id} className={`grid max-w-[80%] gap-0.5 ${m.fromMe ? "justify-self-end text-end" : "justify-self-start"}`}>
            <p className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-start ${m.fromMe ? "rounded-br-sm bg-candy text-[var(--mm-accent-ink)]" : "rounded-bl-sm border-2 border-ink bg-surface"}`}>{m.body}</p>
            <span className="text-[0.7rem] text-ink-soft">
              {format.dateTime(new Date(m.createdAt), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              {m.fromMe && m.read ? ` · ${t("read")}` : ""}
              {m.fromMe ? (
                confirmMsg === m.id ? (
                  <>
                    {" · "}
                    <button type="button" onClick={() => removeMessage(m.id)} className="font-bold text-danger underline">
                      {t("confirmDelete")}
                    </button>
                    {" · "}
                    <button type="button" onClick={() => setConfirmMsg(null)} className="font-bold underline">
                      {t("keep")}
                    </button>
                  </>
                ) : (
                  <>
                    {" · "}
                    <button type="button" onClick={() => setConfirmMsg(m.id)} className="underline-offset-2 hover:underline">
                      {t("delete")}
                    </button>
                  </>
                )
              ) : null}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {blocked ? (
        <p className="rounded-xl bg-paper p-3 text-sm font-semibold">{blocked === "by_me" ? t("blockedByMe") : t("blockedByThem")}</p>
      ) : limitReached ? (
        <p className="rounded-xl bg-paper p-3 text-sm font-semibold">{t("limit")}</p>
      ) : (
        <form onSubmit={send} className="grid gap-2">
          {thread && !thread.friends && thread.remaining !== null ? <p className="text-xs text-ink-soft">{t("notFriend", { count: thread.remaining })}</p> : null}
          <div className="flex items-end gap-2">
            <label htmlFor="msg" className="sr-only">
              {t("placeholder")}
            </label>
            <textarea
              id="msg"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              rows={2}
              placeholder={t("placeholder")}
              className="min-h-12 flex-1 resize-none rounded-2xl border-2 border-ink bg-surface px-3 py-2"
            />
            <button type="submit" disabled={!text.trim() || sending} className="mm-btn mm-btn--primary min-h-12 px-5">
              {t("send")}
            </button>
          </div>
          <p className="text-end text-[0.7rem] text-ink-soft">
            {text.length} / {MAX}
          </p>
        </form>
      )}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </section>
  );
}
