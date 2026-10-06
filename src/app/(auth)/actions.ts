"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { publicEnv } from "@/lib/env.public";
import { createPlayer, isUsernameTaken } from "@/lib/server/players";
import { isValidTimeZone } from "@/lib/time/game-day";
import { usernameProblem } from "@/lib/validation/username";
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

/** Code d'erreur du premier champ invalide de l'inscription. */
function signUpErrorCode(path: PropertyKey | undefined, username: string): string {
  switch (path) {
    case "username": {
      const problem = usernameProblem(username);
      return problem ? `username_${problem}` : "invalid_input";
    }
    case "email":
      return "invalid_email";
    case "password":
      return "weak_password";
    case "confirm":
      return "password_mismatch";
    case "adult":
      return "adult_required";
    case "terms":
      return "terms_required";
    default:
      return "invalid_input";
  }
}

/**
 * Inscription complète : pseudo, e-mail, mot de passe, majorité attestée et
 * conditions acceptées. Le profil est créé tout de suite, avec les
 * consentements horodatés ; le joueur n'a plus qu'à confirmer son e-mail.
 */
export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const username = String(formData.get("username") ?? "").trim();
  const parsed = signUpSchema.safeParse({
    username,
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
    adult: formData.get("adult") ?? undefined,
    terms: formData.get("terms") ?? undefined,
    timezone: formData.get("timezone") ?? "",
  });
  if (!parsed.success) return { status: "error", code: signUpErrorCode(parsed.error.issues[0]?.path[0], username) };
  if (!(await allowed(RATE_LIMITS.signUp))) return { status: "error", code: "rate_limited" };

  const { email, password, timezone: rawTimezone } = parsed.data;
  const timezone = isValidTimeZone(rawTimezone) ? rawTimezone : "Europe/Paris";
  if (await isUsernameTaken(parsed.data.username)) return { status: "error", code: "username_taken" };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${publicEnv.siteUrl}/auth/confirm?suivant=/`,
      data: { username: parsed.data.username },
    },
  });
  if (error) return { status: "error", code: authErrorCode(error) };

  // Si l'adresse est déjà utilisée, Supabase renvoie un utilisateur sans identité
  // (pour ne pas révéler qui a un compte) : on ne crée alors rien.
  const user = data.user;
  if (user && (user.identities?.length ?? 0) > 0) {
    try {
      await createPlayer(user.id, parsed.data.username, timezone);
    } catch (e) {
      // Pseudo pris entre-temps (cas rare) : le joueur en choisira un autre sur /bienvenue.
      console.warn("[inscription] profil non créé", e);
    }
  }
  // Confirmation d'e-mail désactivée : la session existe déjà.
  if (data.session) redirect("/");
  return { status: "check_email", email };
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
