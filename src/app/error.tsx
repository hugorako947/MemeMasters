"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [retrying, setRetrying] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Log l'erreur côté client pour le débogage
    console.error("[MemeMasters] Erreur interceptée :", error);
  }, [error]);

  function handleRetry() {
    setRetrying(true);
    setTimeout(() => {
      reset();
      setRetrying(false);
    }, 200);
  }

  return (
    <main className="safe-top mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center p-6 text-center">
      {/* Carte d'erreur façon sticker Meme */}
      <div className="w-full rounded-3xl border-4 border-ink bg-surface p-6 sm:p-8 shadow-[0_8px_0_0_#1a1238] space-y-6">
        {/* Mascotte / Écusson comic */}
        <div className="mx-auto flex size-20 items-center justify-center rounded-2xl border-3 border-ink bg-candy text-white text-4xl shadow-[0_4px_0_0_#1a1238]">
          🩹
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-3xl sm:text-4xl text-ink uppercase tracking-wide">
            Oups, un petit imprévu !
          </h1>
          <p className="text-sm sm:text-base font-semibold text-ink-soft leading-relaxed">
            Pas d&apos;inquiétude : tes cartes, tes MemeMoneys et ton profil sont totalement en sécurité.
            Une étape a simplement rencontré un léger ralentissement.
          </p>
        </div>

        {/* Conseils clairs pour ne pas laisser le joueur délaissé */}
        <div className="rounded-2xl border-2 border-line bg-paper p-4 text-left text-xs sm:text-sm text-ink-soft space-y-2">
          <p className="font-bold text-ink">Que faire maintenant ?</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Clique sur <strong>« Réessayer »</strong> pour relancer l&apos;action sans attendre.</li>
            <li>Si le souci persiste, vérifie que ta connexion internet est active.</li>
            <li>Tu peux aussi revenir à l&apos;accueil ou contacter l&apos;assistance.</li>
          </ul>
        </div>

        {/* Actions utilisateur rapides */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            type="button"
            variant="primary"
            onClick={handleRetry}
            loading={retrying}
            className="w-full sm:w-auto px-6 py-3 text-base"
          >
            Réessayer l&apos;action
          </Button>

          <Link
            href="/"
            className="mm-btn mm-btn--secondary w-full sm:w-auto px-6 py-3 text-base text-center"
          >
            Retour à l&apos;accueil
          </Link>
        </div>

        {/* Diagnostic technique pliable pour le support */}
        <div className="pt-2 border-t border-line">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs font-bold text-ink-soft hover:text-ink underline"
          >
            {showDetails ? "Masquer les détails techniques" : "Afficher les détails techniques (support)"}
          </button>

          {showDetails && (
            <div className="mt-3 rounded-xl bg-ink p-3 text-left font-mono text-xs text-white/90 overflow-x-auto">
              <p className="font-bold text-sticker">Détails de l&apos;incident :</p>
              <p className="mt-1 break-words">{error.message || "Erreur indéterminée"}</p>
              {error.digest ? <p className="mt-1 text-white/60">ID (digest) : {error.digest}</p> : null}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
