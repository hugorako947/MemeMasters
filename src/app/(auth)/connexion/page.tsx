import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { safeNextPath } from "@/lib/validation/auth";
import { SignInForm } from "../AuthForms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("signInTitle") };
}

export default async function SignInPage({ searchParams }: PageProps<"/connexion">) {
  const t = await getTranslations("auth");
  const params = await searchParams;
  const next = safeNextPath(params.suivant);
  const notice =
    params.erreur === "lien" ? t("confirmFailed") : params.erreur === "oauth" ? t("oauthFailed") : null;
  return (
    <>
      <h1 className="font-display text-5xl leading-none">{t("signInTitle")}</h1>
      <p className="mb-8 mt-2 text-ink-soft">{t("signInLead")}</p>
      <SignInForm next={next} notice={notice} />
    </>
  );
}
