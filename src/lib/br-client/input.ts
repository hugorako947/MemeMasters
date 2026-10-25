/**
 * Commandes du joueur (clavier, souris, joysticks) → commande du moteur (voir src/lib/br/commands.ts).
 * Hors du moteur : les nombres décimaux sont permis ici, car seule la commande quantifiée (direction 0 à 16,
 * angle 0 à 255, boutons) entre dans la partie et sera rejouée par le serveur.
 */
import { BTN, MOVE_DIRECTIONS, packCommand } from "@/lib/br/commands";
import { ANGLE_STEPS } from "@/lib/br/fixed";

const TURN = 2 * Math.PI;

/**
 * Direction de déplacement (0 = immobile, 1 à 16) d'un vecteur, comme le moteur : 1 = droite, 5 = bas (l'axe y
 * descend), 9 = gauche, 13 = haut. En dessous de `deadzone` (longueur du vecteur), on ne bouge pas.
 */
export function moveFromVector(dx: number, dy: number, deadzone = 0): number {
  const length = Math.hypot(dx, dy);
  if (length === 0 || length <= deadzone) return 0;
  const step = Math.round((Math.atan2(dy, dx) / TURN) * MOVE_DIRECTIONS);
  return (((step % MOVE_DIRECTIONS) + MOVE_DIRECTIONS) % MOVE_DIRECTIONS) + 1;
}

/** Direction au clavier : les touches opposées s'annulent. */
export function moveFromKeys(keys: { up: boolean; down: boolean; left: boolean; right: boolean }): number {
  return moveFromVector(Number(keys.right) - Number(keys.left), Number(keys.down) - Number(keys.up));
}

/** Angle de visée (0 à 255) d'un vecteur : 0 = droite, 64 = bas. */
export function aimFromVector(dx: number, dy: number): number {
  const step = Math.round((Math.atan2(dy, dx) / TURN) * ANGLE_STEPS);
  return ((step % ANGLE_STEPS) + ANGLE_STEPS) % ANGLE_STEPS;
}

/**
 * Commande de chaque tick. Le tir reste actif tant qu'il est maintenu ; les autres boutons sont des appuis
 * ponctuels : chacun part sur un seul tick, puis le bouton est relâché au moins un tick (le moteur ne réagit
 * qu'aux nouveaux appuis). Un appui plus bref qu'un tick n'est donc jamais perdu.
 */
export class CommandBuilder {
  move = 0;
  aim = 0;
  fire = false;
  private pending = 0;
  private sent = 0;

  press(button: number): void {
    this.pending |= button;
  }

  /** Commande du prochain tick. */
  next(): number {
    const pulses = this.pending & ~this.sent;
    this.pending &= ~pulses;
    this.sent = pulses;
    return packCommand({ move: this.move, aim: this.aim, buttons: (this.fire ? BTN.fire : 0) | pulses });
  }

  /** Tout lâcher (onglet masqué, fenêtre qui perd le focus, menu ouvert) ; la visée est gardée. */
  reset(): void {
    this.move = 0;
    this.fire = false;
    this.pending = 0;
    this.sent = 0;
  }
}
