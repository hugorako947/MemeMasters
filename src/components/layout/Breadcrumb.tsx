import Link from "next/link";
import { getTranslations } from "next-intl/server";

export type BreadcrumbOrigin = "amis" | "messages" | "classement";

/**
 * « ← Retour à … » sur le profil d'un autre joueur, quand on y arrive depuis
 * sa liste d'amis, ses messages ou le classement : ramène à la page visitée juste avant.
 */
export async function ProfileBackLink({ origin, myUsername }: { origin: BreadcrumbOrigin; myUsername: string }) {
  const t = await getTranslations("back");
  const me = `/profil/${encodeURIComponent(myUsername)}`;
  const target = {
    amis: { href: `${me}?vue=amis`, label: t("myFriends") },
    messages: { href: `${me}?vue=messages`, label: t("myMessages") },
    classement: { href: "/infos?vue=classement", label: t("leaderboard") },
  }[origin];
  return (
    <Link
      href={target.href}
      className="inline-flex min-h-11 items-center gap-1.5 justify-self-start text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
    >
      <span aria-hidden="true" className="inline-block rtl:rotate-180">
        ←
      </span>
      {target.label}
    </Link>
  );
}
