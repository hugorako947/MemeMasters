/**
 * Partie d'Entraînement (conception §9.7) : le joueur contre des bots « BOT » (participants − 1) portant des cartes du jeu,
 * sans récompense ni envoi au serveur, jouable hors ligne une fois la page chargée.
 */
import { GAME_CONFIG } from "@/config/game.config";
import { botLevelForTrophies } from "@/lib/br/bot";
import { battleCharacter, type EvolutionLevel } from "@/lib/br/character";
import type { MatchSetup } from "@/lib/br/engine";
import { createStreams, nextBelow } from "@/lib/br/rng";
import { resolveRules } from "@/lib/br/rules";
import type { Card } from "@/lib/validation/card";

export const DIFFICULTIES = ["easy", "normal", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** Qui joue chaque emplacement : nom affiché, carte, niveau d'évolution, bot ou non. */
export interface RosterEntry {
  name: string;
  card: Card;
  level: EvolutionLevel;
  bot: boolean;
}

export interface TrainingOptions {
  seed: number;
  player: { name: string; card: Card; level: EvolutionLevel };
  /** Cartes que les bots peuvent porter (les cartes actives du jeu). */
  cards: readonly Card[];
  /** Trophées du joueur (difficulté « Normal », comme en partie classée). */
  trophies: number;
  difficulty: Difficulty;
}

export function trainingMatch({ seed, player, cards, trophies, difficulty }: TrainingOptions): { setup: MatchSetup; roster: RosterEntry[] } {
  const br = GAME_CONFIG.BATTLE_ROYALE;
  const rules = resolveRules(br);
  const bonus = GAME_CONFIG.DUPLICATES.STAT_BONUS_PERCENT;
  // Les niveaux des bots sont en dixièmes (voir botLevelForTrophies).
  const normal = botLevelForTrophies(trophies, rules);
  const level = difficulty === "easy" ? 0 : difficulty === "normal" ? normal : Math.min(rules.bots.maxLevel, normal + 10 * br.TRAINING.HARD_BONUS_LEVELS);
  // Tirage des cartes des bots : flux à part, dérivé de la graine (même graine → mêmes adversaires).
  const rng = createStreams((seed ^ 0x7a3c_51e9) >>> 0, 1);
  const roster: RosterEntry[] = [{ name: player.name, card: player.card, level: player.level, bot: false }];
  for (let i = 1; i < rules.participants; i++) {
    const card = cards[nextBelow(rng, 0, cards.length)];
    roster.push({ name: card.name, card, level: 0, bot: true });
  }
  return {
    setup: {
      seed: seed >>> 0,
      rules,
      characters: roster.map((r) => battleCharacter(r.card, r.level, br, bonus)),
      botLevels: roster.map((r) => (r.bot ? level : null)),
    },
    roster,
  };
}
