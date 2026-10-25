"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { BR_WEAPONS } from "@/config/game.config";
import { ITEM } from "@/lib/br/map";
import { AMMO_KINDS } from "@/lib/br/rules";
import type { RosterEntry } from "@/lib/br-client/training";
import type { MatchSnapshot, Store } from "./match-store";

/** mm:ss, chiffres isolés pour l'arabe. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Nom affiché d'un objet au sol. */
export function useItemName() {
  const tw = useTranslations("battleRoyale.weapons");
  const ti = useTranslations("battleRoyale.items");
  const ta = useTranslations("match.hud.ammo");
  return (kind: number, sub: number): string => {
    if (kind === ITEM.weapon) return tw(BR_WEAPONS[sub] ?? BR_WEAPONS[0]);
    if (kind === ITEM.ammo) return ta((AMMO_KINDS[sub] ?? "light") as "light");
    return kind === ITEM.heal ? ti("heal") : ti("vest");
  };
}

/** Interface de partie : PV, survivants, zone, arme, capacité, objet à ramasser, fil des éliminations. */
export function Hud({ store, roster, me, touch }: { store: Store<MatchSnapshot | null>; roster: readonly RosterEntry[]; me: number; touch: boolean }) {
  const t = useTranslations("match.hud");
  const tm = useTranslations("match");
  const tf = useTranslations("match.feed");
  const tc = useTranslations("match.controls");
  const tw = useTranslations("battleRoyale.weapons");
  const itemName = useItemName();
  const snap = useSyncExternalStore(store.subscribe, store.get, store.get);
  if (!snap) return null;
  const { hud, pickup, feed } = snap;
  const hpRatio = hud.maxHp > 0 ? hud.hp / hud.maxHp : 0;
  const name = (slot: number) => (roster[slot]?.bot ? `${tm("bot")} · ${roster[slot].name}` : (roster[slot]?.name ?? "?"));
  const feedLine = (e: MatchSnapshot["feed"][number]) => {
    if (e.killer < 0 || e.killer === e.victim) return e.victim === me ? tf("zoneYou") : tf("zone", { victim: name(e.victim) });
    if (e.victim === me) return tf("killedYou", { killer: name(e.killer) });
    if (e.killer === me) return tf("youKilled", { victim: name(e.victim) });
    return tf("kill", { killer: name(e.killer), victim: name(e.victim) });
  };
  const zoneText = hud.zone.stage === 2 ? t("zoneClosed") : hud.zone.stage === 0 ? t("zoneWait", { time: clock(hud.zone.secondsLeft) }) : t("zoneShrink", { time: clock(hud.zone.secondsLeft) });

  return (
    <div className="pointer-events-none absolute inset-0 select-none text-ink">
      {/* PV bas : bord rouge (sans clignotement). */}
      {hud.alive && hpRatio < 0.3 ? <div className="absolute inset-0 shadow-[inset_0_0_80px_20px_var(--color-danger)] opacity-60" aria-hidden="true" /> : null}

      {/* En haut à gauche : PV et gilet, en chiffres et en barres. */}
      <div className="absolute left-3 top-3 grid w-44 gap-1 rounded-xl border-2 border-ink bg-surface/90 px-2.5 py-2 text-xs font-extrabold sm:w-52">
        <p className="flex justify-between">
          <span>{t("hp")}</span>
          <bdi dir="ltr">
            {hud.hp} / {hud.maxHp}
          </bdi>
        </p>
        <div className="h-2.5 overflow-hidden rounded-full border border-ink bg-paper">
          <div className={`h-full ${hpRatio < 0.3 ? "bg-danger" : "bg-success"}`} style={{ width: `${Math.round(hpRatio * 100)}%` }} />
        </div>
        {hud.shield > 0 ? (
          <p className="flex justify-between text-link">
            <span>{t("shield")}</span>
            <bdi dir="ltr">+{hud.shield}</bdi>
          </p>
        ) : null}
        {hud.stunned ? <p className="text-danger">{t("stunned")}</p> : null}
      </div>

      {/* En haut au centre : survivants, éliminations, minuterie du Scroll. */}
      <div className="absolute left-1/2 top-3 grid -translate-x-1/2 justify-items-center gap-1 text-center">
        <p className="flex gap-2 rounded-full border-2 border-ink bg-surface/90 px-3 py-1 text-sm font-extrabold">
          <span>{t("survivors", { count: hud.survivors })}</span>
          <span aria-hidden="true">·</span>
          <span>{t("kills", { count: hud.kills })}</span>
        </p>
        <p className="rounded-full border-2 border-ink bg-surface/90 px-3 py-0.5 text-xs font-bold">{zoneText}</p>
        {hud.alive && hud.zone.outside ? <p className="rounded-full border-2 border-ink bg-danger px-3 py-1 text-xs font-extrabold text-paper">{t("outside")}</p> : null}
      </div>

      {/* Fil des éliminations, sous la mini-carte. */}
      <ol className="absolute right-3 top-[9.5rem] grid w-56 justify-items-end gap-1 text-[0.7rem] font-bold sm:top-[11rem]">
        {feed.map((e) => (
          <li key={e.id} className={`rounded-lg border border-ink px-2 py-0.5 text-end ${e.killer === me || e.victim === me ? "bg-sticker" : "bg-surface/85"}`}>
            {feedLine(e)}
          </li>
        ))}
      </ol>

      {/* En bas (au centre sur ordinateur, en haut à gauche sous les PV sur téléphone) : arme, chargeur, capacité. */}
      <div className={`absolute grid gap-1 ${touch ? "left-3 top-[6.5rem] w-56" : "bottom-4 left-1/2 w-72 -translate-x-1/2"}`}>
        {!touch && pickup ? (
          <p className="justify-self-center rounded-full border-2 border-ink bg-sticker px-3 py-1 text-xs font-extrabold">
            {t("pickup", { item: itemName(pickup.kind, pickup.sub) })} · {tc("keysPickup")}
          </p>
        ) : null}
        <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 rounded-xl border-2 border-ink bg-surface/90 px-3 py-1.5 text-xs font-extrabold">
          <span className="truncate">{tw(BR_WEAPONS[hud.weapon] ?? BR_WEAPONS[0])}</span>
          <bdi dir="ltr" className="text-sm">
            {hud.magazine} / {hud.reserve === null ? "∞" : hud.reserve}
          </bdi>
          <span className="font-semibold text-ink-soft">{hud.reloading > 0 ? t("reloading") : hud.otherWeapon >= 0 ? `⇄ ${tw(BR_WEAPONS[hud.otherWeapon])}` : ""}</span>
          <span className={`rounded-full px-2 ${hud.abilityReady ? "bg-candy text-[var(--mm-accent-ink)]" : "bg-paper text-ink-soft"}`}>
            {t("ability")} · {hud.abilityReady ? t("abilityReady") : <bdi dir="ltr">{t("seconds", { count: hud.abilitySeconds })}</bdi>}
          </span>
        </div>
      </div>
    </div>
  );
}
