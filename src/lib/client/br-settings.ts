/**
 * Réglages du Battle Royale (Réglages → Battle Royale), enregistrés sur l'appareil : les touches d'un ordinateur
 * n'ont pas de sens sur un téléphone. Touches modifiables (codes physiques du clavier, donc ZQSD sur AZERTY et
 * WASD sur QWERTY par défaut, ou boutons de la souris « Mouse0 » à « Mouse2 »), volume des bruitages et de la musique.
 * Les flèches, 1 et 2, la molette et Échap (menu) restent toujours actifs.
 */
import { useSyncExternalStore } from "react";

export const BR_ACTIONS = ["up", "down", "left", "right", "fire", "ability", "pickup", "reload", "weapon"] as const;
export type BrAction = (typeof BR_ACTIONS)[number];

export interface BrSettings {
  keys: Record<BrAction, string>;
  /** Volumes, de 0 à 100. */
  sfx: number;
  music: number;
}

export const DEFAULT_BR_SETTINGS: BrSettings = {
  keys: { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", fire: "Mouse0", ability: "KeyC", pickup: "Mouse2", reload: "KeyR", weapon: "Tab" },
  sfx: 70,
  music: 50,
};

/** Touches réservées (jamais attribuées à une action). */
const RESERVED = new Set(["Escape"]);

export const bindingOfMouse = (button: number) => `Mouse${button}`;

const volume = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : fallback);

/** Lecture prudente d'un réglage enregistré : tout ce qui manque ou est abîmé reprend sa valeur d'origine. */
export function parseBrSettings(raw: unknown): BrSettings {
  const src = raw && typeof raw === "object" ? (raw as Partial<Record<keyof BrSettings, unknown>>) : {};
  const keysIn = src.keys && typeof src.keys === "object" ? (src.keys as Record<string, unknown>) : {};
  const keys = { ...DEFAULT_BR_SETTINGS.keys };
  const used = new Set<string>();
  for (const action of BR_ACTIONS) {
    const v = keysIn[action];
    if (typeof v === "string" && v.length > 0 && v.length < 32 && !RESERVED.has(v) && !used.has(v)) keys[action] = v;
    used.add(keys[action]);
  }
  // Une valeur d'origine reprise peut entrer en conflit avec une touche choisie : elle prend alors la touche
  // d'origine libérée par l'autre action (sinon aucune touche, « Unbound… »).
  for (const action of BR_ACTIONS) {
    const holders = BR_ACTIONS.filter((a) => keys[a] === keys[action]);
    if (holders.length < 2) continue;
    const explicit = holders.find((a) => keysIn[a] === keys[a]);
    for (const a of holders) {
      if (a === explicit) continue;
      const freed = explicit ? DEFAULT_BR_SETTINGS.keys[explicit] : undefined;
      keys[a] = freed && !Object.values(keys).includes(freed) ? freed : `Unbound${a}`;
    }
  }
  return { keys, sfx: volume(src.sfx, DEFAULT_BR_SETTINGS.sfx), music: volume(src.music, DEFAULT_BR_SETTINGS.music) };
}

/** Donne la touche `binding` à `action` ; si une autre action l'avait, elle reçoit l'ancienne touche (échange). */
export function assignBinding(settings: BrSettings, action: BrAction, binding: string): BrSettings {
  if (RESERVED.has(binding)) return settings;
  const keys = { ...settings.keys };
  const other = BR_ACTIONS.find((a) => a !== action && keys[a] === binding);
  if (other) keys[other] = keys[action];
  keys[action] = binding;
  return { ...settings, keys };
}

// ---------------------------------------------------------------- enregistrement sur l'appareil

const STORAGE = "mm-br-settings";
const listeners = new Set<() => void>();
let cache: BrSettings | null = null;

function read(): BrSettings {
  if (cache) return cache;
  try {
    cache = parseBrSettings(JSON.parse(localStorage.getItem(STORAGE) ?? "null"));
  } catch {
    cache = DEFAULT_BR_SETTINGS;
  }
  return cache;
}

export const brSettings = {
  get: (): BrSettings => (typeof window === "undefined" ? DEFAULT_BR_SETTINGS : read()),
  set(next: BrSettings): void {
    cache = next;
    try {
      localStorage.setItem(STORAGE, JSON.stringify(next));
    } catch {
      /* stockage indisponible : le réglage vaut pour cette visite */
    }
    for (const l of listeners) l();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE) return;
      cache = null;
      listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  },
};

/** Réglages actuels (valeurs d'origine au premier affichage, pour un rendu identique côté serveur). */
export function useBrSettings(): BrSettings {
  return useSyncExternalStore(brSettings.subscribe, brSettings.get, () => DEFAULT_BR_SETTINGS);
}
