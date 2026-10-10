"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { FormMessage } from "@/components/ui/Field";
import { postJson } from "@/lib/client/api";

const REASONS = ["spam", "harassment", "hate", "inappropriate_name", "cheating", "other"] as const;

/** Bouton « Signaler » : fenêtre avec le motif et des précisions facultatives. */
export function ReportButton({ playerId, compact = false }: { playerId: string; compact?: boolean }) {
  const t = useTranslations("report");
  const te = useTranslations("errors");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number] | "">("");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open && ref.current && !ref.current.open) ref.current.showModal();
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!reason) return;
    setState("sending");
    setError(null);
    const res = await postJson("/api/moderation/report", { playerId, reason, details: details.trim() || undefined });
    if (res.ok) setState("sent");
    else {
      setState("idle");
      setError(te(res.code as "server_error"));
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`mm-btn mm-btn--ghost min-h-10 text-sm ${compact ? "px-2" : "px-3"}`}>
        {t("button")}
      </button>
      {open
        ? createPortal(
            <dialog ref={ref} className="mm-detail" onClose={() => setOpen(false)} aria-label={t("title")}>
              <form onSubmit={submit} className="grid w-[min(28rem,92vw)] gap-4 rounded-[1.5rem] border-2 border-ink bg-paper p-5 shadow-[0_5px_0_0_var(--mm-shadow)]">
                <h2 className="font-display text-3xl leading-none">{t("title")}</h2>
                {state === "sent" ? (
                  <>
                    <FormMessage tone="success">{t("sent")}</FormMessage>
                    <button type="button" onClick={() => ref.current?.close()} className="mm-btn mm-btn--primary">
                      {t("close")}
                    </button>
                  </>
                ) : (
                  <>
                    <fieldset className="grid gap-2">
                      <legend className="mb-1 text-sm font-bold">{t("reason")}</legend>
                      {REASONS.map((r) => (
                        <label key={r} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-xl bg-surface px-3">
                          <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="size-4 accent-[var(--color-candy)]" />
                          {t(`reasons.${r}`)}
                        </label>
                      ))}
                    </fieldset>
                    <label className="grid gap-1.5 text-sm font-bold">
                      {t("details")}
                      <textarea value={details} onChange={(e) => setDetails(e.target.value.slice(0, 500))} rows={3} className="rounded-xl border-2 border-ink bg-surface px-3 py-2 font-normal" />
                    </label>
                    {error ? <FormMessage tone="error">{error}</FormMessage> : null}
                    <div className="flex flex-wrap gap-2">
                      <button type="submit" disabled={!reason || state === "sending"} className="mm-btn mm-btn--danger px-5">
                        {t("submit")}
                      </button>
                      <button type="button" onClick={() => ref.current?.close()} className="mm-btn mm-btn--secondary px-5">
                        {t("cancel")}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </dialog>,
            document.body,
          )
        : null}
    </>
  );
}
