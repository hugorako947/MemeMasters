"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { create } from "zustand";

type Tone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  tone: Tone;
  text: string;
  leaving: boolean;
}

interface ToastStore {
  items: ToastItem[];
  push: (tone: Tone, text: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

const useToasts = create<ToastStore>((set, get) => ({
  items: [],
  push: (tone, text) => {
    const id = nextId++;
    // Même message déjà affiché : on ne l'empile pas une seconde fois.
    if (get().items.some((t) => t.text === text && !t.leaving)) return;
    set((s) => ({ items: [...s.items.slice(-3), { id, tone, text, leaving: false }] }));
    // Une erreur reste plus longtemps : le joueur doit avoir le temps de la lire.
    timers.set(id, setTimeout(() => get().dismiss(id), tone === "error" ? 8000 : 3800));
  },
  dismiss: (id) => {
    clearTimeout(timers.get(id));
    timers.delete(id);
    set((s) => ({ items: s.items.map((t) => (t.id === id ? { ...t, leaving: true } : t)) }));
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), 200);
  },
}));

/**
 * Bulles de confirmation : « Booster ajouté ! », « Carte créée »… et
 * explications en cas d'erreur. Utilisables partout côté navigateur.
 */
export const toast = {
  success: (text: string) => useToasts.getState().push("success", text),
  error: (text: string) => useToasts.getState().push("error", text),
  info: (text: string) => useToasts.getState().push("info", text),
};

const ICON: Record<Tone, string> = { success: "✓", error: "!", info: "i" };

export function Toaster() {
  const t = useTranslations("feedback");
  const items = useToasts((s) => s.items);
  const dismiss = useToasts((s) => s.dismiss);

  // Échap ferme la dernière bulle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const last = useToasts.getState().items.at(-1);
      if (last) dismiss(last.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismiss]);

  return (
    <div className="mm-toasts" aria-live="polite" aria-relevant="additions">
      {items.map((item) => (
        <div key={item.id} className="mm-toast" data-tone={item.tone} data-leaving={item.leaving} role={item.tone === "error" ? "alert" : "status"}>
          <span className="mm-toast__icon" aria-hidden="true">
            {ICON[item.tone]}
          </span>
          <p className="min-w-0 flex-1 pt-0.5">{item.text}</p>
          <button type="button" onClick={() => dismiss(item.id)} className="-m-1 rounded-full px-2 py-1 text-lg leading-none text-ink-soft hover:text-ink" aria-label={t("close")}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
