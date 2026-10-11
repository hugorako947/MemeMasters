"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { InteractiveCard } from "@/components/card/InteractiveCard";
import { RARITIES, type Rarity } from "@/config/rarities";
import { boostedStats, type Level } from "@/lib/economy/duplicates";
import type { Card } from "@/lib/validation/card";
import { BulkSell } from "./BulkSell";
import { CardActions } from "./CardActions";

export interface CollectionItem {
  card: Card;
  quantity: number;
  level: Level;
  firstObtainedAt: string | null;
}

type Show = "all" | "owned" | "missing";
type Sort = "rarity" | "name" | "recent" | "quantity" | "total" | "hp" | "atk" | "def" | "spd" | "special";
const STAT_SORTS = ["total", "hp", "atk", "def", "spd", "special"] as const;
type StatSort = (typeof STAT_SORTS)[number];

/** Valeur d'une carte pour un tri par statistique (évolution comprise). */
function statValue(item: CollectionItem, sort: StatSort): number {
  const s = boostedStats(item.card, item.level);
  if (sort === "total") return s.hp + s.atk + s.def + s.spd;
  if (sort === "special") return item.card.specialAttack.power;
  return s[sort];
}

/**
 * La collection : progression, filtres simples et grille de cartes.
 * Les cartes manquantes restent floutées ; un clic ouvre la fiche de la carte.
 */
export function CollectionBrowser({ items, resaleLeftCents }: { items: CollectionItem[]; resaleLeftCents: number }) {
  const t = useTranslations("collection");
  const tr = useTranslations("rarity");
  const format = useFormatter();
  const [show, setShow] = useState<Show>("all");
  const [rarity, setRarity] = useState<Rarity | "all">("all");
  const [sort, setSort] = useState<Sort>("rarity");
  // Ordre du tri : décroissant (les meilleures d'abord) ou croissant.
  const [ascending, setAscending] = useState(false);
  const statSort = (STAT_SORTS as readonly string[]).includes(sort) ? (sort as StatSort) : null;
  const [query, setQuery] = useState("");

  const owned = items.filter((i) => i.quantity > 0).length;
  const percent = items.length ? Math.round((owned / items.length) * 100) : 0;

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const list = items.filter(
      (i) =>
        (show === "all" || (show === "owned" ? i.quantity > 0 : i.quantity === 0)) &&
        (rarity === "all" || i.card.rarity === rarity) &&
        (!q || i.card.name.toLocaleLowerCase().includes(q)),
    );
    const byRarity = (a: CollectionItem, b: CollectionItem) => RARITIES.indexOf(b.card.rarity) - RARITIES.indexOf(a.card.rarity);
    const dir = ascending ? -1 : 1;
    return [...list].sort((a, b) => {
      if (sort === "name") return dir * -a.card.name.localeCompare(b.card.name);
      if (statSort) return dir * (statValue(b, statSort) - statValue(a, statSort)) || byRarity(a, b);
      if (sort === "quantity") return dir * (b.quantity - a.quantity) || byRarity(a, b);
      if (sort === "recent") return dir * (b.firstObtainedAt ?? "").localeCompare(a.firstObtainedAt ?? "") || byRarity(a, b);
      return dir * byRarity(a, b) || a.card.name.localeCompare(b.card.name);
    });
  }, [items, show, rarity, sort, statSort, ascending, query]);

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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))]">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            aria-label={t("search")}
            className="col-span-2 min-h-10 min-w-0 rounded-full border-2 border-ink bg-surface px-4 text-sm sm:col-span-1"
          />
          <select aria-label={t("rarityLabel")} value={rarity} onChange={(e) => setRarity(e.target.value as Rarity | "all")} className={select}>
            <option value="all">{t("rarityAll")}</option>
            {RARITIES.map((r) => (
              <option key={r} value={r}>
                {tr(r)}
              </option>
            ))}
          </select>
          <div className="flex min-w-0 gap-1.5">
            <select aria-label={t("sortLabel")} value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={select}>
              <optgroup label={t("sortGeneral")}>
                {(["rarity", "name", "recent", "quantity"] as const).map((s) => (
                  <option key={s} value={s}>
                    {t(`sort.${s}`)}
                  </option>
                ))}
              </optgroup>
              <optgroup label={t("sortStats")}>
                {STAT_SORTS.map((s) => (
                  <option key={s} value={s}>
                    {t(`sort.${s}`)}
                  </option>
                ))}
              </optgroup>
            </select>
            <button
              type="button"
              onClick={() => setAscending((v) => !v)}
              aria-label={ascending ? t("orderAsc") : t("orderDesc")}
              title={ascending ? t("orderAsc") : t("orderDesc")}
              className="grid min-h-10 min-w-10 place-items-center rounded-full border-2 border-ink bg-surface text-base font-extrabold"
            >
              {ascending ? "↑" : "↓"}
            </button>
          </div>
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
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {visible.map(({ card, quantity, level }, index) => (
            <li key={card.id} className="relative grid gap-1">
              <InteractiveCard
                card={card}
                size="compact"
                owned={quantity > 0}
                level={level}
                quantity={quantity}
                actions={<CardActions card={card} quantity={quantity} level={level} resaleLeftCents={resaleLeftCents} />}
              />
              {statSort ? (
                <p className="flex items-center justify-between rounded-full bg-paper px-2.5 py-0.5 text-xs font-bold">
                  <span className="text-ink-soft">#{index + 1}</span>
                  <span>
                    {t(`statShort.${statSort}`)} <span className="font-display text-sm">{statValue({ card, quantity, level, firstObtainedAt: null }, statSort)}</span>
                  </span>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
