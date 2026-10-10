import Link from "next/link";
import { getTranslations } from "next-intl/server";

export type BreadcrumbOrigin = "amis" | "messages" | "classement";

/**
 * Fil d'Ariane du profil d'un autre joueur, quand on y arrive depuis sa liste
 * d'amis, ses messages ou le classement : permet de revenir à la bonne page.
 */
export async function ProfileBreadcrumb({ origin, myUsername, current }: { origin: BreadcrumbOrigin; myUsername: string; current: string }) {
  const t = await getTranslations("breadcrumb");
  const me = `/profil/${encodeURIComponent(myUsername)}`;
  const items =
    origin === "classement"
      ? [
          { href: "/infos", label: t("infos") },
          { href: "/infos?vue=classement", label: t("leaderboard") },
        ]
      : [
          { href: me, label: t("myProfile") },
          { href: `${me}?vue=${origin}`, label: origin === "amis" ? t("friends") : t("messages") },
        ];
  return (
    <nav aria-label={t("label")} className="text-sm font-semibold">
      <ol className="flex flex-wrap items-center gap-1.5 text-ink-soft">
        {items.map((item) => (
          <li key={item.href} className="flex items-center gap-1.5">
            <Link href={item.href} className="inline-flex min-h-10 items-center underline-offset-4 hover:text-ink hover:underline">
              {item.label}
            </Link>
            <span aria-hidden="true" className="inline-block rtl:rotate-180">
              ›
            </span>
          </li>
        ))}
        <li aria-current="page" className="font-bold text-ink">
          {current}
        </li>
      </ol>
    </nav>
  );
}
