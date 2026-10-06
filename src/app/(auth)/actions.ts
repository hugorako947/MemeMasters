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

/**
 * Vérifie la limite de débit. Renvoie null si la requête peut continuer,
 * sinon le code d'erreur à afficher. Si la base ne répond pas, on refuse
 * (plutôt que d'ouvrir la porte au bourrage), avec un message distinct.
 */
async function rateLimitError(rule: RateLimitRule): Promise<string | null> {
  try {
    return (await consumeRateLimit(rule, clientIp(await headers()))) ? null : "rate_limited";
  } catch (error) {
    console.error(
      "[auth] Base de données injoignable : vérifiez DATABASE_URL dans .env.local (lancez `npm run doctor`).",
      error,
    );
    return "service_unavailable";
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
      return "auth_rate_limited";
    case "over_email_send_rate_limit":
      return "email_rate_limited";
    case "email_address_not_authorized":
      return "email_not_authorized";
    case "signup_disabled":
    case "email_provider_disabled":
      return "signup_disabled";
    default:
      return "server_error";
  }
}

/** Journalise côté serveur la vraie cause d'un refus de Supabase Auth, avec la piste de correction. */
function logAuthError(context: string, error: { code?: string; message?: string; status?: number }): void {
  const hints: Record<string, string> = {
    over_email_send_rate_limit:
      "Limite d'envoi d'e-mails de Supabase atteinte (quelques e-mails par heure sans SMTP personnel). Désactivez temporairement « Confirm email » ou configurez un SMTP (Authentication → SMTP Settings).",
    email_address_not_authorized:
      "Sans SMTP personnel, Supabase n'envoie qu'aux adresses des membres de l'équipe du projet. Utilisez l'e-mail de votre compte Supabase, désactivez « Confirm email », ou configurez un SMTP.",
    over_request_rate_limit: "Limite de requêtes de Supabase Auth atteinte. Patientez quelques minutes.",
    signup_disabled: "Les inscriptions sont désactivées dans Supabase (Authentication → Sign In / Providers).",
  };
  console.warn(`[auth] ${context} refusée par Supabase : ${error.code ?? "?"} (${error.message ?? ""})`);
  if (error.code && hints[error.code]) console.warn(`[auth] → ${hints[error.code]}`);
}

export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { status: "error", code: "invalid_credentials" };
  const limited = await rateLimitError(RATE_LIMITS.signIn);
  if (limited) return { status: "error", code: limited };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code !== "invalid_credentials") logAuthError("Connexion", error);
    return { status: "error", code: authErrorCode(error) };
  }
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
  const limited = await rateLimitError(RATE_LIMITS.signUp);
  if (limited) return { status: "error", code: limited };

  const { email, password, timezone: rawTimezone } = parsed.data;
  const timezone = isValidTimeZone(rawTimezone) ? rawTimezone : "Europe/Paris";
  try {
    if (await isUsernameTaken(parsed.data.username)) return { status: "error", code: "username_taken" };
  } catch (error) {
    console.error("[auth] Base de données injoignable (lancez `npm run doctor`).", error);
    return { status: "error", code: "service_unavailable" };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${publicEnv.siteUrl}/auth/confirm?suivant=/`,
      data: { username: parsed.data.username },
    },
  });
  if (error) {
    logAuthError("Inscription", error);
    return { status: "error", code: authErrorCode(error) };
  }

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
  const limited = await rateLimitError(RATE_LIMITS.passwordReset);
  if (limited) return { status: "error", code: limited };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.siteUrl}/auth/confirm?suivant=/nouveau-mot-de-passe`,
  });
  if (error) logAuthError("Réinitialisation du mot de passe", error);
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
