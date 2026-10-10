import { NextResponse } from "next/server";
import { getLocale } from "next-intl/server";
import { ApiError, assertSameOrigin, readJson, withErrors } from "@/lib/server/http";
import { getAuthUser } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { getPlayer } from "@/lib/server/players";
import { clientIp, consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";
import { verifyCaptcha } from "@/lib/server/captcha";
import { contactSchema } from "@/lib/validation/contact";

/** Enregistre un message de contact (visiteur ou joueur). */
export const POST = withErrors(async (request: Request) => {
  assertSameOrigin(request);
  if (!(await consumeRateLimit(RATE_LIMITS.contact, clientIp(request.headers)))) throw new ApiError(429, "rate_limited");
  const data = await readJson(request, contactSchema);
  if (!(await verifyCaptcha(data.captchaToken))) throw new ApiError(400, "captcha_failed");
  const user = await getAuthUser();
  const player = user ? await getPlayer(user.id) : null;
  await sql()`
    insert into public.contact_messages (player_id, email, category, subject, message, locale)
    values (${player?.id ?? null}, ${data.email}, ${data.category}, ${data.category === "other" ? (data.subject ?? null) : null}, ${data.message}, ${await getLocale()})
  `;
  return NextResponse.json({ ok: true }, { status: 201 });
});
