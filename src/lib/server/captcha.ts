import "server-only";
import { headers } from "next/headers";
import { TURNSTILE_TEST_SECRET_KEY } from "@/lib/env.public";
import { clientIp } from "./rate-limit";

/**
 * Vérifie le jeton anti-robot Cloudflare Turnstile auprès de Cloudflare.
 * En développement sans clé : clé secrète de test de Cloudflare (toujours validée).
 * En production sans clé : vérification désactivée (avertissement dans les journaux).
 * Un jeton ne sert qu'une fois : le formulaire en redemande un après chaque envoi.
 */
export async function verifyCaptcha(token: FormDataEntryValue | string | null | undefined): Promise<boolean> {
  const secret =
    process.env.TURNSTILE_SECRET_KEY || (process.env.NODE_ENV !== "production" ? TURNSTILE_TEST_SECRET_KEY : "");
  if (!secret) {
    if (process.env.NODE_ENV === "production") console.warn("[captcha] TURNSTILE_SECRET_KEY manquante : captcha désactivé en production.");
    return true;
  }
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    const ip = clientIp(await headers());
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5_000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (error) {
    console.error("[captcha] Vérification impossible (Cloudflare injoignable ?)", error);
    return false;
  }
}
