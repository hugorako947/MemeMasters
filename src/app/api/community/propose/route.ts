import { NextResponse } from "next/server";
import { apiPlayer } from "@/lib/server/auth";
import { propose, proposalSchema } from "@/lib/server/community";
import { ApiError, assertSameOrigin, withErrors } from "@/lib/server/http";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Propose une carte de meme à la Communauté (formulaire avec illustration facultative). */
export const POST = withErrors(async (request: Request) => {
  assertSameOrigin(request);
  const { player } = await apiPlayer();
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ApiError(400, "invalid_input");
  }
  const parsed = proposalSchema.safeParse({ name: form.get("name"), description: form.get("description") ?? "" });
  if (!parsed.success) throw new ApiError(400, "invalid_input");
  const file = form.get("image");
  const image = file instanceof File && file.size > 0 ? file : null;
  if (image && image.size > MAX_IMAGE_BYTES) throw new ApiError(413, "file_too_large");
  if (!(await consumeRateLimit(RATE_LIMITS.communityPropose, player.id))) throw new ApiError(429, "rate_limited");
  const id = await propose(player, parsed.data, image);
  return NextResponse.json({ id }, { status: 201 });
});
