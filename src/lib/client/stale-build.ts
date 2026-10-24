/**
 * Après une mise en ligne, un onglet (ou l'application installée) resté ouvert
 * garde l'ancienne version du jeu : il peut réclamer un fichier JavaScript qui
 * n'existe plus sur le serveur (« ChunkLoadError »). Recharger la page suffit à
 * passer à la nouvelle version ; on le fait une seule fois par minute pour ne
 * jamais boucler si le problème vient d'ailleurs.
 */
const KEY = "mm-stale-build-reload";
const MIN_INTERVAL_MS = 60_000;

export function isStaleBuildError(error: { name?: string; message?: string }): boolean {
  return error.name === "ChunkLoadError" || /Failed to load chunk|Loading chunk \S+ failed|dynamically imported module/i.test(error.message ?? "");
}

/** Recharge la page si l'erreur vient d'une ancienne version. Renvoie vrai si le rechargement est lancé. */
export function reloadIfStaleBuild(error: { name?: string; message?: string }, now: number = Date.now()): boolean {
  if (!isStaleBuildError(error)) return false;
  try {
    const last = Number(window.sessionStorage.getItem(KEY) ?? 0);
    if (now - last < MIN_INTERVAL_MS) return false;
    window.sessionStorage.setItem(KEY, String(now));
  } catch {
    // Stockage indisponible (navigation privée stricte) : on ne recharge pas, pour ne jamais boucler.
    return false;
  }
  window.location.reload();
  return true;
}
