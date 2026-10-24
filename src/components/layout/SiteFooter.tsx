import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { GAME_CONFIG } from "@/config/game.config";
import { LEGAL } from "@/config/legal.config";

export const LEGAL_LINKS = [
  { href: "/mentions-legales", key: "legal" },
  { href: "/conditions-utilisation", key: "terms" },
  { href: "/confidentialite", key: "privacy" },
  { href: "/regles-communaute", key: "community" },
] as const;

/**
 * Liens légaux, droits et avertissements. Affichés en pied de page sur les pages
 * vitrine, de connexion et d'inscription ; dans le compte joueur, discrètement
 * en bas des Réglages (un jeu n'a pas de pied de page).
 */
export async function LegalInfo({ compact = false }: { compact?: boolean }) {
  const t = await getTranslations("footer");
  const year = new Date().getFullYear();
  const years = year > LEGAL.COPYRIGHT_START_YEAR ? `${LEGAL.COPYRIGHT_START_YEAR}–${year}` : `${LEGAL.COPYRIGHT_START_YEAR}`;
  const name = GAME_CONFIG.GAME_NAME;
  const link = compact
    ? "inline-flex min-h-11 items-center underline underline-offset-4 hover:text-candy-ink"
    : "inline-flex min-h-11 items-center underline-offset-4 hover:text-candy-ink hover:underline";
  return (
    <div className={`grid ${compact ? "gap-3 text-xs" : "gap-5 text-sm"}`}>
      <nav aria-label={t("label")}>
        <ul className={`flex flex-wrap gap-x-5 ${compact ? "font-semibold" : "font-bold"}`}>
          {LEGAL_LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className={link}>
                {t(l.key)}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/contact" className={link}>
              {t("contact")}
            </Link>
          </li>
        </ul>
      </nav>
      <div className="grid gap-1.5 text-ink-soft">
        <p className={compact ? "font-semibold" : "font-bold text-ink"}>{t("copyright", { years, name })}</p>
        <p>{t("adults")}</p>
        <p>{t("independent", { name })}</p>
        <p>
          {t.rich("trademarks", {
            contact: (chunks) => (
              <Link href="/contact" className="font-semibold text-link underline underline-offset-4">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </div>
  );
}

/** Pied de page des pages vitrine, de connexion et d'inscription (pas du compte joueur). */
export async function SiteFooter() {
  return (
    <footer className="mt-16 border-t-2 border-ink bg-surface">
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-8 xl:px-10">
        <LegalInfo />
      </div>
    </footer>
  );
}
