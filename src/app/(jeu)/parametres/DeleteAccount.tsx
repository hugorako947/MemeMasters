"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage } from "@/components/ui/Field";
import { postJson } from "@/lib/client/api";

/**
 * Suppression définitive du compte, en deux temps : un bouton, puis une
 * fenêtre de confirmation où le joueur doit retaper son pseudo.
 */
export function DeleteAccount({ username }: { username: string }) {
  const t = useTranslations("settings.delete");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="danger" onClick={() => setOpen(true)}>
        {t("button")}
      </Button>
      {open ? <DeleteDialog username={username} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function DeleteDialog({ username, onClose }: { username: string; onClose: () => void }) {
  const t = useTranslations("settings.delete");
  const te = useTranslations("errors");
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim().toLowerCase() === username.toLowerCase();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, [onClose]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!matches) return;
    setPending(true);
    setError(null);
    const result = await postJson("/api/account/delete", { confirmUsername: typed });
    if (result.ok) {
      // Session effacée côté serveur : retour à l'accueil visiteur.
      router.replace("/");
      router.refresh();
      return;
    }
    setPending(false);
    setError(te(result.code as "server_error"));
  }

  return createPortal(
    <dialog ref={ref} className="mm-detail" aria-labelledby="delete-title" style={{ width: "min(100% - 1.5rem, 32rem)" }}>
      <form
        onSubmit={onSubmit}
        className="grid gap-4 rounded-[1.75rem] border-[3px] border-ink bg-surface p-5 shadow-[0_8px_0_0_var(--mm-shadow)] sm:p-6"
      >
        <h2 id="delete-title" className="font-display text-4xl leading-none text-danger">
          {t("title")}
        </h2>
        <p>{t("lead")}</p>
        <ul className="grid list-disc gap-1 pl-5 text-sm text-ink-soft">
          <li>{t("item1")}</li>
          <li>{t("item2")}</li>
          <li>{t("item3")}</li>
        </ul>
        <Field
          label={t("confirmLabel", { username })}
          name="confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={() => ref.current?.close()}>
            {t("cancel")}
          </Button>
          <Button type="submit" variant="danger" disabled={!matches || pending}>
            {pending ? "…" : t("confirm")}
          </Button>
        </div>
      </form>
    </dialog>,
    document.body,
  );
}
