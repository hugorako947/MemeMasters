"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

export function showToast(type: ToastType, title: string, message?: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("mm:toast", {
        detail: { type, title, message },
      })
    );
  }
}

export const toast = {
  success: (title: string, message?: string) => showToast("success", title, message),
  error: (title: string, message?: string) => showToast("error", title, message),
  info: (title: string, message?: string) => showToast("info", title, message),
};

/**
 * Système de confirmation et de notifications MemeMasters :
 * - Affiche des confirmations immédiates lors d'actions réussies
 * - Explique clairement les problèmes survenus pour guider le joueur
 * - Écoute automatiquement les paramètres d'URL (?ok=... et ?erreur=...)
 */
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const searchParams = useSearchParams();

  const addToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev.slice(-3), { id, type, title, message }]);

    // Auto-suppression après 4.5 secondes
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const cleanUrlParam = useCallback((key: string) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete(key);
    window.history.replaceState({}, "", url.toString());
  }, []);

  // Détection des retours serveur par URL (?ok=... ou ?erreur=...)
  useEffect(() => {
    const ok = searchParams.get("ok");
    const err = searchParams.get("erreur");

    if (ok) {
      const decoded = decodeURIComponent(ok);
      const timer = setTimeout(() => {
        addToast("success", "Action réussie !", decoded);
        cleanUrlParam("ok");
      }, 0);
      return () => clearTimeout(timer);
    }

    if (err) {
      const decoded = decodeURIComponent(err);
      const timer = setTimeout(() => {
        addToast("error", "Une précision est requise", decoded);
        cleanUrlParam("erreur");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [searchParams, addToast, cleanUrlParam]);

  // Écouteur d'événements personnalisés
  useEffect(() => {
    function handleEvent(e: Event) {
      const { type, title, message } = (e as CustomEvent<Omit<ToastItem, "id">>).detail;
      addToast(type, title, message);
    }

    window.addEventListener("mm:toast", handleEvent);
    return () => window.removeEventListener("mm:toast", handleEvent);
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed top-4 inset-x-0 z-[100] flex flex-col items-center gap-2.5 px-4"
    >
      {toasts.map((t) => {
        const isSuccess = t.type === "success";
        const isError = t.type === "error";

        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border-3 border-ink p-4 shadow-[0_5px_0_0_#1a1238] transition-all animate-in slide-in-from-top-4 duration-200 ${
              isSuccess
                ? "bg-surface text-ink"
                : isError
                  ? "bg-paper text-ink border-danger shadow-[0_5px_0_0_#c8102e]"
                  : "bg-surface text-ink"
            }`}
          >
            {/* Icône sticker de statut */}
            <div
              className={`flex size-9 shrink-0 items-center justify-center rounded-xl border-2 border-ink font-bold text-lg ${
                isSuccess
                  ? "bg-sticker text-ink"
                  : isError
                    ? "bg-danger text-white border-danger"
                    : "bg-link text-white"
              }`}
            >
              {isSuccess ? "✓" : isError ? "!" : "ℹ"}
            </div>

            {/* Contenu du message */}
            <div className="flex-1 space-y-0.5 pt-0.5">
              <p className="font-bold text-sm tracking-wide text-ink">
                {t.title}
              </p>
              {t.message ? (
                <p className="text-xs text-ink-soft leading-relaxed">
                  {t.message}
                </p>
              ) : null}
            </div>

            {/* Bouton fermeture */}
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="text-ink-soft hover:text-ink -mr-1 -mt-1 p-1 text-sm font-bold"
              aria-label="Fermer la notification"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
