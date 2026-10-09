import type { Metadata } from "next";
import Link from "next/link";
import { randomInt } from "node:crypto";
import { getTranslations } from "next-intl/server";
import { BattleArena } from "@/components/battle/BattleArena";
import { STARTER_SET } from "@/content/cards/starter-set";
import { mulberry32 } from "@/lib/art/prng";
import { botDeck, playerDeck } from "@/lib/battle/decks";
import { requirePlayer } from "@/lib/server/auth";
import { getCollection } from "@/lib/server/cards";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("battle"))("title") };
}

/**
 * Bataille d'entraînement contre le bot, en plein écran (sans la barre de
 * navigation, pour garder toute la place pour l'arène).
 */
export default async function BattlePage() {
  const { player } = await requirePlayer();
  const t = await getTranslations("battle");
  const collection = await getCollection(player.id);
  const owned = collection.filter((e) => e.quantity > 0).map((e) => e.card);
  const pool = collection.map((e) => e.card);
  const { deck, loaned } = playerDeck(owned, pool.length ? pool : [...STARTER_SET]);
  const seed = randomInt(1, 2 ** 31 - 1);
  const opponent = botDeck(deck, pool.length ? pool : [...STARTER_SET], mulberry32(seed));
  return (
    <main id="contenu" className="safe-bottom min-h-dvh px-3 pb-6 pt-3">
      <div className="mx-auto mb-2 flex max-w-[26rem] items-center justify-between">
        <Link href="/?vue=batailles" className="inline-flex min-h-11 items-center font-bold text-ink-soft hover:text-ink">
          <span aria-hidden="true" className="me-1 inline-block rtl:rotate-180">←</span> {t("quit")}
        </Link>
        {loaned > 0 ? <span className="text-xs font-semibold text-ink-soft">{t("loaned", { count: loaned })}</span> : null}
      </div>
      <BattleArena deck={deck} botDeck={opponent} seed={seed} playerName={player.username} />
    </main>
  );
}
