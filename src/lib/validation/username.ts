/**
 * Règles des pseudos : 3 à 20 caractères, lettres sans accent, chiffres et
 * « _ ». Unicité insensible à la casse (colonne citext en base).
 */
import { z } from "zod";

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

/** Noms réservés à l'équipe ou trompeurs. */
const RESERVED = [
  "admin", "administrateur", "administrator", "moderateur", "moderator", "modo", "staff",
  "support", "system", "systeme", "officiel", "official", "root", "bot", "mememasters",
  "anthropic", "claude", "null", "undefined",
];

/**
 * Fragments interdits (liste volontairement courte et à compléter).
 * Comparés après normalisation (minuscules, chiffres-lettres remplacés).
 */
const BANNED_FRAGMENTS = ["nazi", "hitler", "pedo", "connard", "salope", "encule", "nigg", "fuck", "putain", "pute"];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s" };

export function normalizeForModeration(name: string): string {
  return name
    .toLowerCase()
    .split("")
    .map((c) => LEET[c] ?? c)
    .join("")
    .replace(/_/g, "");
}

export type UsernameProblem = "length" | "characters" | "reserved" | "inappropriate";

export function usernameProblem(raw: string): UsernameProblem | null {
  const name = raw.trim();
  if (name.length < USERNAME_MIN || name.length > USERNAME_MAX) return "length";
  if (!/^[A-Za-z0-9_]+$/.test(name)) return "characters";
  const norm = normalizeForModeration(name);
  if (RESERVED.some((r) => norm === r || norm.startsWith(r))) return "reserved";
  if (BANNED_FRAGMENTS.some((f) => norm.includes(f))) return "inappropriate";
  return null;
}

export const usernameSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    const problem = usernameProblem(value);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  });
