/**
 * Banc d'essai des bots du battle royale (conception §7.7) : des milliers de parties bot contre bot,
 * sans affichage, réparties sur les cœurs de l'ordinateur, puis un rapport et le verdict des seuils.
 *
 * Usage : npm run bots:tournament [-- --rapide] [-- --echelle 0.5] [-- --coeurs 4]
 *   --rapide     10 % des parties (développement) ; taux par carte et rapports seulement indicatifs.
 *   --echelle X  multiplie le nombre de parties (1 par défaut : 1 600 normales, 1 000 rareté, 1 000 évolution).
 *   --coeurs N   nombre de calculs en parallèle (par défaut : cœurs disponibles − 1).
 *
 * Code de sortie 1 si un seuil bloquant n'est pas tenu (ou si une partie rejouée diffère).
 */
import { availableParallelism } from "node:os";
import { performance } from "node:perf_hooks";
import { isMainThread, parentPort, Worker } from "node:worker_threads";
import { GAME_CONFIG } from "../src/config/game.config";
import { STARTER_SET } from "../src/content/cards/starter-set";
import { analyse, THRESHOLDS, type Analysis } from "../src/lib/br-tournament/analysis";
import { gameSetup, playGame, type GameReport, type Series } from "../src/lib/br-tournament/game";
import { advance, createMatch, ENGINE_VERSION } from "../src/lib/br/engine";
import { replayMatch } from "../src/lib/br/replay";
import { stateHash } from "../src/lib/br/state";

type Job = { series: Series; index: number };

function option(name: string): string | undefined {
  const k = process.argv.indexOf(name);
  return k >= 0 ? process.argv[k + 1] : undefined;
}

async function main() {
  const quick = process.argv.includes("--rapide");
  const scale = Number(option("--echelle") ?? 1) * (quick ? 0.1 : 1);
  const cores = Math.max(1, Number(option("--coeurs") ?? availableParallelism() - 1));
  const counts: Record<Series, number> = { standard: Math.round(1600 * scale), rarity: Math.round(1000 * scale), evolution: Math.round(1000 * scale) };
  const total = counts.standard + counts.rarity + counts.evolution;
  const br = GAME_CONFIG.BATTLE_ROYALE;
  console.log(`Banc d'essai des bots · moteur v${ENGINE_VERSION}, réglages v${br.CONFIG_VERSION} · ${br.PARTICIPANTS} participants`);
  console.log(`${total} parties (${counts.standard} normales, ${counts.rarity} rareté, ${counts.evolution} évolution) sur ${cores} cœurs${quick ? " · mode rapide" : ""}\n`);

  // 1. Coût d'un tick, mesuré sans parallélisme (3 parties), et rejeu identique.
  const timed = [0, 1, 2].map((k) => playGame("standard", 100_000 + k, () => performance.now()));
  const tickMeanMs = timed.reduce((s, r) => s + r.tickMsSum, 0) / timed.reduce((s, r) => s + r.ticksTimed, 0);
  const tickMaxMs = Math.max(...timed.map((r) => r.tickMsMax));
  const { setup } = gameSetup("standard", 100_000);
  const live = createMatch(setup);
  const none = new Uint32Array(live.n);
  while (!live.finished) advance(live, none);
  const t0 = performance.now();
  const replay = replayMatch(setup, new Map());
  const replayMs = performance.now() - t0;
  const sameReplay = replay.hash === stateHash(live);
  console.log(`Tick moyen ${tickMeanMs.toFixed(3)} ms (max ${tickMaxMs.toFixed(1)} ms) · rejeu d'une partie ${(replayMs / 1000).toFixed(2)} s · rejeu ${sameReplay ? "identique" : "DIFFÉRENT"}\n`);

  // 2. Les parties, réparties sur les cœurs (chacun prend la suivante dès qu'il a fini).
  const jobs: Job[] = (["standard", "rarity", "evolution"] as const).flatMap((series) => Array.from({ length: counts[series] }, (_, index) => ({ series, index })));
  const reports: GameReport[] = [];
  const started = performance.now();
  let next = 0;
  let lastShown = -1;
  await Promise.all(
    Array.from({ length: Math.min(cores, jobs.length) }, () => {
      const worker = new Worker(new URL(import.meta.url), { execArgv: ["--import", "tsx"] });
      return new Promise<void>((resolve, reject) => {
        const feed = () => worker.postMessage(next < jobs.length ? jobs[next++] : null);
        worker.on("message", (report: GameReport) => {
          reports.push(report);
          const shown = Math.floor((20 * reports.length) / jobs.length);
          if (shown !== lastShown) {
            lastShown = shown;
            const elapsed = (performance.now() - started) / 1000;
            process.stdout.write(`  ${reports.length}/${jobs.length} parties · ${elapsed.toFixed(0)} s\n`);
          }
          feed();
        });
        worker.on("error", reject);
        worker.on("exit", () => resolve());
        feed();
      });
    }),
  );

  const result = analyse(reports, { quick, tickMeanMs });
  print(result);
  const ok = result.ok && sameReplay;
  console.log(`\n${ok ? "✓ Tous les seuils bloquants sont tenus." : "✕ Seuil non tenu : voir les lignes marquées ✕."}`);
  process.exit(ok ? 0 : 1);
}

const fmt = (v: number, digits = 2) => (Number.isFinite(v) ? v.toFixed(digits) : "—");

function print(a: Analysis) {
  console.log(`\nParties jouées : ${a.games.standard} normales, ${a.games.rarity} rareté, ${a.games.evolution} évolution\n`);
  console.log("Seuils (conception §7.7) :");
  for (const x of a.indicators) {
    const mark = x.ok ? "✓" : x.blocking ? "✕" : "·";
    const range = x.lo !== undefined && x.hi !== undefined && Number.isFinite(x.lo) ? ` [${fmt(x.lo)} ; ${fmt(x.hi)}]` : "";
    const kind = x.blocking ? "" : " (indicatif)";
    console.log(`  ${mark} ${x.label} : ${fmt(x.value)}${range} · seuil ${x.threshold}${kind}${x.note ? ` · ${x.note}` : ""}`);
  }
  console.log("\nTaux de Top 1 par carte (série normale ; attendu : 1 %) :");
  for (const c of a.cards) {
    const card = STARTER_SET[c.card];
    const flag = c.plays >= THRESHOLDS.cardMinPlays && (100 * c.top1Rate < THRESHOLDS.cardTop1Percent[0] || 100 * c.top1Rate > THRESHOLDS.cardTop1Percent[1]) ? " ✕" : "";
    console.log(
      `  ${card.name.padEnd(36)} ${card.rarity.padEnd(13)} ${String(c.plays).padStart(6)} parties · Top 1 ${fmt(100 * c.top1Rate)} % [${fmt(100 * c.lo)} ; ${fmt(100 * c.hi)}] · place moyenne ${fmt(c.meanPlace, 1)}${flag}`,
    );
  }
  console.log("\nPar niveau d'évolution (série normale) :");
  for (const e of a.byEvolution) console.log(`  ${"★".repeat(e.evolution) || "sans"} : place moyenne ${fmt(e.meanPlace, 1)} · Top 10 ${fmt(100 * e.top10Rate, 1)} % (${e.plays} parties)`);
  console.log("\nPar niveau des bots :");
  for (const l of a.byLevel) console.log(`  niveaux ${l.band} : ${l.games} parties · durée ${fmt(l.minutes)} min · zone ${fmt(l.zonePercent, 1)} %`);
}

if (!isMainThread) {
  // Calcul en parallèle : joue les parties demandées une par une.
  parentPort!.on("message", (job: Job | null) => {
    if (!job) process.exit(0);
    parentPort!.postMessage(playGame(job.series, job.index));
  });
} else {
  await main();
}
