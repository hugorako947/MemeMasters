import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, assertSameOrigin, readJson, withErrors } from "@/lib/server/http";
import { apiPlayer } from "@/lib/server/auth";
import { saveAppearance } from "@/lib/server/players";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";
import { parseAppearance, THEME_COOKIES } from "@/lib/theme/theme";

/** Enregistre le thème du joueur (compte + cookies de l'appareil). */
export const POST = withErrors(async (request: Request) => {
  assertSameOrigin(request);
  const { user } = await apiPlayer();
  if (!(await consumeRateLimit(RATE_LIMITS.preferences, user.id))) throw new ApiError(429, "rate_limited");
  const raw = await readJson(
    request,
    z.object({ theme: z.string(), accent: z.string().nullable().optional(), base: z.string().nullable().optional() }),
  );
  const appearance = parseAppearance(raw);
  await saveAppearance(user.id, appearance);
  const res = NextResponse.json({ ok: true, appearance });
  const opts = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };
  res.cookies.set(THEME_COOKIES.theme, appearance.theme, opts);
  if (appearance.accent) res.cookies.set(THEME_COOKIES.accent, appearance.accent, opts);
  else res.cookies.delete(THEME_COOKIES.accent);
  if (appearance.base) res.cookies.set(THEME_COOKIES.base, appearance.base, opts);
  else res.cookies.delete(THEME_COOKIES.base);
  return res;
});
