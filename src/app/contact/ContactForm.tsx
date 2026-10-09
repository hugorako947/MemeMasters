"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage, RequiredNote } from "@/components/ui/Field";
import { postJson } from "@/lib/client/api";
import { looksLikeEmail } from "@/lib/validation/auth";
import { CONTACT_CATEGORIES, CONTACT_MESSAGE_MAX, CONTACT_MESSAGE_MIN, type ContactCategory } from "@/lib/validation/contact";

export function ContactForm({ defaultEmail }: { defaultEmail: string }) {
  const t = useTranslations("contact");
  const te = useTranslations("errors");
  const [email, setEmail] = useState(defaultEmail);
  const [category, setCategory] = useState<ContactCategory | "">("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const length = message.trim().length;
  const ready = looksLikeEmail(email) && category !== "" && length >= CONTACT_MESSAGE_MIN && length <= CONTACT_MESSAGE_MAX;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setPending(true);
    setError(null);
    const result = await postJson("/api/contact", { email, category, message, website });
    setPending(false);
    if (result.ok) setSent(true);
    else setError(te(result.code as "server_error"));
  }

  if (sent) return <FormMessage tone="success">{t("sent")}</FormMessage>;

  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-[1.5rem] border-2 border-ink bg-surface p-5 shadow-[0_3px_0_0_var(--mm-shadow)]" noValidate>
      <RequiredNote>{t("required")}</RequiredNote>
      <Field
        label={t("email")}
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={email && !looksLikeEmail(email) ? te("invalid_email") : null}
        required
      />
      <div className="grid gap-1.5">
        <label htmlFor="f-category" className="text-sm font-bold">
          {t("category")}
          <span aria-hidden="true" className="ms-0.5 text-candy-ink">
            *
          </span>
        </label>
        <select
          id="f-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as ContactCategory)}
          required
          className="min-h-12 rounded-xl border-2 border-ink bg-surface px-3 text-base"
        >
          <option value="" disabled>
            {t("choose")}
          </option>
          {CONTACT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`categories.${c}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="f-message" className="text-sm font-bold">
          {t("message")}
          <span aria-hidden="true" className="ms-0.5 text-candy-ink">
            *
          </span>
        </label>
        <textarea
          id="f-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          maxLength={CONTACT_MESSAGE_MAX}
          required
          aria-describedby="f-message-count"
          className="rounded-xl border-2 border-ink bg-surface px-4 py-3 text-base outline-none focus-visible:border-link"
        />
        <p id="f-message-count" className="text-end text-xs text-ink-soft">
          {t("count", { count: length, max: CONTACT_MESSAGE_MAX, min: CONTACT_MESSAGE_MIN })}
        </p>
      </div>
      {/* Champ piège, invisible pour les humains. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Button type="submit" disabled={!ready || pending}>
        {pending ? "…" : t("submit")}
      </Button>
    </form>
  );
}
