import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ForgotPasswordForm } from "../AuthForms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("forgotTitle") };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");
  return (
    <>
      <h1 className="text-center font-display text-5xl leading-none">{t("forgotTitle")}</h1>
      <p className="mb-8 mt-2 text-center text-ink-soft">{t("forgotLead")}</p>
      <ForgotPasswordForm />
    </>
  );
}
