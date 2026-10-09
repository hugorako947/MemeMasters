"use client";

import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { MemeCoin } from "@/components/player/RankBadge";
import { FormMessage } from "@/components/ui/Field";
import { planBulkSale, type BulkItem } from "@/lib/economy/duplicates";
import { postJson } from "@/lib/client/api";

/** « Revendre mes doublons » : aperçu du total, puis confirmation. Un exemplaire de chaque carte est gardé. */
export function BulkSell({ items, resaleLeftCents }: { items: BulkItem[]; resaleLeftCents: number }) {
  const t = useTranslations("dup.bulk");
  const te = useTranslations("errors");
  const format = useFormatter();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const plan = useMemo(() => planBulkSale(items, resaleLeftCents), [items, resaleLeftCents]);
  const cards = plan.lines.reduce((n, l) => n + l.count, 0);
  const money = (cents: number) => format.number(cents / 100, { maximumFractionDigits: 2 });

  async function confirm() {
    setPending(true);
    const res = await postJson<{ cents: number }>("/api/collection/sell", { lines: plan.lines });
    setPending(false);
    setOpen(false);
    if (res.ok) {
      setMessage({ tone: "success", text: t("done", { amount: money(res.data.cents) }) });
      router.refresh();
    } else {
      setMessage({ tone: "error", text: te(res.code as "server_error") });
    }
  }

  return (
    <div className="grid gap-2">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} disabled={cards === 0} className="mm-btn mm-btn--secondary min-h-10 justify-self-start gap-1.5 px-4 text-sm">
          <MemeCoin /> {cards === 0 ? t("none") : t("button")}
        </button>
      ) : (
        <div className="grid gap-3 rounded-2xl border-2 border-ink bg-sticker p-4 text-[#1a1238]">
          <p className="font-extrabold">{t("summary", { cards, amount: money(plan.cents) })}</p>
          <p className="text-sm">{t("note")}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={confirm} disabled={pending} className="mm-btn mm-btn--primary min-h-10 px-4 text-sm">
              {t("confirm")}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="mm-btn mm-btn--secondary min-h-10 px-4 text-sm">
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
    </div>
  );
}
