import { z } from "zod";
import { usernameSchema } from "./username";
import { isValidTimeZone } from "@/lib/time/game-day";

export const PASSWORD_MIN = 8;

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

/** Aligné avec supabase/config.toml : 8 caractères, au moins une lettre et un chiffre. */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN)
  .max(72)
  .regex(/[A-Za-z]/)
  .regex(/[0-9]/);

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const resetRequestSchema = z.object({ email: emailSchema });

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "mismatch" });

export const timeZoneSchema = z.string().refine(isValidTimeZone, { message: "timezone" });

export const onboardingSchema = z.object({
  username: usernameSchema,
  timezone: timeZoneSchema,
});

/** Chemin de retour après connexion : uniquement un chemin interne (pas d'URL externe). */
export function safeNextPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.length > 200) return fallback;
  return value;
}
