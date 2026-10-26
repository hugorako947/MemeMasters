"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { aimFromVector, CommandBuilder, moveFromKeys, moveFromVector } from "@/lib/br-client/input";
import { bindingOfMouse, brSettings, type BrAction } from "@/lib/client/br-settings";
import { startMusic, stopMusic } from "@/lib/client/music";
import { setSfxVolume } from "@/lib/client/sfx";
import { createAudioDirector } from "./audio-director";
import { createEventTracker } from "@/lib/br-client/events";
import { MatchClock } from "@/lib/br-client/loop";
import type { RosterEntry } from "@/lib/br-client/training";
import { damageEvents, hpTotals, hudState, newKills, pickupCandidate, visibleParticipants } from "@/lib/br-client/view";
import { BTN } from "@/lib/br/commands";
import { advance, createMatch, type MatchSetup } from "@/lib/br/engine";
import { C, type MatchState } from "@/lib/br/state";
import { EndScreen, type MatchResult } from "./EndScreen";
import { Hud, useItemName } from "./Hud";
import { createStore, type FeedEntry, type MatchSnapshot } from "./match-store";
import { MatchMenu } from "./MatchMenu";
import { drawMinimap, minimapBase } from "./minimap";
import type { MatchRenderer } from "./renderer";
import { TouchControls } from "./TouchControls";

const ME = 0;
/** Zone morte du joystick de déplacement, et seuil de tir du joystick de visée (part du rayon). */
const MOVE_DEADZONE = 0.25;
const FIRE_THRESHOLD = 0.5;
const FEED_MS = 6000;

function mediaStore(query: string) {
  return {
    subscribe(cb: () => void) {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    get: () => window.matchMedia(query).matches,
  };
}
const coarse = mediaStore("(pointer: coarse)");
const portrait = mediaStore("(orientation: portrait)");
const reduced = mediaStore("(prefers-reduced-motion: reduce)");

/**
 * Une partie jouée dans le navigateur (mode Entraînement ; la partie classée de la phase 4 réutilisera cet écran).
 * Le moteur avance à 20 ticks par seconde en suivant l'horloge réelle (pas de pause), PixiJS dessine à chaque image
 * en lissant entre deux ticks, l'interface React se met à jour dix fois par seconde.
 */
export function MatchScreen({ setup, roster, onQuit, onReplay }: { setup: MatchSetup; roster: readonly RosterEntry[]; onQuit(): void; onReplay(): void }) {
  const t = useTranslations("match");
  const tc = useTranslations("match.controls");
  const itemName = useItemName();
  const host = useRef<HTMLDivElement>(null);
  const minimap = useRef<HTMLCanvasElement>(null);
  const bigMap = useRef<HTMLCanvasElement>(null);
  /** Emplacement d'arme demandé (touches 1, 2, 3) : on change d'arme tick après tick jusqu'à l'atteindre ; −1 : aucun. */
  const wantSlot = useRef(-1);
  const builder = useRef(new CommandBuilder());
  const match = useRef<MatchState | null>(null);
  const store = useMemo(() => createStore<MatchSnapshot | null>(null), []);
  const [phase, setPhase] = useState<"loading" | "playing" | "ended">("loading");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [menu, setMenu] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const mapShown = useRef(false);
  useEffect(() => {
    mapShown.current = mapOpen;
  }, [mapOpen]);
  const menuOpen = useRef(false);
  const isCoarse = useSyncExternalStore(coarse.subscribe, coarse.get, () => false);
  const isPortrait = useSyncExternalStore(portrait.subscribe, portrait.get, () => false);
  const reducedMotion = useSyncExternalStore(reduced.subscribe, reduced.get, () => false);
  const snapshot = useSyncExternalStore(store.subscribe, store.get, store.get);
  // Le joueur a touché l'écran (même sur un ordinateur tactile) : commandes tactiles.
  const [touched, setTouched] = useState(false);
  const touch = isCoarse || touched;
  const botLabel = t("bot");

  const openMenu = useCallback((open: boolean) => {
    menuOpen.current = open;
    builder.current.reset();
    setMenu(open);
  }, []);

  // ---- Boucle de la partie.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelled = false;
    let raf = 0;
    let renderer: MatchRenderer | null = null;
    const s = createMatch(setup);
    match.current = s;
    const prevX = Int32Array.from(s.p.x);
    const prevY = Int32Array.from(s.p.y);
    const visible = new Uint8Array(s.n);
    const commands = new Uint32Array(s.n);
    const clock = new MatchClock(1000 / s.rules.tickRate, 200);
    let base = minimapBase(s.map);
    let cratesBroken = s.counters[C.cratesBroken];
    const events = createEventTracker(s);
    const b = builder.current;
    let feed: FeedEntry[] = [];
    let logSeen = 0;
    let lastUi = 0;
    let ended = false;
    const settings = brSettings.get();
    setSfxVolume(settings.sfx);
    const sounds = createAudioDirector(s, ME);
    // Une partie en cours : aucune invite de mise à jour ne doit la couper (voir PwaProvider).
    document.documentElement.dataset.mmMatch = "1";

    function finish() {
      ended = true;
      const P = s.p;
      const won = P.alive[ME] === 1;
      setResult({
        place: won ? 1 : P.place[ME],
        total: s.n,
        kills: P.kills[ME],
        damage: P.damage[ME],
        seconds: (won ? s.tick : P.deathTick[ME]) / s.rules.tickRate,
        killedBy: P.killedBy[ME],
      });
      setPhase("ended");
    }

    function frame(now: number) {
      if (cancelled || !renderer) return;
      const { ticks, alpha } = clock.due(now);
      for (let k = 0; k < ticks && !ended; k++) {
        prevX.set(s.p.x);
        prevY.set(s.p.y);
        const before = hpTotals(s);
        if (wantSlot.current >= 0) {
          if (s.p.active[ME] === wantSlot.current) wantSlot.current = -1;
          else b.press(BTN.nextWeapon);
        }
        commands[ME] = s.p.alive[ME] ? b.next() : 0;
        advance(s, commands);
        visibleParticipants(s, ME, visible);
        // Pendant un rattrapage, seuls les derniers ticks font apparaître des chiffres et du son.
        const loud = ticks - k <= 3;
        const damage = damageEvents(before, s, ME, visible);
        if (loud) renderer.addDamage(damage, s);
        const kills = s.logCount > logSeen ? newKills(s, logSeen) : [];
        for (const e of kills) feed.push({ id: e.tick * 1000 + e.victim, killer: e.killer, victim: e.victim, cause: e.cause, at: now });
        logSeen = s.logCount;
        const happened = events.after(s);
        renderer.addEffects(s, happened, kills, visible, loud);
        sounds.afterTick(s, damage, kills, happened, loud);
        if (!s.p.alive[ME] || s.finished) finish();
      }
      visibleParticipants(s, ME, visible);
      renderer.draw(s, prevX, prevY, alpha, visible);
      if (now - lastUi >= 100 || ended) {
        lastUi = now;
        feed = feed.filter((e) => now - e.at < FEED_MS).slice(-5);
        store.set({ hud: hudState(s, ME), pickup: s.p.alive[ME] ? pickupCandidate(s, ME) : null, feed });
        // Une caisse brisée disparaît aussi de la mini-carte.
        if (s.counters[C.cratesBroken] !== cratesBroken) {
          cratesBroken = s.counters[C.cratesBroken];
          base = minimapBase(s.map);
        }
        if (minimap.current) drawMinimap(minimap.current, base, s, ME);
        if (bigMap.current) drawMinimap(bigMap.current, base, s, ME);
      }
      if (!ended) raf = requestAnimationFrame(frame);
    }

    void (async () => {
      const { createRenderer } = await import("./renderer");
      if (cancelled) return;
      const r = await createRenderer(el, s, roster, ME, { bot: botLabel }, reducedMotion);
      if (cancelled) {
        r.destroy();
        return;
      }
      renderer = r;
      if (process.env.NODE_ENV !== "production") (window as unknown as { __mmMatch?: unknown }).__mmMatch = { state: s, renderer: r };
      clock.start(performance.now());
      startMusic(settings.music);
      setPhase("playing");
      raf = requestAnimationFrame(frame);
    })();

    // L'onglet passe en arrière-plan : on lâche tout ; au retour, la partie rattrape le temps écoulé.
    const onHidden = () => {
      if (document.hidden) b.reset();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("blur", onHidden);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      renderer?.destroy();
      stopMusic();
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("blur", onHidden);
      delete document.documentElement.dataset.mmMatch;
    };
    // La partie est créée une fois par écran (un nouvel écran par partie, voir la clé dans TrainingPanel).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Clavier et souris.
  useEffect(() => {
    if (phase !== "playing") return;
    const b = builder.current;
    const keys = { up: false, down: false, left: false, right: false };
    const pointer = { x: 0, y: 0, active: false };
    const el = host.current;
    // Touches choisies dans les Réglages (Battle Royale) ; les flèches déplacent toujours.
    const bound = new Map<string, BrAction>(Object.entries(brSettings.get().keys).map(([action, binding]) => [binding, action as BrAction]));
    const ARROWS: Record<string, keyof typeof keys> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
    const PULSE: Partial<Record<BrAction, number>> = { ability: BTN.ability, reload: BTN.reload, weapon: BTN.nextWeapon, pickup: BTN.pickup };

    /** Une action pressée (down) ou relâchée : déplacement et tir maintenus, les autres sur l'appui. */
    const act = (action: BrAction | undefined, down: boolean, repeat = false): boolean => {
      if (!action) return false;
      if (action === "up" || action === "down" || action === "left" || action === "right") {
        keys[action] = down;
        b.move = moveFromKeys(keys);
      } else if (action === "fire") b.fire = down;
      else if (down && !repeat) b.press(PULSE[action] ?? 0);
      return true;
    };

    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (e.code === "Escape" && down) {
        if (mapShown.current) setMapOpen(false);
        else openMenu(!menuOpen.current);
        e.preventDefault();
        return;
      }
      if (menuOpen.current) return;
      if (act(bound.get(e.code) ?? ARROWS[e.code], down, e.repeat)) {
        e.preventDefault();
        return;
      }
      if (!down || e.repeat) return;
      const slot = { Digit1: 0, Digit2: 1, Digit3: 2 }[e.code];
      if (slot !== undefined) {
        // L'arme voulue (1 : arme de départ, 2 : arme ramassée, 3 : couteau) : les armes défilent jusqu'à elle.
        const st = match.current;
        if (st && (slot !== 1 || st.p.weapon1[ME] >= 0) && st.p.active[ME] !== slot) wantSlot.current = slot;
      } else return;
      e.preventDefault();
    };
    const keyDown = (e: KeyboardEvent) => onKey(e, true);
    const keyUp = (e: KeyboardEvent) => onKey(e, false);

    const aimFromPointer = () => {
      if (!el || !pointer.active) return;
      const rect = el.getBoundingClientRect();
      b.aim = aimFromVector(pointer.x - rect.left - rect.width / 2, pointer.y - rect.top - rect.height / 2);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
      aimFromPointer();
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || menuOpen.current) return;
      onMove(e);
      act(bound.get(bindingOfMouse(e.button)), true);
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType === "mouse") act(bound.get(bindingOfMouse(e.button)), false);
    };
    let lastWheel = 0;
    const onWheel = (e: WheelEvent) => {
      if (menuOpen.current || e.timeStamp - lastWheel < 200) return;
      lastWheel = e.timeStamp;
      b.press(BTN.nextWeapon);
    };
    const noMenu = (e: Event) => e.preventDefault();

    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    el?.addEventListener("pointermove", onMove);
    el?.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    el?.addEventListener("wheel", onWheel, { passive: true });
    el?.addEventListener("contextmenu", noMenu);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      el?.removeEventListener("pointermove", onMove);
      el?.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      el?.removeEventListener("wheel", onWheel);
      el?.removeEventListener("contextmenu", noMenu);
    };
  }, [phase, openMenu]);

  const hud = snapshot?.hud;
  const pickup = snapshot?.pickup ?? null;

  return (
    <div
      className="fixed inset-0 z-[60] touch-none overflow-hidden overscroll-none bg-[var(--mm-night)] text-ink select-none"
      onPointerDown={(e) => {
        if (e.pointerType === "touch" && !touched) setTouched(true);
      }}
    >
      <div ref={host} className="absolute inset-0" />

      {phase === "loading" ? (
        <div className="absolute inset-0 grid place-items-center">
          <p className="rounded-2xl border-2 border-ink bg-surface px-5 py-3 font-display text-2xl" role="status">
            {t("loading")}
          </p>
        </div>
      ) : null}

      {phase !== "loading" ? <Hud store={store} roster={roster} me={ME} touch={touch} /> : null}

      {/* En haut à droite : mini-carte et menu. */}
      <div className={`absolute right-3 top-3 grid justify-items-end gap-2 ${phase === "loading" ? "invisible" : ""}`}>
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => openMenu(true)}
            className="mm-btn mm-btn--secondary min-h-11 min-w-11 px-3 text-sm"
            aria-haspopup="dialog"
            aria-label={tc("menu")}
          >
            ☰
          </button>
          <button type="button" onClick={() => setMapOpen(true)} className="block rounded-xl" aria-label={t("map.open")} aria-haspopup="dialog">
            <canvas ref={minimap} width={240} height={240} className="block size-[7.5rem] rounded-xl border-2 border-ink sm:size-[9.5rem]" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Carte agrandie : un clic (ou Échap) la referme ; la partie continue. */}
      {mapOpen && phase === "playing" ? (
        <div className="absolute inset-0 z-30 grid place-items-center bg-ink/60 p-4" role="dialog" aria-modal="true" aria-label={t("map.title")} onClick={() => setMapOpen(false)}>
          <div className="grid justify-items-center gap-2">
            <canvas ref={bigMap} width={720} height={720} className="block size-[min(80vh,80vw)] rounded-2xl border-2 border-ink shadow-[3px_3px_0_var(--color-ink)]" aria-hidden="true" />
            <button type="button" className="mm-btn mm-btn--secondary min-h-11 px-4 text-sm" onClick={() => setMapOpen(false)}>
              {t("map.close")}
            </button>
          </div>
        </div>
      ) : null}

      {phase === "playing" && touch && hud?.alive ? (
        <TouchControls
          onMove={(dx, dy) => {
            if (!menuOpen.current) builder.current.move = moveFromVector(dx, dy, MOVE_DEADZONE);
          }}
          onAim={(dx, dy) => {
            const b = builder.current;
            if (menuOpen.current) return;
            const length = Math.hypot(dx, dy);
            if (length > 0.15) b.aim = aimFromVector(dx, dy);
            b.fire = length >= FIRE_THRESHOLD;
          }}
          onAbility={() => builder.current.press(BTN.ability)}
          onWeapon={() => builder.current.press(BTN.nextWeapon)}
          onReload={() => builder.current.press(BTN.reload)}
          onPickup={() => builder.current.press(BTN.pickup)}
          pickupLabel={pickup ? t("hud.pickup", { item: itemName(pickup.kind, pickup.sub) }) : null}
          abilityReady={hud.abilityReady}
          abilityCooldown={hud.abilityCooldown}
        />
      ) : null}

      {menu && phase === "playing" ? <MatchMenu onResume={() => openMenu(false)} onQuit={onQuit} /> : null}
      {phase === "ended" && result ? <EndScreen result={result} roster={roster} onReplay={onReplay} onClose={onQuit} /> : null}

      {touch && isPortrait ? (
        <div className="absolute inset-0 z-40 grid place-items-center bg-ink/85 p-6 text-center font-display text-2xl text-paper" role="alert">
          {t("rotate")}
        </div>
      ) : null}
    </div>
  );
}
