import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, assertSameOrigin, readJson, withErrors } from "@/lib/server/http";
import { getAuthUser } from "@/lib/server/auth";
import { getPlayer, saveLocale } from "@/lib/server/players";
import { clientIp, consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";
import { isAvailable, LOCALE_COOKIE } from "@/lib/i18n/locales";

/** Change la langue : cookie de l'appareil, et compte du joueur s'il est connecté. */
export const POST = withErrors(async (request: Request) => {
  assertSameOrigin(request);
  if (!(await consumeRateLimit(RATE_LIMITS.preferences, clientIp(request.headers)))) throw new ApiError(429, "rate_limited");
  const { locale } = await readJson(request, z.object({ locale: z.string() }));
  if (!isAvailable(locale)) throw new ApiError(400, "locale_unavailable");
  const user = await getAuthUser();
  if (user && (await getPlayer(user.id))) await saveLocale(user.id, locale);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
});
