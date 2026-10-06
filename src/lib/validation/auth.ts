import { z } from "zod";
import { usernameSchema } from "./username";
import { isValidTimeZone } from "@/lib/time/game-day";

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 72;

/**
 * Règles du mot de passe, partagées entre la liste affichée en direct et la
 * validation serveur. Alignées avec supabase/config.toml
 * (minimum_password_length = 10, lower_upper_letters_digits_symbols).
 */
export const PASSWORD_RULES = [
  { key: "length", test: (p: string) => p.length >= PASSWORD_MIN && p.length <= PASSWORD_MAX },
  { key: "lower", test: (p: string) => /[a-z]/.test(p) },
  { key: "upper", test: (p: string) => /[A-Z]/.test(p) },
  { key: "digit", test: (p: string) => /[0-9]/.test(p) },
  { key: "symbol", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

export type PasswordRuleKey = (typeof PASSWORD_RULES)[number]["key"];

export function passwordIsStrong(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

/** Vérification légère côté client (le serveur refait la vraie validation). */
export function looksLikeEmail(value: string): boolean {
  return emailSchema.safeParse(value).success;
}

export const passwordSchema = z.string().refine(passwordIsStrong, { message: "weak_password" });

/** Case à cocher HTML : présente et cochée (« on ») ou booléen vrai en JSON. */
const checked = z.union([z.literal("on"), z.literal(true)]);

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});

export const signUpSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string(),
    adult: checked,
    terms: checked,
    timezone: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "password_mismatch" });

export const resetRequestSchema = z.object({ email: emailSchema });

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "mismatch" });

export const timeZoneSchema = z.string().refine(isValidTimeZone, { message: "timezone" });

/** Profil créé après une connexion Google : pseudo + attestations. */
export const onboardingSchema = z.object({
  username: usernameSchema,
  timezone: timeZoneSchema,
  adult: z.literal(true),
  terms: z.literal(true),
});

/** Nouvelle acceptation des conditions (après une mise à jour des textes). */
export const consentSchema = z.object({
  adult: z.literal(true),
  terms: z.literal(true),
});

/** Chemin de retour après connexion : uniquement un chemin interne (pas d'URL externe). */
export function safeNextPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.length > 200) return fallback;
  return value;
}
