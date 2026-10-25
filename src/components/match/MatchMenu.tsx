"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { FullscreenToggle } from "@/components/install/FullscreenToggle";
import { Button, buttonClass } from "@/components/ui/Button";

/** Les commandes au clavier et à la souris, puis au toucher (menu de partie et écran de préparation). */
export function ControlsHelp() {
  const t = useTranslations("match.controls");
  const rows: Array<[string, string]> = [
    [t("move"), t("keysMove")],
    [t("aim"), t("keysAim")],
    [t("fire"), t("keysFire")],
    [t("ability"), t("keysAbility")],
    [t("pickup"), t("keysPickup")],
    [t("reload"), t("keysReload")],
    [t("weapon"), t("keysWeapon")],
    [t("menu"), t("keysMenu")],
  ];
  return (
    <div className="grid gap-2 text-sm">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {rows.map(([action, keys]) => (
          <div key={action} className="contents">
            <dt className="font-bold">{action}</dt>
            <dd className="text-ink-soft">{keys}</dd>
          </div>
        ))}
      </dl>
      <p className="text-ink-soft">{t("touch")}</p>
      <p className="text-ink-soft">{t("heal")}</p>
    </div>
  );
}

/** Menu de partie : la partie continue derrière (pas de pause), utilisable au clavier (Échap ferme). */
export function MatchMenu({ onResume, onQuit }: { onResume(): void; onQuit(): void }) {
  const t = useTranslations("match.menu");
  const tc = useTranslations("match.controls");
  const [confirm, setConfirm] = useState(false);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);
  return (
    <div className="absolute inset-0 z-20 grid place-items-center overflow-y-auto bg-ink/40 p-4" role="dialog" aria-modal="true" aria-labelledby="mm-match-menu">
      <div className="grid w-full max-w-md gap-4 rounded-2xl border-2 border-ink bg-surface p-5 text-ink shadow-[0_3px_0_0_var(--mm-shadow)]">
        <h2 id="mm-match-menu" className="font-display text-3xl leading-none">
          {t("title")}
        </h2>
        <p className="text-sm text-ink-soft">{t("running")}</p>
        {confirm ? (
          <div className="grid gap-3">
            <p className="font-bold">{t("quitConfirm")}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" className="min-h-11 px-5" onClick={onQuit}>
                {t("quitYes")}
              </Button>
              <Button variant="secondary" className="min-h-11 px-5" onClick={() => setConfirm(false)}>
                {t("resume")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button ref={first} type="button" className={buttonClass("primary", "min-h-11 px-5")} onClick={onResume}>
              {t("resume")}
            </button>
            <Button variant="secondary" className="min-h-11 px-5" onClick={() => setConfirm(true)}>
              {t("quit")}
            </Button>
            <FullscreenToggle compact />
          </div>
        )}
        <details className="rounded-xl bg-paper p-3">
          <summary className="min-h-11 cursor-pointer content-center font-extrabold">{tc("title")}</summary>
          <ControlsHelp />
        </details>
      </div>
    </div>
  );
}
