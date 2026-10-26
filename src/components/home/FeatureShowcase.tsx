import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { InteractiveCard } from "@/components/card/InteractiveCard";
import { SAMPLE_CARDS } from "@/components/card/sample-cards";
import { GAME_CONFIG } from "@/config/game.config";
import { CharacterBubble } from "./CharacterBubble";

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
        text={t("battle.text", { count: GAME_CONFIG.BATTLE_ROYALE.PARTICIPANTS })}
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
    <article className="grid items-center gap-5 overflow-hidden rounded-[1.75rem] border-2 border-ink bg-surface p-5 shadow-[0_3px_0_0_var(--mm-shadow)] md:grid-cols-2 md:gap-8 md:p-7">
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
  const chips = [t("chipRarity"), t("chipOwned"), t("chipSort")];
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

/** Une partie de Battle Royale vue de dessus : un bâtiment, des caisses, le Scroll qui avance, trois personnages qui se tirent dessus. */
async function BattleScene() {
  const t = await getTranslations("features.battle");
  const count = GAME_CONFIG.BATTLE_ROYALE.PARTICIPANTS;
  return (
    <div className="relative mx-auto max-w-sm">
      <div className="mb-3 flex justify-between gap-2 text-xs font-extrabold">
        <span className="rounded-full border-2 border-ink bg-surface px-3 py-1">{t("alive", { count: Math.round(count * 0.46) })}</span>
        <span className="rounded-full border-2 border-ink bg-surface px-3 py-1">{t("scroll")}</span>
      </div>
      <svg viewBox="0 0 360 240" role="img" aria-label={t("sceneLabel")} className="w-full overflow-hidden rounded-xl border-2 border-ink">
        <rect width="360" height="240" fill="#8fc46a" />
        <path d="M0 40 Q90 20 180 46 T360 34" stroke="#7fb65c" strokeWidth="18" fill="none" opacity="0.6" />
        <path d="M0 196 Q120 176 220 204 T360 190" stroke="#7fb65c" strokeWidth="14" fill="none" opacity="0.6" />
        {/* Étang et buisson. */}
        <ellipse cx="300" cy="200" rx="54" ry="28" fill="#4fa3d9" stroke="#2f7fb5" strokeWidth="3" />
        <path d="M268 196 q12 -6 24 0 M300 210 q12 -6 24 0" stroke="#bfe6ff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <g fill="#3f8f45" stroke="#2c6b33" strokeWidth="2.5">
          <circle cx="44" cy="190" r="17" />
          <circle cx="66" cy="200" r="15" />
          <circle cx="52" cy="210" r="14" />
        </g>
        {/* Bâtiment : sol en bois, murs en briques avec une porte. */}
        <rect x="120" y="34" width="130" height="92" fill="#d8b98b" />
        <path d="M120 54 H250 M120 74 H250 M120 94 H250 M120 114 H250" stroke="#c4a173" strokeWidth="1.5" />
        <path d="M116 30 H254 V130 H206 M168 130 H116 Z" fill="none" stroke="#5b4a6e" strokeWidth="9" strokeLinejoin="round" />
        {/* Caisses en bois. */}
        {[
          [78, 94],
          [278, 70],
        ].map(([x, y]) => (
          <g key={x} transform={`translate(${x} ${y})`}>
            <rect width="26" height="26" rx="3" fill="#c98a4b" stroke="#6e4220" strokeWidth="3" />
            <path d="M4 4 L22 22 M4 13 H22" stroke="#6e4220" strokeWidth="2.5" />
          </g>
        ))}
        {/* Le Scroll : l'extérieur de la zone, en violet, avec son bord. */}
        <path d="M360 0 V240 H316 A260 260 0 0 0 340 0 Z" fill="#6b2fd6" opacity="0.35" />
        <path d="M316 240 A260 260 0 0 0 340 0" stroke="#ff3d7f" strokeWidth="4" fill="none" />
        {/* Tirs. */}
        <path d="M104 162 L150 150" stroke="#ffd23f" strokeWidth="4" strokeLinecap="round" />
        <circle cx="154" cy="149" r="4" fill="#ffffff" stroke="#1a1238" strokeWidth="2" />
        <path d="M232 152 L214 154" stroke="#ffd23f" strokeWidth="4" strokeLinecap="round" />
        <CharacterBubble card={card("lundi-matin")} x={66} y={170} r={22} angle={-14} id="mm-scene-a" />
        <CharacterBubble card={card("le-chat-qui-juge")} x={186} y={92} r={22} angle={150} id="mm-scene-b" />
        <CharacterBubble card={card("l-algorithme-supreme")} x={262} y={150} r={22} angle={176} id="mm-scene-c" />
        <text x="186" y="60" textAnchor="middle" fontSize="16" fontWeight="800" fill="#ffffff" stroke="#1a1238" strokeWidth="4" paintOrder="stroke">
          12
        </text>
      </svg>
    </div>
  );
}
