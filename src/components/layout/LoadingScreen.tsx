"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";

const LOADING_HINTS = [
  "Mélange des meilleurs memes du Web…",
  "Préparation de l'arène de combat…",
  "Chargement des cartes légendaires…",
  "Distribution des boosters dorés…",
  "Synchronisation ultra-rapide des trophées…",
  "Affûtage des attaques spéciales…",
  "Connexion haute vitesse au serveur…",
];

export interface LoadingScreenProps {
  message?: string;
  subMessage?: string;
  fullscreen?: boolean;
}

/**
 * Écran d'attente géant adapté à la direction artistique MemeMasters :
 * carte holographique animée, phrases de meme tournantes et jauge de progression
 * dynamique pour donner une sensation de vitesse et de vivacité au joueur.
 */
export function LoadingScreen({
  message = "Chargement en cours…",
  subMessage,
  fullscreen = true,
}: LoadingScreenProps) {
  const [hintIndex, setHintIndex] = useState(0);
  const [progress, setProgress] = useState(18);

  useEffect(() => {
    // Alterne les punchlines toutes les 2.2 secondes
    const hintInterval = setInterval(() => {
      setHintIndex((prev) => (prev + 1) % LOADING_HINTS.length);
    }, 2200);

    // Progression rapide simulée (donne un sentiment de réactivité immédiate)
    const progressInterval = setInterval(() => {
      setProgress((old) => {
        if (old >= 92) return 92;
        const jump = Math.floor(Math.random() * 12) + 4;
        return Math.min(92, old + jump);
      });
    }, 280);

    return () => {
      clearInterval(hintInterval);
      clearInterval(progressInterval);
    };
  }, []);

  const content = (
    <div className="flex flex-col items-center justify-center gap-6 p-6 text-center max-w-sm mx-auto">
      {/* Carte Meme miniature flottante et holographique */}
      <div className="relative size-32 perspective-500">
        <div className="relative size-full rounded-2xl border-4 border-ink bg-surface shadow-[0_8px_0_0_var(--color-ink,#1a1238)] animate-bounce duration-1000 overflow-hidden flex flex-col items-center justify-center">
          {/* Lueur bonbon / sticker */}
          <div className="absolute inset-0 bg-gradient-to-tr from-candy/20 via-sticker/30 to-candy/10 animate-pulse" />
          
          {/* Hologramme shimmers */}
          <div className="absolute -inset-x-12 top-0 h-full w-24 -rotate-45 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-[shimmer_1.8s_infinite]" />

          {/* Logo / Icône centrale */}
          <div className="relative z-10 flex flex-col items-center justify-center">
            <span className="font-display text-4xl text-candy drop-shadow-[0_2px_0_#1a1238]">MM</span>
            <div className="mt-1 flex items-center gap-1.5 text-xs font-black uppercase text-ink">
              <span className="size-2 rounded-full bg-sticker animate-ping" />
              <span>Attente</span>
            </div>
          </div>
        </div>

        {/* Badge spinner circulaire sous la carte */}
        <div className="absolute -bottom-3 -right-3 rounded-full border-3 border-ink bg-sticker p-2 shadow-[0_3px_0_0_#1a1238]">
          <Spinner size="sm" tone="primary" />
        </div>
      </div>

      {/* Titre et statut */}
      <div className="space-y-2">
        <h2 className="font-display text-3xl tracking-wide uppercase text-ink">
          {message}
        </h2>
        <p className="min-h-6 text-sm font-semibold text-candy transition-all duration-300">
          {subMessage ?? LOADING_HINTS[hintIndex]}
        </p>
      </div>

      {/* Barre de téléchargement et de chargement dynamique */}
      <div className="w-full space-y-1.5">
        <div className="flex justify-between text-xs font-black uppercase text-ink-soft">
          <span>Téléchargement</span>
          <span>{progress}&nbsp;%</span>
        </div>
        <div className="h-4 w-full overflow-hidden rounded-full border-2 border-ink bg-surface p-0.5 shadow-[0_2px_0_0_#1a1238]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sticker via-candy to-sticker transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div
        role="alert"
        aria-busy="true"
        aria-live="polite"
        className="fixed inset-0 z-50 flex items-center justify-center bg-paper/90 backdrop-blur-md"
      >
        {content}
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center py-12">
      {content}
    </div>
  );
}
