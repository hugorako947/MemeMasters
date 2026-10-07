import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { InteractiveCard } from "@/components/card/InteractiveCard";
import { SAMPLE_CARDS } from "@/components/card/sample-cards";
import { GAME_CONFIG } from "@/config/game.config";

const card = (slug: string) => SAMPLE_CARDS.find((c) => c.slug === slug)!;

/** Les trois piliers du jeu, chacun avec une petite scène illustrée. */
export async function FeatureShowcase() {
  const t = await getTranslations("features");
  return (
    <section aria-labelledby="fonctionnalites" className="grid gap-6">
      <h2 id="fonctionnalites" className="font-display text-4xl leading-none md:text-5xl">
        {t("title")}
      </h2>
      <Feature
        title={t("boosters.title")}
        text={t("boosters.text", { free: GAME_CONFIG.DAILY_FREE_BOOSTERS, size: GAME_CONFIG.BOOSTER_SIZE })}
        tint="bg-[#ffe3ec]"
      >
        <BoosterScene caption={t("boosters.pack", { size: GAME_CONFIG.BOOSTER_SIZE })} />
      </Feature>
      <Feature title={t("collection.title")} text={t("collection.text")} tint="bg-[#e3f0ff]" flip>
        <CollectionScene />
      </Feature>
      <Feature
        title={t("battle.title")}
        text={t("battle.text", { team: GAME_CONFIG.TEAM_SIZE, seconds: GAME_CONFIG.TURN_SECONDS })}
        tint="bg-[#fff6c9]"
      >
        <BattleScene />
      </Feature>
    </section>
  );
}

function Feature({
  title,
  text,
  tint,
  flip = false,
  children,
}: {
  title: string;
  text: string;
  tint: string;
  flip?: boolean;
  children: ReactNode;
}) {
  return (
    <article className="grid items-center gap-5 overflow-hidden rounded-[1.75rem] border-[3px] border-ink bg-surface p-5 shadow-[0_5px_0_0_var(--mm-shadow)] md:grid-cols-2 md:gap-8 md:p-7">
      <div className={flip ? "md:order-2" : ""}>
        <h3 className="font-display text-3xl leading-none md:text-4xl">{title}</h3>
        <p className="mt-3 text-ink-soft md:text-lg">{text}</p>
      </div>
      <div className={`relative rounded-2xl ${tint} p-4 ${flip ? "md:order-1" : ""}`}>{children}</div>
    </article>
  );
}

/** Un sachet qui flotte, et les cartes qui s'en échappent. */
async function BoosterScene({ caption }: { caption: string }) {
  const { GAME_NAME } = GAME_CONFIG;
  return (
    <div className="relative mx-auto h-60 max-w-sm">
      <div className="mm-pack mm-float absolute left-[4%] top-4 z-10 w-[38%]">
        <span className="mm-pack__tear" aria-hidden="true" />
        <span className="mm-pack__label meme-caption">{GAME_NAME}</span>
        <span className="mm-pack__count">{caption}</span>
      </div>
      <div className="absolute left-[38%] top-10 w-[27%] -rotate-[8deg]">
        <InteractiveCard card={card("mamie-wifi")} size="compact" />
      </div>
      <div className="absolute left-[54%] top-4 w-[27%] rotate-[4deg]">
        <InteractiveCard card={card("le-pigeon-philosophe")} size="compact" />
      </div>
      <div className="absolute right-0 top-14 w-[27%] rotate-[14deg]">
        <InteractiveCard card={card("l-algorithme-supreme")} size="compact" />
      </div>
    </div>
  );
}

/** Un aperçu de la collection : progression, filtres, cartes possédées ou floutées. */
async function CollectionScene() {
  const t = await getTranslations("features.collection");
  const chips = [t("chipRarity"), t("chipVibe"), t("chipOwned"), t("chipSort")];
  const grid = [
    { c: card("le-chat-qui-juge"), owned: true },
    { c: card("spirale-du-scroll-infini"), owned: false },
    { c: card("lundi-matin"), owned: true },
    { c: card("cerveau-en-puree-cosmique"), owned: false },
  ];
  return (
    <div className="grid gap-3">
      <div className="rounded-xl border-2 border-ink bg-surface p-3">
        <p className="flex items-baseline justify-between text-sm font-extrabold">
          <span>{t("progress")}</span>
          <span className="text-ink-soft">36 %</span>
        </p>
        <div className="mm-stat-bar mt-2" aria-hidden="true">
          <span style={{ width: "36%", ["--bar" as string]: "var(--color-link)" }} />
        </div>
      </div>
      <ul className="flex flex-wrap gap-2" aria-label={t("filtersLabel")}>
        {chips.map((chip, i) => (
          <li
            key={chip}
            className={`rounded-full border-2 border-ink px-3 py-1 text-xs font-bold ${i === 3 ? "bg-ink text-surface" : "bg-surface"}`}
          >
            {chip}
          </li>
        ))}
      </ul>
      <ul className="grid grid-cols-4 gap-2">
        {grid.map(({ c, owned }) => (
          <li key={c.id}>
            <InteractiveCard card={c} size="compact" owned={owned} />
          </li>
        ))}
      </ul>
      <p className="text-xs font-semibold text-ink-soft">{t("rankingHint")}</p>
    </div>
  );
}

/** Deux cartes face à face, barres de PV, minuteur et ELO. */
async function BattleScene() {
  const t = await getTranslations("features.battle");
  const fighters = [
    { c: card("le-stagiaire-en-pls"), hp: 72, side: "-rotate-[6deg]" },
    { c: card("le-chat-qui-juge"), hp: 41, side: "rotate-[6deg]" },
  ];
  return (
    <div className="relative mx-auto max-w-sm">
      <div className="mb-3 flex justify-between text-xs font-extrabold">
        <span className="rounded-full border-2 border-ink bg-surface px-3 py-1">⏱ {t("timer", { seconds: GAME_CONFIG.TURN_SECONDS })}</span>
        <span className="rounded-full border-2 border-ink bg-surface px-3 py-1">🏆 {t("trophies")}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        {fighters.map(({ c, hp, side }, i) => (
          <div key={c.id} className={i === 1 ? "order-3" : ""}>
            <div className="mm-stat-bar mb-2 border-2 border-ink" aria-hidden="true">
              <span style={{ width: `${hp}%`, ["--bar" as string]: hp > 50 ? "#127a4b" : "#f5a400" }} />
            </div>
            <div className={side}>
              <InteractiveCard card={c} size="compact" />
            </div>
          </div>
        ))}
        <span
          className="meme-caption order-2 grid size-14 place-items-center rounded-full border-[3px] border-ink bg-sticker text-2xl"
          style={{ WebkitTextStroke: "0.1em var(--color-ink)" }}
        >
          VS
        </span>
      </div>
    </div>
  );
}
