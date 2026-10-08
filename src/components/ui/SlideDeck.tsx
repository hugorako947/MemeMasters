"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

export interface Slide {
  key: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

/**
 * Pages glissantes côte à côte, avec onglets en haut.
 * - en touchant ou cliquant un onglet du bandeau ;
 * - au doigt : glisser à gauche / à droite ;
 * - au clavier : flèches gauche / droite sur les onglets.
 * La hauteur suit la page affichée. L'onglet actif est reflété dans l'adresse
 * (?vue=…) pour pouvoir partager ou recharger sans perdre sa place.
 */
export function SlideDeck({ slides, initial, param = "vue" }: { slides: Slide[]; initial: number; param?: string }) {
  // Note : min-w-0 empêche la grille parente de s'élargir à la largeur des 3 pages.
  const t = useTranslations("slides");
  const [index, setIndex] = useState(initial);
  const [height, setHeight] = useState<number | null>(null);
  const refs = useRef<Array<HTMLDivElement | null>>([]);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const start = useRef<{ x: number; y: number } | null>(null);
  const baseId = useId();

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(slides.length - 1, next));
      setIndex(clamped);
      const url = new URL(window.location.href);
      url.searchParams.set(param, slides[clamped].key);
      window.history.replaceState(window.history.state, "", url);
    },
    [param, slides],
  );

  // La hauteur du cadre suit la page affichée (pas de grand vide sous une page courte).
  useLayoutEffect(() => {
    const el = refs.current[index];
    if (!el) return;
    const update = () => setHeight(el.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [index]);

  useEffect(() => {
    refs.current.forEach((el, i) => {
      if (el) el.inert = i !== index;
    });
  }, [index]);

  const rtl = () => document.documentElement.dir === "rtl";

  function onPointerDown(e: PointerEvent) {
    start.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerUp(e: PointerEvent) {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const forward = rtl() ? dx > 0 : dx < 0;
    go(index + (forward ? 1 : -1));
  }
  function onTabKey(e: KeyboardEvent) {
    const forwardKey = rtl() ? "ArrowLeft" : "ArrowRight";
    const backKey = rtl() ? "ArrowRight" : "ArrowLeft";
    if (e.key !== forwardKey && e.key !== backKey) return;
    e.preventDefault();
    const next = Math.max(0, Math.min(slides.length - 1, index + (e.key === forwardKey ? 1 : -1)));
    go(next);
    tabs.current[next]?.focus();
  }

  return (
    <div className="grid min-w-0 gap-4">
      <div role="tablist" aria-label={t("label")} onKeyDown={onTabKey} className="mx-auto flex w-full max-w-lg rounded-full border-2 border-ink bg-surface p-1 shadow-[0_3px_0_0_var(--mm-shadow)]">
        {slides.map((slide, i) => (
          <button
            key={slide.key}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            id={`${baseId}-tab-${i}`}
            role="tab"
            type="button"
            aria-selected={i === index}
            aria-controls={`${baseId}-panel-${i}`}
            tabIndex={i === index ? 0 : -1}
            onClick={() => go(i)}
            className={`flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-1.5 text-xs font-extrabold transition-colors sm:px-2 sm:text-sm ${
              i === index ? "bg-candy text-[var(--mm-accent-ink)]" : "text-ink-soft hover:text-ink"
            }`}
          >
            {slide.icon}
            {slide.label}
          </button>
        ))}
      </div>

      <div className="relative min-w-0">
        <div
          className="mm-slides w-full overflow-hidden"
          style={{ height: height ?? undefined }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (start.current = null)}
        >
          <div className="mm-slides__track flex items-start" style={{ ["--i" as string]: index }}>
            {slides.map((slide, i) => (
              <div
                key={slide.key}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                id={`${baseId}-panel-${i}`}
                role="tabpanel"
                aria-labelledby={`${baseId}-tab-${i}`}
                aria-hidden={i !== index}
                className="w-full shrink-0 px-1 pb-2"
              >
                {slide.content}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
