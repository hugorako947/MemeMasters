"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { FormMessage } from "@/components/ui/Field";
import { postJson } from "@/lib/client/api";
import { isAvailable, LOCALES } from "@/lib/i18n/locales";

/** Choix de la langue : appliqué tout de suite, enregistré dans le compte. */
export function LanguageForm() {
  const t = useTranslations("settings");
  const te = useTranslations("errors");
  const current = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(code: string) {
    if (code === current || !isAvailable(code)) return;
    setPending(code);
    setError(null);
    const result = await postJson("/api/settings/locale", { locale: code });
    setPending(null);
    if (result.ok) router.refresh();
    else setError(te(result.code as "server_error"));
  }

  return (
    <div className="grid gap-3">
      <ul role="radiogroup" aria-label={t("languageTitle")} className="grid gap-2 sm:grid-cols-2">
        {LOCALES.map((l) => {
          const available = isAvailable(l.code);
          const selected = l.code === current;
          return (
            <li key={l.code}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={!available || pending !== null}
                onClick={() => choose(l.code)}
                lang={l.code}
                dir={l.dir}
                className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border-2 px-4 text-start font-bold transition-colors ${
                  selected ? "border-ink bg-candy text-[var(--mm-accent-ink)]" : "border-line bg-surface hover:border-ink"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <span>{l.name}</span>
                <span className="text-xs font-semibold" lang={current}>
                  {selected ? "✓" : !available ? t("languageSoon") : pending === l.code ? "…" : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </div>
  );
}
