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

/** Pied de page commun : liens légaux, droits, avertissements. */
export async function SiteFooter() {
  const t = await getTranslations("footer");
  const year = new Date().getFullYear();
  const years = year > LEGAL.COPYRIGHT_START_YEAR ? `${LEGAL.COPYRIGHT_START_YEAR}–${year}` : `${LEGAL.COPYRIGHT_START_YEAR}`;
  const name = GAME_CONFIG.GAME_NAME;
  return (
    <footer className="mt-16 border-t-2 border-ink bg-surface">
      <div className="mx-auto grid max-w-6xl gap-5 px-5 py-8 text-sm md:px-8">
        <nav aria-label={t("label")}>
          <ul className="flex flex-wrap gap-x-5 font-bold">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="inline-flex min-h-11 items-center underline-offset-4 hover:text-candy-ink hover:underline">
                  {t(link.key)}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/contact" className="inline-flex min-h-11 items-center underline-offset-4 hover:text-candy-ink hover:underline">
                {t("contact")}
              </Link>
            </li>
          </ul>
        </nav>
        <div className="grid gap-1.5 text-ink-soft">
          <p className="font-bold text-ink">{t("copyright", { years, name })}</p>
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
    </footer>
  );
}
