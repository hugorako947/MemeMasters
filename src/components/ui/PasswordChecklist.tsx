"use client";

import { useTranslations } from "next-intl";
import { PASSWORD_MIN, PASSWORD_RULES } from "@/lib/validation/auth";

/** Liste des règles du mot de passe, cochées en direct pendant la frappe. */
export function PasswordChecklist({ password }: { password: string }) {
  const t = useTranslations("password");
  return (
    <ul className="mt-1 grid gap-1 text-sm sm:grid-cols-2" aria-live="polite">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <li key={rule.key} className={`flex items-center gap-2 ${ok ? "font-semibold text-success" : "text-ink-soft"}`}>
            <span
              aria-hidden="true"
              className={`grid size-5 place-items-center rounded-full border-2 text-[0.7rem] ${ok ? "border-success bg-success text-white" : "border-line"}`}
            >
              {ok ? "✓" : ""}
            </span>
            {t(rule.key, { min: PASSWORD_MIN })}
            <span className="sr-only">{ok ? t("ok") : t("missing")}</span>
          </li>
        );
      })}
    </ul>
  );
}
