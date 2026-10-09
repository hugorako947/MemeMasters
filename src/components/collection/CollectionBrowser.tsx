"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { InteractiveCard } from "@/components/card/InteractiveCard";
import { RARITIES, type Rarity } from "@/config/rarities";
import { VIBES, type Vibe } from "@/config/vibes";
import type { Level } from "@/lib/economy/duplicates";
import type { Card } from "@/lib/validation/card";
import { BulkSell } from "./BulkSell";
import { DuplicateActions } from "./DuplicateActions";

export interface CollectionItem {
  card: Card;
  quantity: number;
  level: Level;
  firstObtainedAt: string | null;
}

type Show = "all" | "owned" | "missing";
type Sort = "rarity" | "name" | "recent" | "quantity";

/**
 * La collection : progression, filtres simples et grille de cartes.
 * Les cartes manquantes restent floutées ; un clic ouvre la fiche de la carte.
 */
export function CollectionBrowser({ items, resaleLeftCents }: { items: CollectionItem[]; resaleLeftCents: number }) {
  const t = useTranslations("collection");
  const tr = useTranslations("rarity");
  const tv = useTranslations("vibe");
  const format = useFormatter();
  const [show, setShow] = useState<Show>("all");
  const [rarity, setRarity] = useState<Rarity | "all">("all");
  const [vibe, setVibe] = useState<Vibe | "all">("all");
  const [sort, setSort] = useState<Sort>("rarity");
  const [query, setQuery] = useState("");

  const owned = items.filter((i) => i.quantity > 0).length;
  const percent = items.length ? Math.round((owned / items.length) * 100) : 0;

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const list = items.filter(
      (i) =>
        (show === "all" || (show === "owned" ? i.quantity > 0 : i.quantity === 0)) &&
        (rarity === "all" || i.card.rarity === rarity) &&
        (vibe === "all" || i.card.vibe === vibe) &&
        (!q || i.card.name.toLocaleLowerCase().includes(q)),
    );
    const byRarity = (a: CollectionItem, b: CollectionItem) => RARITIES.indexOf(b.card.rarity) - RARITIES.indexOf(a.card.rarity);
    return [...list].sort((a, b) => {
      if (sort === "name") return a.card.name.localeCompare(b.card.name);
      if (sort === "quantity") return b.quantity - a.quantity || byRarity(a, b);
      if (sort === "recent") return (b.firstObtainedAt ?? "").localeCompare(a.firstObtainedAt ?? "") || byRarity(a, b);
      return byRarity(a, b) || a.card.name.localeCompare(b.card.name);
    });
  }, [items, show, rarity, vibe, sort, query]);

  const select = "min-h-10 w-full min-w-0 truncate rounded-full border-2 border-ink bg-surface px-2.5 text-xs font-bold sm:text-sm";

  return (
    <div className="grid gap-5">
      <div className="rounded-2xl border-2 border-ink bg-surface p-4">
        <p className="flex items-baseline justify-between font-extrabold">
          <span>{t("progress", { owned, total: items.length })}</span>
          <span className="text-ink-soft">{format.number(percent / 100, { style: "percent" })}</span>
        </p>
        <div className="mm-stat-bar mt-2" aria-hidden="true">
          <span style={{ width: `${Math.max(percent, 1)}%`, ["--bar" as string]: "#2d5bff" }} />
        </div>
      </div>

      <div className="grid gap-2.5">
        <div role="radiogroup" aria-label={t("showLabel")} className="flex rounded-full border-2 border-ink bg-surface p-1">
          {(["all", "owned", "missing"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={show === s}
              onClick={() => setShow(s)}
              className={`min-h-9 flex-1 rounded-full px-2 text-xs font-bold sm:text-sm ${show === s ? "bg-ink text-surface" : "text-ink-soft hover:text-ink"}`}
            >
              {t(`show.${s}`)}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            aria-label={t("search")}
            className="col-span-3 min-h-10 min-w-0 rounded-full border-2 border-ink bg-surface px-4 text-sm sm:col-span-1"
          />
          <select aria-label={t("rarityLabel")} value={rarity} onChange={(e) => setRarity(e.target.value as Rarity | "all")} className={select}>
            <option value="all">{t("rarityAll")}</option>
            {RARITIES.map((r) => (
              <option key={r} value={r}>
                {tr(r)}
              </option>
            ))}
          </select>
          <select aria-label={t("vibeLabel")} value={vibe} onChange={(e) => setVibe(e.target.value as Vibe | "all")} className={select}>
            <option value="all">{t("vibeAll")}</option>
            {VIBES.map((v) => (
              <option key={v} value={v}>
                {tv(v)}
              </option>
            ))}
          </select>
          <select aria-label={t("sortLabel")} value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={select}>
            {(["rarity", "name", "recent", "quantity"] as const).map((s) => (
              <option key={s} value={s}>
                {t(`sort.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {owned > 0 ? (
        <BulkSell
          items={items.map((i) => ({ cardId: i.card.id, rarity: i.card.rarity, quantity: i.quantity }))}
          resaleLeftCents={resaleLeftCents}
        />
      ) : null}

      {owned === 0 ? <p className="rounded-2xl bg-sticker px-4 py-3 text-center font-bold text-[#1a1238]">{t("firstBooster")}</p> : null}
      {visible.length === 0 ? (
        <p className="py-6 text-center text-ink-soft">{t("empty")}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {visible.map(({ card, quantity, level }) => (
            <li key={card.id} className="relative">
              <InteractiveCard
                card={card}
                size="compact"
                owned={quantity > 0}
                level={level}
                detail={<DuplicateActions card={card} quantity={quantity} level={level} resaleLeftCents={resaleLeftCents} />}
              />
              {quantity > 1 ? (
                <span className="pointer-events-none absolute -end-1.5 -top-1.5 z-20 rounded-full border-2 border-ink bg-sticker px-2 text-xs font-extrabold text-[#1a1238]">
                  {t("quantity", { count: quantity })}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
