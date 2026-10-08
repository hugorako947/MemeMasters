import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdaptiveShell } from "@/components/layout/AdaptiveShell";
import { LEGAL } from "@/config/legal.config";
import { getAuthUser } from "@/lib/server/auth";
import { ContactForm } from "./ContactForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("contact"))("title") };
}

/**
 * Page de contact, ouverte à tous. Les messages sont enregistrés en base en
 * attendant l'adresse e-mail dédiée du jeu ; quand elle est renseignée
 * (legal.config.ts), elle s'affiche aussi pour écrire directement.
 */
export default async function ContactPage() {
  const t = await getTranslations("contact");
  const user = await getAuthUser();
  const email = LEGAL.PUBLISHER.email;
  return (
    <AdaptiveShell publicWidth="max-w-2xl">
      <div className="mx-auto grid max-w-xl gap-6">
        <div>
          <h1 className="font-display text-5xl leading-none">{t("title")}</h1>
          <p className="mt-2 text-ink-soft">{t("lead")}</p>
        </div>
        <ContactForm defaultEmail={user?.email ?? ""} />
        {email ? (
          <p className="text-center text-sm text-ink-soft">
            {t("direct")}{" "}
            <a href={`mailto:${email}`} className="font-semibold text-link underline underline-offset-4">
              {email}
            </a>
          </p>
        ) : null}
      </div>
    </AdaptiveShell>
  );
}
