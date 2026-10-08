import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RaritiesGrid } from "@/components/infos/RaritiesGrid";
import { AdaptiveShell } from "@/components/layout/AdaptiveShell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("rarities");
  return { title: t("title") };
}

/** Vitrine publique du design system : les 8 raretés sur des cartes réelles. */
export default async function RaritiesPage() {
  const t = await getTranslations("rarities");
  return (
    <AdaptiveShell>
      <h1 className="font-display text-5xl leading-none md:text-6xl">{t("title")}</h1>
      <div className="mt-8">
        <RaritiesGrid />
      </div>
    </AdaptiveShell>
  );
}
