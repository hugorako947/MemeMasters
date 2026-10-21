"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

const TIPS = 6;

/**
 * Grand écran d'attente (page entière) : trois cartes qui se distribuent et se
 * retournent, un titre qui sautille et une petite phrase qui change. N'apparaît
 * qu'après un court instant, pour ne rien faire clignoter quand la page arrive vite.
 */
export function LoadingScreen({ fullscreen = false }: { fullscreen?: boolean }) {
  const t = useTranslations("loading");
  const [tip, setTip] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTip((n) => (n + 1) % TIPS), 2200);
    return () => clearInterval(id);
  }, []);
  const title = t("title");
  return (
    <div className={`mm-loading ${fullscreen ? "mm-loading--fullscreen" : ""}`} role="status" aria-live="polite">
      <div className="mm-loading__cards" aria-hidden="true">
        <span className="mm-loading__card" />
        <span className="mm-loading__card" />
        <span className="mm-loading__card" />
      </div>
      <p className="mm-loading__title meme-caption" aria-label={title}>
        {[...title].map((ch, i) => (
          <span key={i} style={{ ["--i" as string]: i }} aria-hidden="true">
            {ch === " " ? " " : ch}
          </span>
        ))}
      </p>
      <p key={tip} className="mm-loading__tip max-w-xs font-semibold text-ink-soft">
        {t(`tips.${tip}` as "tips.0")}
      </p>
    </div>
  );
}
