/**
 * « Jour de jeu » = date locale dans le fuseau du joueur. Toutes les limites
 * quotidiennes (boosters gratuits, défis) sont calculées par le serveur avec
 * ces fonctions, jamais avec l'heure du client.
 */

/** Vrai si `tz` est un fuseau IANA reconnu (ex. « Europe/Paris »). */
export function isValidTimeZone(tz: string): boolean {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Date locale au format AAAA-MM-JJ dans le fuseau donné. */
export function gameDate(tz: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Instant du prochain minuit local (réinitialisation des limites).
 * Gère les changements d'heure : on cherche le premier instant dont la date
 * locale diffère, par dichotomie à la milliseconde sur les 26 prochaines heures.
 */
export function nextLocalMidnight(tz: string, now: Date = new Date()): Date {
  const today = gameDate(tz, now);
  let lo = now.getTime();
  let hi = lo + 26 * 3600_000;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (gameDate(tz, new Date(mid)) === today) lo = mid;
    else hi = mid;
  }
  return new Date(hi);
}

/** Nombre de jours entiers écoulés entre deux instants. */
export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

/** Âge en années révolues à la date `on`, à partir d'une date AAAA-MM-JJ. */
export function ageOn(birthdate: string, on: Date = new Date()): number {
  const [y, m, d] = birthdate.split("-").map(Number);
  const yy = on.getUTCFullYear();
  const mm = on.getUTCMonth() + 1;
  const dd = on.getUTCDate();
  let age = yy - y;
  if (mm < m || (mm === m && dd < d)) age -= 1;
  return age;
}
