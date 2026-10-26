"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useBindingLabel } from "@/components/match/useBindingLabel";
import { assignBinding, bindingOfMouse, brSettings, BR_ACTIONS, DEFAULT_BR_SETTINGS, useBrSettings, type BrAction } from "@/lib/client/br-settings";
import { playTest, setSfxVolume, unlockAudio } from "@/lib/client/sfx";

/**
 * Réglages → Battle Royale : touches modifiables (clavier et souris) et volumes. Enregistrés sur l'appareil.
 * Pour changer une touche : on touche le bouton de l'action, puis on appuie sur la nouvelle touche (Échap annule).
 */
export function BattleSettings() {
  const t = useTranslations("settings.br");
  const tc = useTranslations("match.controls");
  const settings = useBrSettings();
  const label = useBindingLabel();
  const [listening, setListening] = useState<BrAction | null>(null);

  const actionName = (a: BrAction) =>
    a === "up" || a === "down" || a === "left" || a === "right" ? t(a) : tc(a === "weapon" ? "weapon" : a === "fire" ? "fire" : a === "pickup" ? "pickup" : a === "reload" ? "reload" : "ability");

  // En attente d'une touche : la prochaine touche ou le prochain clic devient la touche de l'action.
  useEffect(() => {
    if (!listening) return;
    const done = (binding: string | null) => {
      if (binding) brSettings.set(assignBinding(brSettings.get(), listening, binding));
      setListening(null);
    };
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      done(e.code === "Escape" ? null : e.code);
    };
    const onMouse = (e: MouseEvent) => {
      e.preventDefault();
      done(bindingOfMouse(e.button));
    };
    const noMenu = (e: Event) => e.preventDefault();
    // Écouteurs posés au tick suivant : le clic qui a lancé l'attente ne doit pas être pris pour la nouvelle touche.
    const id = setTimeout(() => {
      window.addEventListener("keydown", onKey, true);
      window.addEventListener("mousedown", onMouse, true);
      window.addEventListener("contextmenu", noMenu, true);
    }, 0);
    return () => {
      clearTimeout(id);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mousedown", onMouse, true);
      window.removeEventListener("contextmenu", noMenu, true);
    };
  }, [listening]);

  const setVolume = (key: "sfx" | "music", value: number) => {
    brSettings.set({ ...brSettings.get(), [key]: value });
    if (key === "sfx") setSfxVolume(value);
  };

  return (
    <div className="grid gap-5">
      <p className="text-ink-soft">{t("lead")}</p>

      <div className="grid gap-2">
        <h3 className="font-extrabold">{t("keysTitle")}</h3>
        <p className="text-sm text-ink-soft">{t("keysLead")}</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {BR_ACTIONS.map((a) => (
            <li key={a} className="flex items-center justify-between gap-3 rounded-xl bg-paper px-3 py-2">
              <span className="font-semibold">{actionName(a)}</span>
              <button
                type="button"
                onClick={() => setListening(listening === a ? null : a)}
                aria-label={t("change", { action: actionName(a) })}
                aria-pressed={listening === a}
                className={`min-h-11 min-w-24 rounded-lg border-2 border-ink px-3 text-sm font-extrabold ${listening === a ? "bg-candy text-[var(--mm-accent-ink)]" : "bg-surface"}`}
              >
                {listening === a ? "…" : label(settings.keys[a])}
              </button>
            </li>
          ))}
        </ul>
        {listening ? (
          <p role="status" className="text-sm font-bold">
            {t("press")}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => brSettings.set({ ...brSettings.get(), keys: { ...DEFAULT_BR_SETTINGS.keys } })}
          className="mm-btn mm-btn--secondary min-h-11 justify-self-start px-5 text-sm"
        >
          {t("reset")}
        </button>
      </div>

      <div className="grid gap-3">
        <h3 className="font-extrabold">{t("soundTitle")}</h3>
        {(["sfx", "music"] as const).map((key) => (
          <label key={key} className="grid gap-1">
            <span className="flex items-center justify-between text-sm font-semibold">
              <span>{t(key)}</span>
              <bdi dir="ltr">{settings[key]} %</bdi>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={settings[key]}
              onChange={(e) => setVolume(key, Number(e.target.value))}
              className="min-h-11 w-full accent-[var(--color-candy)]"
            />
          </label>
        ))}
        <p className="text-xs text-ink-soft">{t("musicSoon")}</p>
        <button
          type="button"
          onClick={() => {
            unlockAudio();
            setSfxVolume(settings.sfx);
            playTest();
          }}
          className="mm-btn mm-btn--secondary min-h-11 justify-self-start px-5 text-sm"
        >
          {t("test")}
        </button>
      </div>
    </div>
  );
}
