import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SignUpForm } from "../AuthForms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("signUpTitle") };
}

export default async function SignUpPage() {
  const t = await getTranslations("auth");
  return (
    <>
      <h1 className="font-display text-5xl leading-none">{t("signUpTitle")}</h1>
      <p className="mb-8 mt-2 text-ink-soft">{t("signUpLead")}</p>
      <SignUpForm />
    </>
  );
}
