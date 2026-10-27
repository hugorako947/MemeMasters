import { useSyncExternalStore } from "react";

/**
 * Mode « choisir son personnage » de la Collection, ouvert par le bouton « Changer » de la page Battle Royale :
 * un toucher sur une carte possédée la choisit, puis on revient à la page Battle Royale.
 */
let picking = false;
const listeners = new Set<() => void>();

export const characterPicker = {
  get: (): boolean => picking,
  set(value: boolean): void {
    picking = value;
    for (const listener of listeners) listener();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useCharacterPicker(): boolean {
  return useSyncExternalStore(characterPicker.subscribe, characterPicker.get, () => false);
}
