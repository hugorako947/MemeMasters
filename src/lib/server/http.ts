import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";

/**
 * Erreur d'API : un statut HTTP et un code stable. Le client traduit le code
 * via messages/fr.json (clé errors.<code>) ; aucun détail interne ne fuit.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

export function errorResponse(status: number, code: string): NextResponse {
  return NextResponse.json({ error: { code } }, { status });
}

/**
 * Refuse les requêtes d'écriture venant d'une autre origine (protection CSRF
 * en plus des cookies SameSite=Lax).
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) throw new ApiError(403, "forbidden_origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, "forbidden_origin");
  }
  if (!host || originHost !== host) throw new ApiError(403, "forbidden_origin");
}

export async function readJson<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "invalid_input");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, "invalid_input");
  return parsed.data;
}

type Handler<R extends Request, C> = (request: R, context: C) => Promise<Response>;

/** Enveloppe commune : traduit les ApiError, masque les erreurs inattendues. */
export function withErrors<R extends Request = Request, C = unknown>(handler: Handler<R, C>): Handler<R, C> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ApiError) return errorResponse(error.status, error.code);
      console.error("[api] erreur inattendue", error);
      return errorResponse(500, "server_error");
    }
  };
}
