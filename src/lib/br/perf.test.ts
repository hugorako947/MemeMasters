import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "@/config/game.config";
import { replayMatch } from "./replay";
import { resolveRules } from "./rules";
import { botSetup, playWithDriver } from "./test-driver";

/**
 * Chronomètre en millisecondes de calcul du fil d'exécution (Node 23.9 et plus), sinon du temps écoulé.
 * Vitest fait tourner plusieurs fichiers de tests en même temps : le temps écoulé compterait aussi l'attente
 * du processeur, pas seulement le coût du moteur.
 */
const cpuMs: () => number =
  typeof process.threadCpuUsage === "function"
    ? () => {
        const { user, system } = process.threadCpuUsage();
        return (user + system) / 1000;
      }
    : () => performance.now();

describe("performances du moteur (100 participants : 1 joueur piloté, 99 bots)", () => {
  it("budget par tick tenu et rejeu d'une partie complète en quelques secondes", () => {
    const rules = resolveRules(GAME_CONFIG.BATTLE_ROYALE);
    const setup = botSetup(777, rules, 100);
    const times: number[] = [];
    const played = playWithDriver(setup, 3, { timer: cpuMs, times });
    const sorted = [...times].sort((a, b) => a - b);
    const mean = times.reduce((s, t) => s + t, 0) / times.length;
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const t0 = cpuMs();
    const replay = replayMatch(setup, played.inputs);
    const replayMs = cpuMs() - t0;
    console.log(
      `[moteur] ${played.state.tick} ticks (${(played.state.tick / rules.tickRate / 60).toFixed(1)} min de jeu) · ` +
        `tick moyen ${mean.toFixed(3)} ms · 99e centile ${p99.toFixed(3)} ms · rejeu complet ${(replayMs / 1000).toFixed(2)} s (temps de calcul)`,
    );
    expect(replay.result.places).toEqual(Array.from(played.state.p.place));
    // Seuils de la conception (§3.6) : 2 ms en moyenne, 5 ms au 99e centile, sur un ordinateur portable.
    expect(mean).toBeLessThan(2);
    expect(p99).toBeLessThan(5);
    expect(replayMs).toBeLessThan(20_000);
  }, 120_000);
});
