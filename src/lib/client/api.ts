/**
 * Appels d'API depuis le navigateur. Le serveur répond toujours
 * { error: { code } } en cas d'échec ; le code est traduit via errors.<code>.
 */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; code: string; status: number };

export async function postJson<T = unknown>(url: string, body: unknown): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, code: "network", status: 0 };
  }
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // Réponse vide ou non JSON.
  }
  if (res.ok) return { ok: true, data: payload as T };
  const code =
    typeof payload === "object" && payload !== null && "error" in payload
      ? String((payload as { error: { code?: string } }).error?.code ?? "server_error")
      : res.status === 429
        ? "rate_limited"
        : "server_error";
  return { ok: false, code, status: res.status };
}
