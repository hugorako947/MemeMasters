/**
 * Commandes d'un participant pour un tick, sur 24 bits (3 octets) :
 * - bits 0 à 4 : déplacement, 0 = immobile, 1 à 16 = 16 directions (17 à 31 réservés) ;
 * - bits 5 à 12 : visée, 256 angles ;
 * - bits 13 à 18 : boutons (tirer, capacité, soin, arme suivante, recharger, ramasser) ;
 * - bits 19 à 23 : réservés (toujours 0).
 *
 * Enregistrement : les commandes d'une partie sont codées en plages (commande sur
 * 3 octets + nombre de répétitions sur 1 octet), car un joueur garde souvent la même
 * commande plusieurs ticks, puis envoyées par tranches (400 ticks = 20 s par défaut).
 * Toute valeur hors bornes, tranche manquante ou en trop fait refuser la partie.
 */

/** Boutons. Le bit 4 (ancien bouton de soin : le soin est désormais immédiat au ramassage) est réservé, accepté et ignoré. */
export const BTN = { fire: 1, ability: 2, nextWeapon: 8, reload: 16, pickup: 32 } as const;

export const MOVE_DIRECTIONS = 16;
const MOVE_MASK = 0x1f;
const AIM_SHIFT = 5;
const BUTTON_SHIFT = 13;
const BUTTON_MASK = 0x3f;
const RESERVED_MASK = 0xf80000;
export const COMMAND_LIMIT = 0x1000000;

export interface Command {
  move: number;
  aim: number;
  buttons: number;
}

export function packCommand({ move, aim, buttons }: Command): number {
  if (!Number.isInteger(move) || move < 0 || move > MOVE_DIRECTIONS) throw new RangeError(`déplacement ${move}`);
  if (!Number.isInteger(buttons) || buttons < 0 || buttons > BUTTON_MASK) throw new RangeError(`boutons ${buttons}`);
  return move | ((aim & 255) << AIM_SHIFT) | (buttons << BUTTON_SHIFT);
}

export const unpackMove = (cmd: number) => cmd & MOVE_MASK;
export const unpackAim = (cmd: number) => (cmd >> AIM_SHIFT) & 255;
export const unpackButtons = (cmd: number) => (cmd >> BUTTON_SHIFT) & BUTTON_MASK;

export function isValidCommand(cmd: number): boolean {
  return Number.isInteger(cmd) && cmd >= 0 && cmd < COMMAND_LIMIT && (cmd & RESERVED_MASK) === 0 && (cmd & MOVE_MASK) <= MOVE_DIRECTIONS;
}

/** Code une suite de commandes (une par tick) en plages de 4 octets. */
export function encodeRuns(commands: ArrayLike<number>): Uint8Array {
  const out: number[] = [];
  let t = 0;
  while (t < commands.length) {
    const cmd = commands[t];
    let count = 1;
    while (count < 255 && t + count < commands.length && commands[t + count] === cmd) count++;
    out.push(cmd & 0xff, (cmd >> 8) & 0xff, (cmd >> 16) & 0xff, count);
    t += count;
  }
  return Uint8Array.from(out);
}

/** Décode des plages ; null si les données sont malformées ou contiennent une commande impossible. */
export function decodeRuns(bytes: Uint8Array): Uint32Array | null {
  if (bytes.length % 4 !== 0) return null;
  let total = 0;
  for (let i = 3; i < bytes.length; i += 4) {
    if (bytes[i] === 0) return null;
    total += bytes[i];
  }
  const commands = new Uint32Array(total);
  let t = 0;
  for (let i = 0; i < bytes.length; i += 4) {
    const cmd = bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16);
    if (!isValidCommand(cmd)) return null;
    commands.fill(cmd, t, t + bytes[i + 3]);
    t += bytes[i + 3];
  }
  return commands;
}

export interface CommandChunk {
  /** Numéro de la tranche (0, 1, 2…). */
  idx: number;
  /** Premier tick couvert, et tick suivant le dernier (exclu). */
  fromTick: number;
  toTick: number;
  data: Uint8Array;
}

/** Découpe une suite de commandes en tranches de `chunkTicks` ticks. */
export function chunkCommands(commands: ArrayLike<number>, chunkTicks: number): CommandChunk[] {
  const chunks: CommandChunk[] = [];
  for (let from = 0, idx = 0; from < commands.length; from += chunkTicks, idx++) {
    const to = Math.min(commands.length, from + chunkTicks);
    chunks.push({ idx, fromTick: from, toTick: to, data: encodeRuns(Array.prototype.slice.call(commands, from, to)) });
  }
  return chunks;
}

export type AssembleResult = { ok: true; commands: Uint32Array } | { ok: false; reason: "gap" | "length" | "invalid" };

/** Réassemble les tranches reçues (dans l'ordre de leur numéro), en refusant trous, chevauchements et données impossibles. */
export function assembleChunks(chunks: readonly CommandChunk[]): AssembleResult {
  const sorted = [...chunks].sort((a, b) => a.idx - b.idx);
  const parts: Uint32Array[] = [];
  let expected = 0;
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i];
    if (c.idx !== i || c.fromTick !== expected || c.toTick <= c.fromTick) return { ok: false, reason: "gap" };
    const decoded = decodeRuns(c.data);
    if (!decoded) return { ok: false, reason: "invalid" };
    if (decoded.length !== c.toTick - c.fromTick) return { ok: false, reason: "length" };
    parts.push(decoded);
    expected = c.toTick;
  }
  const commands = new Uint32Array(expected);
  let t = 0;
  for (const p of parts) {
    commands.set(p, t);
    t += p.length;
  }
  return { ok: true, commands };
}
