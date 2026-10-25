/**
 * État affiché par l'interface de partie (PV, arme, zone, fil des éliminations…), recopié depuis le moteur
 * dix fois par seconde : la partie tourne à 60 images par seconde sans faire redessiner React à chaque image.
 */
import type { HudState } from "@/lib/br-client/view";

export interface FeedEntry {
  id: number;
  killer: number;
  victim: number;
  cause: number;
  /** performance.now() de l'arrivée dans le fil (les entrées s'effacent après quelques secondes). */
  at: number;
}

export interface MatchSnapshot {
  hud: HudState;
  pickup: { kind: number; sub: number } | null;
  feed: FeedEntry[];
}

export interface Store<T> {
  get(): T;
  set(value: T): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
