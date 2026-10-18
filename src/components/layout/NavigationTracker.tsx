"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { NAV_STACK_KEY, updateStack } from "@/lib/navigation/back";
import { LoadingScreen } from "./LoadingScreen";

/**
 * Gestionnaire de transition & réactivité :
 * 1. Mémorise la pile d'historique pour les boutons retour
 * 2. Détecte immédiatement les clics sur les liens et boutons de navigation
 * 3. Affiche une barre d'état haute ultra-rapide (<10ms)
 * 4. Déclenche l'écran géant d'attente si la page ou l'action tarde (> 280ms)
 * 5. Donne au joueur une impression de fluidité et de rapidité constante.
 */
export function NavigationTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navigating, setNavigating] = useState(false);
  const [showGiantLoader, setShowGiantLoader] = useState(false);
  const [progress, setProgress] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Mémorise la pile d'historique et masque tout écran de chargement actif à la fin de la navigation
  useEffect(() => {
    try {
      const stack = JSON.parse(sessionStorage.getItem(NAV_STACK_KEY) ?? "[]") as string[];
      sessionStorage.setItem(NAV_STACK_KEY, JSON.stringify(updateStack(Array.isArray(stack) ? stack : [], pathname)));
    } catch {
      // Stockage indisponible (mode privé strict)
    }

    // Fin de navigation : termine la barre de chargement
    if (navigating) {
      const finishTimer = setTimeout(() => {
        setProgress(100);
        const resetTimer = setTimeout(() => {
          setNavigating(false);
          setShowGiantLoader(false);
          setProgress(0);
        }, 150);
        return () => clearTimeout(resetTimer);
      }, 0);
      return () => clearTimeout(finishTimer);
    }
  }, [pathname, searchParams, navigating]);

  // Interception des clics sur les liens de navigation
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      // Ignore les clics modifiés (Ctrl, Cmd, etc.) ou clics droits
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }

      // Remonte vers le lien le plus proche
      let target = e.target as HTMLElement | null;
      while (target && target.tagName !== "A") {
        target = target.parentElement;
      }

      if (!target || target.tagName !== "A") return;
      const anchor = target as HTMLAnchorElement;
      const href = anchor.getAttribute("href");

      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }

      // Si le lien pointe vers une autre page interne
      try {
        const url = new URL(anchor.href, window.location.href);
        if (url.origin === window.location.origin && (url.pathname !== window.location.pathname || url.search !== window.location.search)) {
          startLoading();
        }
      } catch {
        // URL non parsable
      }
    }

    function startLoading() {
      setNavigating(true);
      setProgress(25);

      // Fait monter la barre progressivement
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 88) return 88;
          return prev + Math.floor(Math.random() * 10) + 5;
        });
      }, 100);

      // Si le chargement prend plus de 280ms, affiche l'écran d'attente géant
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setShowGiantLoader(true);
      }, 280);
    }

    // Écouteur global sur le document
    document.addEventListener("click", handleClick, { capture: true });

    // Permet aussi de déclencher manuellement via un événement personnalisé
    function handleCustomLoading(e: Event) {
      const detail = (e as CustomEvent<{ showGiant?: boolean }>).detail;
      startLoading();
      if (detail?.showGiant) {
        setShowGiantLoader(true);
      }
    }
    window.addEventListener("mm:start-loading", handleCustomLoading);

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("mm:start-loading", handleCustomLoading);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  return (
    <>
      {/* Barre de progression néon ultra-rapide tout en haut de l'écran */}
      {navigating && (
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          className="fixed top-0 left-0 right-0 z-[9999] h-1.5 pointer-events-none overflow-hidden bg-ink/10"
        >
          <div
            className="h-full bg-gradient-to-r from-candy via-sticker to-candy shadow-[0_0_12px_var(--color-candy,#ff3d7f)] transition-all duration-150 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Écran géant d'attente si l'action ou la page prend plus de temps */}
      {showGiantLoader && (
        <LoadingScreen message="Navigation en cours…" fullscreen />
      )}
    </>
  );
}
