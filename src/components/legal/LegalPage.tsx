import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { AdaptiveShell } from "@/components/layout/AdaptiveShell";
import { missingLegalFields } from "@/config/legal.config";
import type { LegalDocument } from "@/content/legal/fr";

/** Gabarit commun des pages légales. */
export async function LegalPage({ doc }: { doc: LegalDocument }) {
  const t = await getTranslations("legalPage");
  const format = await getFormatter();
  const missing = missingLegalFields();
  const locale = await getLocale();
  return (
    <AdaptiveShell backToHome publicWidth="max-w-4xl">
      {missing.length > 0 ? (
        <p role="note" className="mb-6 rounded-xl border-2 border-dashed border-candy-ink bg-surface p-4 text-sm font-semibold">
          {t("draftWarning", { fields: missing.join(", ") })}
        </p>
      ) : null}
      <h1 className="font-display text-5xl leading-none">{doc.title}</h1>
      <p className="mt-2 text-sm text-ink-soft">
        {t("updated", { date: format.dateTime(new Date(`${doc.updated}T12:00:00Z`), { day: "numeric", month: "long", year: "numeric" }) })}
      </p>
      {locale !== "fr" ? <p className="mt-4 rounded-xl bg-surface p-3 text-sm font-semibold">{t("frenchOnly")}</p> : null}
      <div className="mm-prose mt-4" lang="fr">
        {doc.body}
      </div>
    </AdaptiveShell>
  );
}
