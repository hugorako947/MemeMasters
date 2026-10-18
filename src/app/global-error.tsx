"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function GlobalRootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    console.error("[MemeMasters] Erreur racine :", error);
  }, [error]);

  function handleRetry() {
    setRetrying(true);
    setTimeout(() => {
      reset();
      setRetrying(false);
    }, 200);
  }

  return (
    <html lang="fr">
      <body className="min-h-dvh bg-[#f3f0ff] text-[#1a1238] font-sans flex items-center justify-center p-6">
        <main className="w-full max-w-md rounded-3xl border-4 border-[#1a1238] bg-white p-8 text-center shadow-[0_8px_0_0_#1a1238] space-y-6">
          <div className="mx-auto flex size-20 items-center justify-center rounded-2xl border-3 border-[#1a1238] bg-[#ff3d7f] text-white text-4xl shadow-[0_4px_0_0_#1a1238]">
            🩹
          </div>

          <div className="space-y-2">
            <h1 className="font-bold text-3xl uppercase tracking-wide">
              Oups, un instant !
            </h1>
            <p className="text-sm font-semibold text-[#4a4270] leading-relaxed">
              Une difficulté imprévue a ralenti l&apos;application. Tes données restent saines et sauves.
            </p>
          </div>

          <div className="rounded-2xl border-2 border-[#d9d3f5] bg-[#f3f0ff] p-4 text-left text-xs text-[#4a4270] space-y-2">
            <p className="font-bold text-[#1a1238]">Ce que tu peux faire :</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Clique sur le bouton ci-dessous pour relancer l&apos;affichage.</li>
              <li>Recharge la page dans ton navigateur si besoin.</li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleRetry}
              disabled={retrying}
              className="w-full rounded-2xl border-3 border-[#1a1238] bg-[#ffd23f] px-6 py-3 font-bold text-[#1a1238] shadow-[0_4px_0_0_#1a1238] hover:translate-y-0.5"
            >
              {retrying ? "Relance en cours…" : "Relancer l'application"}
            </button>
            <Link
              href="/"
              className="text-xs font-bold text-[#4a4270] underline hover:text-[#1a1238]"
            >
              Retour à l&apos;accueil principal
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
