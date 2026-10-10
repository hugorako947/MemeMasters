"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { applyAppearance } from "@/components/layout/PreferenceSync";
import { FormMessage } from "@/components/ui/Field";
import { postJson } from "@/lib/client/api";
import { ACCENTS, BASES, newSeed, parseAppearance, THEMES, type Appearance, type Theme } from "@/lib/theme/theme";

/** Aperçu miniature de chaque thème. */
const PREVIEW: Record<Theme, { bg: string; fg: string; accent: string; filter?: string }> = {
  light: { bg: "#f3f0ff", fg: "#1a1238", accent: "#ff3d7f" },
  dark: { bg: "#120d26", fg: "#f1edff", accent: "#ff3d7f" },
  inverted: { bg: "#0c0f00", fg: "#e5edc7", accent: "#00c280" },
  custom: { bg: "#f3f0ff", fg: "#1a1238", accent: "conic-gradient(#ff3d7f,#f5a400,#12a150,#2d5bff,#8b3dff,#ff3d7f)" },
  random: { bg: "linear-gradient(135deg,#ffe3ec,#e3f0ff 50%,#e7fbe9)", fg: "#1a1238", accent: "conic-gradient(#ffd23f,#00d8e6,#ff5fd2,#12a150,#ffd23f)" },
};

/** Choix du thème : appliqué immédiatement, enregistré dans le compte. */
export function AppearanceForm({ initial }: { initial: Appearance }) {
  const t = useTranslations("settings");
  const te = useTranslations("errors");
  const [value, setValue] = useState<Appearance>(initial);
  const [error, setError] = useState<string | null>(null);

  async function save(next: Appearance) {
    const normalized = parseAppearance(next);
    setValue(normalized);
    applyAppearance(normalized);
    setError(null);
    const result = await postJson("/api/settings/appearance", normalized);
    if (!result.ok) setError(te(result.code as "server_error"));
  }

  return (
    <div className="grid gap-4">
      <ul role="radiogroup" aria-label={t("themeTitle")} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {THEMES.map((theme) => {
          const p = PREVIEW[theme];
          const selected = value.theme === theme;
          return (
            <li key={theme}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                // « Aléatoire » : chaque clic tire une nouvelle palette.
                onClick={() => save(theme === "random" ? { theme, accent: newSeed(), base: null } : { ...value, theme })}
                className={`grid w-full gap-2 rounded-xl border-2 p-2 text-sm font-bold transition-transform hover:-translate-y-0.5 ${
                  selected ? "border-ink shadow-[0_3px_0_0_var(--mm-shadow)]" : "border-line"
                } bg-surface`}
              >
                <span className="mm-keep-colors grid h-16 place-items-center rounded-lg border-2 border-[#1a1238]" style={{ background: p.bg }} aria-hidden="true">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-8 rounded-full" style={{ background: p.fg }} />
                    <span className="size-4 rounded-full" style={{ background: p.accent }} />
                  </span>
                </span>
                <span>
                  {selected ? "✓ " : ""}
                  {t(`theme.${theme}`)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {value.theme === "random" ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-line bg-paper p-4">
          <p className="flex-1 text-sm text-ink-soft">{t("randomHint")}</p>
          <button type="button" onClick={() => save({ theme: "random", accent: newSeed(), base: null })} className="mm-btn mm-btn--primary min-h-10 px-4 text-sm">
            {t("randomAgain")}
          </button>
        </div>
      ) : null}

      {value.theme === "custom" ? (
        <div className="grid gap-4 rounded-xl border-2 border-line bg-paper p-4">
          <fieldset>
            <legend className="mb-2 text-sm font-bold">{t("accentTitle")}</legend>
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((accent) => (
                <button
                  key={accent}
                  type="button"
                  aria-label={accent}
                  aria-pressed={value.accent === accent}
                  onClick={() => save({ ...value, accent })}
                  className={`mm-keep-colors size-10 rounded-full border-2 transition-transform hover:scale-110 ${
                    value.accent === accent ? "scale-110 border-ink" : "border-white"
                  }`}
                  style={{ background: accent, boxShadow: "0 0 0 2px #1a1238" }}
                />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-bold">{t("baseTitle")}</legend>
            <div className="flex gap-2">
              {BASES.map((base) => (
                <button
                  key={base}
                  type="button"
                  aria-pressed={value.base === base}
                  onClick={() => save({ ...value, base })}
                  className={`min-h-10 rounded-full border-2 border-ink px-4 text-sm font-bold ${
                    value.base === base ? "bg-ink text-surface" : "bg-surface"
                  }`}
                >
                  {t(`theme.${base}`)}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      ) : null}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </div>
  );
}
