"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { RankShield } from "@/components/player/RankBadge";
import { ReportButton } from "@/components/moderation/ReportButton";
import { FormMessage } from "@/components/ui/Field";
import { rankFor } from "@/config/ranks";
import { postJson } from "@/lib/client/api";
import type { Conversation, Thread, ThreadMessage } from "@/lib/server/messages";

const MAX = 500;

/**
 * Messagerie : liste des conversations, puis la conversation choisie.
 * Les nouveaux messages arrivent automatiquement (vérification toutes les
 * 4 secondes quand une conversation est ouverte, 15 secondes sinon).
 */
export function MessagesPanel({ initial, openWith }: { initial: Conversation[]; openWith?: string }) {
  const t = useTranslations("messages");
  const [conversations, setConversations] = useState(initial);
  const [current, setCurrent] = useState<string | null>(openWith ?? null);

  useEffect(() => {
    if (current) return;
    const timer = setInterval(async () => {
      const res = await fetch("/api/messages");
      if (res.ok) setConversations((await res.json()).conversations);
    }, 15_000);
    return () => clearInterval(timer);
  }, [current]);

  if (current) return <ThreadView username={current} onBack={() => setCurrent(null)} />;

  return (
    <section className="grid gap-3 rounded-[1.5rem] border-2 border-ink bg-surface p-4 shadow-[0_3px_0_0_var(--mm-shadow)] sm:p-5">
      <h2 className="font-display text-3xl leading-none">{t("title")}</h2>
      <p className="text-sm text-ink-soft">{t("lead")}</p>
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

function ThreadView({ username, onBack }: { username: string; onBack: () => void }) {
  const t = useTranslations("messages");
  const te = useTranslations("errors");
  const format = useFormatter();
  const router = useRouter();
  const [thread, setThread] = useState<Thread | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const lastId = useRef<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/messages/thread?avec=${encodeURIComponent(username)}`);
    if (!res.ok) {
      setError(te("player_not_found"));
      return;
    }
    const data: Thread = await res.json();
    setThread(data);
    const newest = data.messages.at(-1)?.id ?? null;
    if (newest !== lastId.current) {
      lastId.current = newest;
      router.refresh(); // met à jour les compteurs de messages non lus
    }
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
      setError(te(res.code as "server_error"));
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

      <div className="grid max-h-[55vh] min-h-48 content-start gap-2 overflow-y-auto rounded-xl bg-paper p-3" aria-live="polite">
        {thread && thread.messages.length === 0 ? <p className="text-center text-sm text-ink-soft">{t("start", { username })}</p> : null}
        {thread?.messages.map((m) => (
          <div key={m.id} className={`grid max-w-[80%] gap-0.5 ${m.fromMe ? "justify-self-end text-end" : "justify-self-start"}`}>
            <p className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-start ${m.fromMe ? "rounded-br-sm bg-candy text-[var(--mm-accent-ink)]" : "rounded-bl-sm border-2 border-ink bg-surface"}`}>{m.body}</p>
            <span className="text-[0.7rem] text-ink-soft">
              {format.dateTime(new Date(m.createdAt), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              {m.fromMe && m.read ? ` · ${t("read")}` : ""}
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
