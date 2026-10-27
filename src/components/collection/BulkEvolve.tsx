"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { FormMessage } from "@/components/ui/Field";
import { toast } from "@/components/ui/Toast";
import { planBulkUpgrade, type UpgradeItem } from "@/lib/economy/duplicates";
import { postJson } from "@/lib/client/api";
import { useErrorText } from "@/lib/client/errors";

/**
 * « Tout faire évoluer » : chaque carte monte aussi haut que ses exemplaires en trop le permettent (★, ★★, ★★★, puis
 * Divine). Aperçu calculé ici, puis confirmation ; le serveur refait le calcul et décide.
 */
export function BulkEvolve({ items }: { items: UpgradeItem[] }) {
  const t = useTranslations("dup.evolveAll");
  const errorText = useErrorText();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const plan = useMemo(() => planBulkUpgrade(items), [items]);

  async function confirm() {
    setPending(true);
    const res = await postJson<{ evolutions: number }>("/api/collection/upgrade-all", {});
    setPending(false);
    setOpen(false);
    if (res.ok) {
      setMessage({ tone: "success", text: t("done", { count: res.data.evolutions }) });
      toast.success(t("done", { count: res.data.evolutions }));
      router.refresh();
    } else {
      setMessage({ tone: "error", text: errorText(res.code) });
    }
  }

  return (
    <div className="mm-online-only grid gap-2">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} disabled={plan.lines.length === 0} className="mm-btn mm-btn--secondary min-h-10 justify-self-start gap-1.5 px-4 text-sm">
          <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden="true">
            <path d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" fill="#ffd23f" stroke="#1a1238" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
          {plan.lines.length === 0 ? t("none") : t("button")}
        </button>
      ) : (
        <div className="grid gap-3 rounded-2xl border-2 border-ink bg-sticker p-4 text-[#1a1238]">
          <p className="font-extrabold">{t("summary", { cards: plan.lines.length, evolutions: plan.evolutions, copies: plan.used })}</p>
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
