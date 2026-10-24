"use client";

import Link from "next/link";
import { useEffect } from "react";
import { reloadIfStaleBuild } from "@/lib/client/stale-build";
import "./globals.css";

/**
 * Dernier recours : même la structure du site n'a pas pu s'afficher. Pas de
 * traductions disponibles ici, le message est donc en français et en anglais.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  // Ancienne version du jeu restée ouverte après une mise en ligne : on recharge.
  useEffect(() => {
    reloadIfStaleBuild(error);
  }, [error]);

  return (
    <html lang="fr">
      <body className="min-h-dvh antialiased">
        <main className="mx-auto grid min-h-dvh max-w-lg content-center gap-5 px-6 text-center">
          <p className="meme-caption text-6xl" aria-hidden="true">
            💥
          </p>
          <h1 className="font-display text-4xl leading-none">Oups, le jeu a planté</h1>
          <p className="text-ink-soft">
            Un problème inattendu empêche le jeu de s&apos;afficher. Ta collection et ta progression ne sont pas perdues : elles sont enregistrées sur nos serveurs.
            Réessaie dans un instant ; si cela continue, recharge la page ou reviens un peu plus tard.
          </p>
          <p className="text-sm text-ink-soft" lang="en">
            Something went wrong while loading the game. Your progress is safe. Please try again in a moment.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" className="mm-btn mm-btn--primary px-6" onClick={() => retry()}>
              Réessayer · Try again
            </button>
            <Link href="/" className="mm-btn mm-btn--secondary px-6">
              Accueil · Home
            </Link>
          </div>
          {error.digest ? (
            <p className="text-xs text-ink-soft">
              Code : <code className="font-mono">{error.digest}</code>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
