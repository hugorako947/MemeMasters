"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CharacterBubble } from "@/components/home/CharacterBubble";
import { buttonClass } from "@/components/ui/Button";
import { GAME_CONFIG } from "@/config/game.config";
import { RARITY_GLYPH } from "@/config/rarities";
import type { Level } from "@/lib/economy/duplicates";
import { DIFFICULTIES, trainingMatch, type Difficulty, type RosterEntry } from "@/lib/br-client/training";
import type { MatchSetup } from "@/lib/br/engine";
import type { Card } from "@/lib/validation/card";
import { characterPicker } from "@/lib/client/character-picker";
import { unlockAudio } from "@/lib/client/sfx";
import { showSlide } from "@/lib/client/slides";
import { ControlsHelp } from "./MatchMenu";

// L'écran de jeu (moteur, PixiJS) n'est chargé qu'au lancement d'une partie.
const MatchScreen = dynamic(() => import("./MatchScreen").then((m) => m.MatchScreen), { ssr: false });

/** Dernière difficulté choisie, gardée sur l'appareil (simple confort). */
const SAVED = "mm-training";

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
 * Page Battle Royale de l'Accueil : les modes de jeu, puis l'Entraînement (personnage choisi dans la Collection,
 * difficulté, commandes de jeu) et son lancement. Seule la partie s'ouvre dans un écran à part, en plein écran.
 */
export function TrainingPanel({ player, character, cards }: { player: { name: string; trophies: number }; character: { card: Card; level: Level } | null; cards: Card[] }) {
  const t = useTranslations("match");
  const tb = useTranslations("playerHome.battles");
  const tc = useTranslations("match.controls");
  const tr = useTranslations("rarity");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [match, setMatch] = useState<{ seed: number; setup: MatchSetup; roster: RosterEntry[] } | null>(null);

  // Dernière difficulté (lue après l'affichage initial, pour un rendu identique côté serveur).
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const saved = localStorage.getItem(SAVED) as Difficulty | null;
        if (saved && DIFFICULTIES.includes(saved)) setDifficulty(saved);
      } catch {
        /* stockage indisponible */
      }
    }, 0);
    return () => clearTimeout(id);
  }, []);

  function start() {
    if (!character) return;
    try {
      localStorage.setItem(SAVED, difficulty);
    } catch {
      /* stockage indisponible */
    }
    // Le son ne peut démarrer qu'après un geste du joueur : ce clic.
    unlockAudio();
    void landscape();
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const { setup, roster } = trainingMatch({ seed, player: { name: player.name, card: character.card, level: character.level }, cards, trophies: player.trophies, difficulty });
    setMatch({ seed, setup, roster });
  }

  /** « Changer » : la Collection s'ouvre en mode sélection ; un toucher sur une carte la choisit, puis retour ici. */
  function pickCharacter() {
    characterPicker.set(true);
    showSlide("collection");
  }

  const modes = [
    { key: "training", label: t("title"), soon: false },
    { key: "ranked", label: tb("modeRanked"), soon: true },
    { key: "friends", label: tb("modeFriends"), soon: true },
  ];

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={tb("modes")}>
        {modes.map((m) => (
          <button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={!m.soon}
            disabled={m.soon}
            className={`grid min-h-14 content-center justify-items-center gap-0.5 rounded-xl border-2 border-ink px-1.5 py-2 text-center text-xs font-extrabold break-words hyphens-auto sm:px-2 sm:text-sm ${m.soon ? "bg-surface text-ink-soft" : "bg-candy text-[var(--mm-accent-ink)]"}`}
          >
            <span>{m.label}</span>
            {m.soon ? <span className="rounded-full bg-paper px-2 text-[0.65rem] font-bold">{tb("soon")}</span> : null}
          </button>
        ))}
      </div>

      <section className="grid gap-4 rounded-2xl border-2 border-ink bg-surface p-4" aria-labelledby="mm-training">
        <div className="grid gap-1">
          <h3 id="mm-training" className="font-display text-3xl leading-none">
            {t("title")}
          </h3>
          <p className="text-sm text-ink-soft">{t("lead", { total: GAME_CONFIG.BATTLE_ROYALE.PARTICIPANTS, bots: GAME_CONFIG.BATTLE_ROYALE.PARTICIPANTS - 1 })}</p>
          <p className="text-sm font-semibold">{t("botsNotice")}</p>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-paper p-3">
          {character ? (
            <>
              <svg viewBox="0 0 120 84" className="w-24 shrink-0" aria-hidden="true">
                <CharacterBubble card={character.card} x={40} y={40} r={28} angle={-8} id="mm-training-character" />
              </svg>
              <div className="grid min-w-0 gap-1.5">
                <p className="text-xs font-bold text-ink-soft">{tb("character")}</p>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-extrabold">{character.card.name}</span>
                  {/* Rareté : symbole, nom et couleur (jamais la couleur seule). */}
                  <span className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-surface px-2 text-xs font-extrabold" style={{ color: `var(--color-r-${character.card.rarity})` }}>
                    <span aria-hidden="true">{RARITY_GLYPH[character.card.rarity]}</span>
                    <span className="text-ink">{tr(character.card.rarity)}</span>
                  </span>
                </p>
                <button type="button" onClick={pickCharacter} className={buttonClass("secondary", "min-h-11 justify-self-start px-5 text-sm")}>
                  {tb("changeCharacter")}
                </button>
              </div>
            </>
          ) : (
            <div className="grid gap-2">
              <p className="font-semibold">{tb("noCharacter")}</p>
              <button type="button" onClick={pickCharacter} className={buttonClass("secondary", "min-h-11 justify-self-start px-5 text-sm")}>
                {tb("goCollection")}
              </button>
            </div>
          )}
        </div>

        <div className="grid gap-2">
          <h4 id="mm-training-difficulty" className="font-extrabold">
            {t("difficulty")}
          </h4>
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
        </div>

        <details className="rounded-xl bg-paper p-3">
          <summary className="min-h-11 cursor-pointer content-center font-extrabold">{tc("title")}</summary>
          <ControlsHelp editHref="/parametres#battle-royale" />
        </details>

        <button type="button" onClick={start} disabled={!character} className={buttonClass("primary", "min-h-12 px-8 text-lg")}>
          {t("start")}
        </button>
      </section>

      {/* Dans <body> : une page glissante (transformée) enfermerait l'écran de partie, qui doit couvrir tout l'écran. */}
      {match ? createPortal(<MatchScreen key={match.seed} setup={match.setup} roster={match.roster} onQuit={() => setMatch(null)} onReplay={start} />, document.body) : null}
    </div>
  );
}
