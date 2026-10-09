"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { cardArtDataUri } from "@/lib/art/generate";
import { botAct, createBot, type Bot } from "@/lib/battle/bot";
import { createBattle, deploy, step, type BattleState, type Side } from "@/lib/battle/engine";
import { ARENA, COST, RULES, TICK_RATE } from "@/lib/battle/rules";
import type { Card } from "@/lib/validation/card";
import { drawArena, effectsFrom, type Effect } from "./draw";

interface Hud {
  energy: number;
  hand: string[];
  next: string;
  crowns: Record<Side, number>;
  tick: number;
  phase: BattleState["phase"];
}

const TICK_MS = 1000 / TICK_RATE;

/**
 * Bataille en temps réel contre le bot d'entraînement. Le moteur tourne dans
 * le navigateur (20 ticks par seconde) ; le canvas est redessiné à chaque image.
 */
export function BattleArena({ deck, botDeck, seed: initialSeed, playerName }: { deck: Card[]; botDeck: Card[]; seed: number; playerName: string }) {
  const t = useTranslations("battle");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<BattleState | null>(null);
  const botRef = useRef<Bot | null>(null);
  const prevRef = useRef(new Map<number, { x: number; y: number }>());
  const effectsRef = useRef<Effect[]>([]);
  const imagesRef = useRef(new Map<string, HTMLImageElement>());
  const selectedRef = useRef<number | null>(null);
  const [seed, setSeed] = useState(initialSeed);
  const [selected, setSelected] = useState<number | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [result, setResult] = useState<BattleState["result"]>(null);
  const cards = useMemo(() => new Map([...deck, ...botDeck].map((c) => [c.id, c])), [deck, botDeck]);
  // Illustration de chaque carte (data URI), calculée une fois.
  const art = useMemo(() => new Map([...cards.values()].map((c) => [c.id, cardArtDataUri({ seed: c.artSeed, vibe: c.vibe, rarity: c.rarity })])), [cards]);

  // Illustrations des cartes, préparées une fois.
  useEffect(() => {
    for (const [id, src] of art) {
      if (imagesRef.current.has(id)) continue;
      const img = new Image();
      img.src = src;
      imagesRef.current.set(id, img);
    }
  }, [art]);

  // Boucle de jeu : simulation à pas fixe, affichage à chaque image.
  useEffect(() => {
    const state = createBattle(seed, { a: deck, b: botDeck });
    stateRef.current = state;
    botRef.current = createBot("b", seed);
    effectsRef.current = [];
    let last = performance.now();
    let acc = 0;
    let lastHud = 0;
    let frame = 0;
    const loop = (now: number) => {
      acc += Math.min(250, now - last);
      last = now;
      while (acc >= TICK_MS && state.phase !== "ended") {
        prevRef.current = new Map(state.units.map((u) => [u.id, { x: u.x, y: u.y }]));
        botAct(state, botRef.current!);
        step(state);
        effectsRef.current = [...effectsRef.current.filter((e) => now - e.born < e.life), ...effectsFrom(state.events, state, now)];
        acc -= TICK_MS;
      }
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (canvas.width !== Math.round(w * dpr)) {
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawArena({ ctx, width: w, height: h, state, prev: prevRef.current, alpha: acc / TICK_MS, images: imagesRef.current, effects: effectsRef.current, now, local: "a", selected: selectedRef.current !== null });
      }
      if (now - lastHud > 100) {
        lastHud = now;
        const me = state.sides.a;
        setHud({ energy: me.energy, hand: [...me.hand], next: me.next, crowns: { a: me.crowns, b: state.sides.b.crowns }, tick: state.tick, phase: state.phase });
        if (state.phase === "ended") setResult(state.result);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [seed, deck, botDeck]);

  const flash = useCallback((text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 1200);
  }, []);

  function choose(slot: number) {
    const next = selected === slot ? null : slot;
    setSelected(next);
    selectedRef.current = next;
  }

  function place(e: PointerEvent<HTMLCanvasElement>) {
    const state = stateRef.current;
    if (!state || selected === null) {
      flash(t("selectCard"));
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * ARENA.W;
    const y = ((e.clientY - rect.top) / rect.height) * ARENA.H;
    const res = deploy(state, "a", selected, x, y);
    if (res.ok) {
      setSelected(null);
      selectedRef.current = null;
    } else if (res.reason === "energy") flash(t("notEnough"));
    else if (res.reason === "zone") flash(t("invalidZone"));
  }

  const remaining = hud ? Math.max(0, (hud.phase === "overtime" ? RULES.MATCH_TICKS + RULES.OVERTIME_TICKS : RULES.MATCH_TICKS) - hud.tick) : RULES.MATCH_TICKS;
  const clock = `${Math.floor(remaining / TICK_RATE / 60)}:${String(Math.floor(remaining / TICK_RATE) % 60).padStart(2, "0")}`;
  const energy = (hud?.energy ?? RULES.ENERGY_START) / 1000;

  return (
    <div className="mx-auto grid w-full max-w-[26rem] select-none gap-2" ref={wrapRef}>
      <div className="flex items-center justify-between gap-2 rounded-2xl border-2 border-ink bg-surface px-3 py-2 text-sm font-extrabold">
        <span className="flex items-center gap-1.5 text-[#ff3d7f]">
          🤖 {t("bot")} · {"👑".repeat(hud?.crowns.b ?? 0) || "–"}
        </span>
        <span className={`rounded-full px-3 py-0.5 font-display text-lg ${hud?.phase === "overtime" ? "bg-candy text-[var(--mm-accent-ink)]" : hud && hud.tick >= RULES.DOUBLE_ENERGY_AT ? "bg-sticker text-[#1a1238]" : "bg-paper"}`}>
          {hud?.phase === "overtime" ? `${t("overtime")} ${clock}` : clock}
        </span>
      </div>

      <div className="relative overflow-hidden rounded-2xl border-[3px] border-ink shadow-[0_4px_0_0_var(--mm-shadow)]" style={{ aspectRatio: `${ARENA.W} / ${ARENA.H}` }}>
        <canvas ref={canvasRef} className="block h-full w-full touch-none" onPointerDown={place} aria-label={t("arenaLabel")} />
        {toast ? (
          <p role="status" className="pointer-events-none absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-xl bg-[#1a1238]/85 px-3 py-2 text-center text-sm font-bold text-white">
            {toast}
          </p>
        ) : null}
        {hud && hud.tick >= RULES.DOUBLE_ENERGY_AT && hud.tick < RULES.DOUBLE_ENERGY_AT + 60 ? (
          <p className="pointer-events-none absolute inset-x-0 top-1/3 text-center font-display text-3xl text-white [text-shadow:0_2px_0_#1a1238]">{t("doubleEnergy")}</p>
        ) : null}
        {result ? (
          <div className="absolute inset-0 grid place-items-center bg-[#1a1238]/70 p-6 text-center text-white">
            <div className="grid gap-3">
              <p className="font-display text-5xl">{result.winner === "a" ? t("victory") : result.winner === "b" ? t("defeat") : t("draw")}</p>
              <p className="text-2xl">
                {"👑".repeat(result.crowns.a) || "–"} <span className="mx-2 text-base">vs</span> {"👑".repeat(result.crowns.b) || "–"}
              </p>
              <p className="text-sm opacity-90">{t("trainingNote")}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setHud(null);
                    setSeed((s) => (s * 1103515245 + 12345) & 0x7fffffff);
                  }}
                  className="mm-btn mm-btn--primary px-6"
                >
                  {t("replay")}
                </button>
                <Link href="/?vue=batailles" className="mm-btn mm-btn--secondary px-6">
                  {t("back")}
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between rounded-2xl border-2 border-ink bg-surface px-3 py-1.5 text-sm font-extrabold">
        <span className="text-[#2d6bff]">
          🙂 {playerName} · {"👑".repeat(hud?.crowns.a ?? 0) || "–"}
        </span>
        <span className="text-xs text-ink-soft">{t("trainingShort")}</span>
      </div>

      {/* Main : 4 cartes jouables + la suivante. */}
      <div className="grid grid-cols-[repeat(4,1fr)_0.7fr] gap-1.5">
        {(hud?.hand ?? []).map((id, slot) => {
          const c = cards.get(id);
          if (!c) return <span key={slot} />;
          const cost = COST[c.rarity];
          const affordable = energy >= cost;
          return (
            <button
              key={`${slot}-${id}`}
              type="button"
              onClick={() => choose(slot)}
              aria-pressed={selected === slot}
              aria-label={t("cardLabel", { name: c.name, cost })}
              className={`relative aspect-[3/4] overflow-hidden rounded-xl border-[3px] bg-white transition-transform ${
                selected === slot ? "-translate-y-2 border-candy shadow-[0_6px_0_0_var(--mm-shadow)]" : "border-ink"
              } ${affordable ? "" : "grayscale opacity-60"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- illustration générée (data URI) */}
              <img src={art.get(id)} alt="" className="h-full w-full object-cover" draggable={false} />
              <span className="absolute inset-x-0 bottom-0 truncate bg-[#1a1238]/80 px-1 text-[0.6rem] font-bold text-white">{c.name}</span>
              <span className="absolute start-1 top-1 grid size-6 place-items-center rounded-full border-2 border-[#1a1238] bg-[#c86bff] font-display text-sm text-white">{cost}</span>
            </button>
          );
        })}
        <div className="grid content-center justify-items-center gap-1 text-center">
          <span className="text-[0.6rem] font-bold text-ink-soft">{t("next")}</span>
          {hud && cards.get(hud.next) ? (
            // eslint-disable-next-line @next/next/no-img-element -- illustration générée (data URI)
            <img src={art.get(hud.next)} alt={cards.get(hud.next)!.name} className="aspect-[3/4] w-full rounded-lg border-2 border-ink object-cover opacity-80" />
          ) : null}
        </div>
      </div>

      {/* Énergie. */}
      <div className="flex items-center gap-2" aria-label={t("energyLabel", { value: Math.floor(energy) })}>
        <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-ink bg-[#c86bff] font-display text-lg text-white">{Math.floor(energy)}</span>
        <div className="grid h-5 flex-1 grid-cols-10 gap-0.5 rounded-full border-2 border-ink bg-[#2a1d55] p-0.5">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className="overflow-hidden rounded-full bg-[#4a3a7a]">
              <span className="block h-full bg-[#c86bff]" style={{ width: `${Math.max(0, Math.min(1, energy - i)) * 100}%` }} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
