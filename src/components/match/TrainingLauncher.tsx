"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { MemeCard } from "@/components/card/MemeCard";
import { buttonClass, ButtonLink } from "@/components/ui/Button";
import type { Level } from "@/lib/economy/duplicates";
import { DIFFICULTIES, trainingMatch, type Difficulty, type RosterEntry } from "@/lib/br-client/training";
import type { MatchSetup } from "@/lib/br/engine";
import type { Card } from "@/lib/validation/card";
import { ControlsHelp } from "./MatchMenu";
import { MatchScreen } from "./MatchScreen";

/** Dernier choix du joueur, gardé sur l'appareil (simple confort : la partie se lance aussi sans). */
const SAVED = "mm-training";

interface Saved {
  card?: string;
  difficulty?: Difficulty;
}

function readSaved(): Saved {
  try {
    return JSON.parse(localStorage.getItem(SAVED) ?? "{}") as Saved;
  } catch {
    return {};
  }
}

function writeSaved(value: Saved): void {
  try {
    localStorage.setItem(SAVED, JSON.stringify(value));
  } catch {
    /* stockage indisponible : rien à garder */
  }
}

/** Sur téléphone : plein écran et paysage si le navigateur le permet (Android) ; sinon le message « Tourne ton téléphone ». */
async function landscape(): Promise<void> {
  if (!window.matchMedia("(pointer: coarse)").matches) return;
  try {
    if (!document.fullscreenElement && document.fullscreenEnabled) await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await orientation.lock?.("landscape");
  } catch {
    /* refusé (iPhone, navigateur) : le message de rotation prend le relais */
  }
}

/**
 * Mode Entraînement : choix du personnage (parmi les cartes possédées) et de la difficulté, puis la partie.
 * Rien n'est envoyé au serveur : la page fonctionne hors ligne une fois chargée.
 */
export function TrainingLauncher({ player, owned, cards }: { player: { name: string; trophies: number }; owned: Array<{ card: Card; level: Level }>; cards: Card[] }) {
  const t = useTranslations("match");
  const tc = useTranslations("match.controls");
  const [cardId, setCardId] = useState<string | null>(owned[0]?.card.id ?? null);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [match, setMatch] = useState<{ seed: number; setup: MatchSetup; roster: RosterEntry[] } | null>(null);

  // Dernier choix (lu après l'affichage initial, pour un rendu identique côté serveur).
  useEffect(() => {
    const id = setTimeout(() => {
      const saved = readSaved();
      if (saved.card && owned.some((o) => o.card.id === saved.card)) setCardId(saved.card);
      if (saved.difficulty && DIFFICULTIES.includes(saved.difficulty)) setDifficulty(saved.difficulty);
    }, 0);
    return () => clearTimeout(id);
  }, [owned]);

  const chosen = owned.find((o) => o.card.id === cardId) ?? owned[0];

  function start() {
    if (!chosen) return;
    writeSaved({ card: chosen.card.id, difficulty });
    void landscape();
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const { setup, roster } = trainingMatch({ seed, player: { name: player.name, card: chosen.card, level: chosen.level }, cards, trophies: player.trophies, difficulty });
    setMatch({ seed, setup, roster });
  }

  if (match) {
    return <MatchScreen key={match.seed} setup={match.setup} roster={match.roster} onQuit={() => setMatch(null)} onReplay={start} onChange={() => setMatch(null)} />;
  }

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6 sm:py-10">
      <header className="grid gap-2">
        <span className="justify-self-start rounded-full border-2 border-ink bg-sticker px-3 py-1 text-xs font-extrabold text-ink">{t("teamOnly")}</span>
        <h1 className="font-display text-4xl leading-none sm:text-5xl">{t("title")}</h1>
        <p className="max-w-2xl text-ink-soft">{t("lead")}</p>
        <p className="max-w-2xl text-sm font-semibold">{t("botsNotice")}</p>
      </header>

      <section className="grid gap-3 rounded-[1.75rem] border-2 border-ink bg-surface p-4 shadow-[0_3px_0_0_var(--mm-shadow)] sm:p-6" aria-labelledby="mm-training-character">
        <div>
          <h2 id="mm-training-character" className="font-display text-2xl leading-none">
            {t("character")}
          </h2>
          <p className="text-sm text-ink-soft">{t("characterHint")}</p>
        </div>
        {owned.length === 0 ? (
          <p className="rounded-xl bg-paper p-4 font-semibold">{t("noCards")}</p>
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
            {owned.map(({ card, level }) => {
              const selected = chosen?.card.id === card.id;
              return (
                <li key={card.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-label={card.name}
                    onClick={() => setCardId(card.id)}
                    className={`block w-full rounded-2xl p-1 transition-transform ${selected ? "bg-candy ring-2 ring-ink" : "hover:-translate-y-0.5"}`}
                  >
                    <MemeCard card={card} size="compact" level={level} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="grid gap-3 rounded-[1.75rem] border-2 border-ink bg-surface p-4 shadow-[0_3px_0_0_var(--mm-shadow)] sm:p-6" aria-labelledby="mm-training-difficulty">
        <h2 id="mm-training-difficulty" className="font-display text-2xl leading-none">
          {t("difficulty")}
        </h2>
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-labelledby="mm-training-difficulty">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={difficulty === d}
              onClick={() => setDifficulty(d)}
              className={`grid min-h-11 gap-0.5 rounded-xl border-2 border-ink px-4 py-2 text-start ${difficulty === d ? "bg-candy text-[var(--mm-accent-ink)]" : "bg-paper"}`}
            >
              <span className="font-extrabold">{t(d)}</span>
              <span className="text-xs font-semibold opacity-80">{t(`${d}Hint`)}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={start} disabled={!chosen} className={buttonClass("primary", "min-h-12 px-8 text-lg")}>
          {t("start")}
        </button>
        <ButtonLink href="/?vue=batailles" variant="ghost" className="min-h-11 px-5">
          {t("back")}
        </ButtonLink>
      </div>

      <details className="rounded-2xl border-2 border-ink bg-surface p-4">
        <summary className="min-h-11 cursor-pointer content-center font-extrabold">{tc("title")}</summary>
        <ControlsHelp />
      </details>
    </main>
  );
}
