"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  document.addEventListener("fullscreenchange", cb);
  return () => document.removeEventListener("fullscreenchange", cb);
};

/**
 * Bouton « Plein écran » : masque les barres du navigateur et du système pour
 * une meilleure expérience de jeu. Sur iPhone (où les sites ne peuvent pas
 * passer en plein écran), on conseille d'installer l'application.
 */
export function FullscreenToggle({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("fullscreen");
  const isFull = useSyncExternalStore(subscribe, () => document.fullscreenElement !== null, () => false);
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setSupported(Boolean(document.fullscreenEnabled)), 0);
    return () => clearTimeout(id);
  }, []);

  async function toggle() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    } catch {
      /* refusé par le navigateur */
    }
  }

  if (supported === null) return null;
  if (!supported) return compact ? null : <p className="text-sm text-ink-soft">{t("unsupported")}</p>;
  if (compact)
    return (
      <button type="button" onClick={toggle} aria-pressed={isFull} className="mm-btn mm-btn--ghost min-h-11 gap-2 px-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          {isFull ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
        </svg>
        {isFull ? t("exit") : t("enter")}
      </button>
    );
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-ink-soft">{t("hint")}</p>
      <button type="button" onClick={toggle} aria-pressed={isFull} className="mm-btn mm-btn--primary min-h-10 px-5 text-sm">
        {isFull ? t("exit") : t("enter")}
      </button>
    </div>
  );
}
