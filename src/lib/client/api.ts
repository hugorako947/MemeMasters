/**
 * Appels d'API depuis le navigateur. Le serveur répond toujours
 * { error: { code } } en cas d'échec ; le code est traduit via errors.<code>.
 */
import { markBusy, takePressed } from "./busy";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; code: string; status: number };

/**
 * Pendant chaque appel, l'élément qui l'a déclenché (bouton, onglet…) est
 * « en cours » : il ignore les nouveaux clics et affiche un cercle tournant si
 * la réponse tarde (voir busy.ts).
 */
export async function postJson<T = unknown>(url: string, body: unknown): Promise<ApiResult<T>> {
  const release = markBusy(takePressed());
  try {
    return await send<T>(url, body);
  } finally {
    release();
  }
}

async function send<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, code: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "network", status: 0 };
  }
  return readResult<T>(res);
}

/** Envoi d'un formulaire avec fichier (illustration…), mêmes conventions que postJson. */
export async function postForm<T = unknown>(url: string, form: FormData): Promise<ApiResult<T>> {
  const release = markBusy(takePressed());
  try {
    let res: Response;
    try {
      res = await fetch(url, { method: "POST", body: form });
    } catch {
      return { ok: false, code: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "network", status: 0 };
    }
    return await readResult<T>(res);
  } finally {
    release();
  }
}

async function readResult<T>(res: Response): Promise<ApiResult<T>> {
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
        : res.status === 413
          ? "file_too_large"
          : "server_error";
  return { ok: false, code, status: res.status };
}
