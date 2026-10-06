import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/server/auth";
import { NewPasswordForm } from "../AuthForms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("resetTitle") };
}

/** Accessible après le lien de réinitialisation, qui ouvre une session temporaire. */
export default async function NewPasswordPage() {
  await requireUser();
  const t = await getTranslations("auth");
  return (
    <>
      <h1 className="mb-8 font-display text-5xl leading-none">{t("resetTitle")}</h1>
      <NewPasswordForm />
    </>
  );
}
