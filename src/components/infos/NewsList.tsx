import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { localized, NEWS, type NewsKind } from "@/content/news";

const KIND_STYLE: Record<NewsKind, string> = {
  news: "bg-candy text-[var(--mm-accent-ink)]",
  update: "bg-[#2d5bff] text-white",
  upcoming: "bg-sticker text-[#1a1238]",
  change: "bg-[#12a150] text-white",
};

/** Actualités du jeu : nouveautés, mises à jour, prochaines mises à jour, changements. */
export async function NewsList() {
  const t = await getTranslations("infos.news");
  const format = await getFormatter();
  const locale = await getLocale();
  return (
    <ol className="grid gap-4">
      {NEWS.map((item) => {
        const title = localized(item.title, locale);
        const body = localized(item.body, locale);
        return (
          <li key={item.id}>
            <article className="rounded-[1.5rem] border-2 border-ink bg-surface p-5 shadow-[0_3px_0_0_var(--mm-shadow)]">
              <p className="flex flex-wrap items-center gap-2 text-xs font-extrabold">
                <span className={`rounded-full px-2.5 py-1 ${KIND_STYLE[item.kind]}`}>{t(`kinds.${item.kind}`)}</span>
                <time dateTime={item.date} className="text-ink-soft">
                  {format.dateTime(new Date(`${item.date}T12:00:00Z`), { day: "numeric", month: "long", year: "numeric" })}
                </time>
              </p>
              <h3 lang={title.lang} className="mt-2 font-display text-2xl leading-tight">
                {title.text}
              </h3>
              <p lang={body.lang} className="mt-1 text-ink-soft">
                {body.text}
              </p>
            </article>
          </li>
        );
      })}
    </ol>
  );
}
