"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { publicEnv } from "@/lib/env.public";
import { clientIp, consumeRateLimit, RATE_LIMITS, type RateLimitRule } from "@/lib/server/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  newPasswordSchema,
  resetRequestSchema,
  safeNextPath,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";

/** État renvoyé aux formulaires : un code d'erreur traduit côté client, ou un succès. */
export type AuthFormState =
  | { status: "idle" }
  | { status: "error"; code: string }
  | { status: "check_email"; email: string }
  | { status: "sent" }
  | { status: "done" };

async function allowed(rule: RateLimitRule): Promise<boolean> {
  try {
    return await consumeRateLimit(rule, clientIp(await headers()));
  } catch (error) {
    // En cas de panne de la base, on refuse plutôt que d'ouvrir la porte au bourrage.
    console.error("[auth] limitation de débit indisponible", error);
    return false;
  }
}

/** Traduit les codes d'erreur Supabase Auth en codes de l'application. */
function authErrorCode(error: { code?: string; message?: string }): string {
  switch (error.code) {
    case "invalid_credentials":
      return "invalid_credentials";
    case "email_not_confirmed":
      return "email_not_confirmed";
    case "user_already_exists":
    case "email_exists":
      return "email_taken";
    case "weak_password":
      return "weak_password";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "rate_limited";
    default:
      return "server_error";
  }
}

export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { status: "error", code: "invalid_credentials" };
  if (!(await allowed(RATE_LIMITS.signIn))) return { status: "error", code: "rate_limited" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { status: "error", code: authErrorCode(error) };
  redirect(safeNextPath(formData.get("suivant")));
}

export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) {
    const onPassword = parsed.error.issues.some((i) => i.path[0] === "password");
    return { status: "error", code: onPassword ? "weak_password" : "invalid_input" };
  }
  if (!(await allowed(RATE_LIMITS.signUp))) return { status: "error", code: "rate_limited" };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${publicEnv.siteUrl}/auth/confirm?suivant=/bienvenue` },
  });
  if (error) return { status: "error", code: authErrorCode(error) };
  // Confirmation d'e-mail désactivée (rare) : la session existe déjà.
  if (data.session) redirect("/bienvenue");
  return { status: "check_email", email: parsed.data.email };
}

export async function forgotPasswordAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { status: "error", code: "invalid_input" };
  if (!(await allowed(RATE_LIMITS.passwordReset))) return { status: "error", code: "rate_limited" };

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.siteUrl}/auth/confirm?suivant=/nouveau-mot-de-passe`,
  });
  // Même réponse que l'adresse existe ou non : on ne révèle pas qui a un compte.
  return { status: "sent" };
}

export async function newPasswordAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = newPasswordSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) {
    const mismatch = parsed.error.issues.some((i) => i.path[0] === "confirm");
    return { status: "error", code: mismatch ? "password_mismatch" : "weak_password" };
  }
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { status: "error", code: "unauthenticated" };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: "error", code: authErrorCode(error) };
  return { status: "done" };
}
