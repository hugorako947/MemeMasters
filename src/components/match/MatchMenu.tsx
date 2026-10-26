"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { FullscreenToggle } from "@/components/install/FullscreenToggle";
import { Button, buttonClass, ButtonLink } from "@/components/ui/Button";
import { useBrSettings } from "@/lib/client/br-settings";
import { useBindingLabel } from "./useBindingLabel";

/**
 * Les commandes au clavier et à la souris, puis au toucher (menu de partie et page Battle Royale).
 * `editHref` : bouton « Modifier » vers les réglages du Battle Royale (pas pendant une partie).
 */
export function ControlsHelp({ editHref }: { editHref?: string }) {
  const t = useTranslations("match.controls");
  const { keys } = useBrSettings();
  const label = useBindingLabel();
  const rows: Array<[string, string]> = [
    [t("move"), `${[keys.up, keys.left, keys.down, keys.right].map(label).join(" ")} · ${t("arrows")}`],
    [t("aim"), t("keysAim")],
    [t("fire"), t("hold", { key: label(keys.fire) })],
    [t("ability"), label(keys.ability)],
    [t("pickup"), label(keys.pickup)],
    [t("reload"), label(keys.reload)],
    [t("weapon"), `${label(keys.weapon)}, ${t("wheel")}`],
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
      {editHref ? (
        <ButtonLink href={editHref} variant="secondary" className="min-h-11 justify-self-start px-5 text-sm">
          {t("edit")}
        </ButtonLink>
      ) : null}
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
