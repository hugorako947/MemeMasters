"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import { toast } from "@/components/ui/Toast";
import { postJson } from "@/lib/client/api";
import { useErrorText } from "@/lib/client/errors";
import { useDeviceTimeZone } from "@/lib/client/use-device-timezone";

/**
 * Liste des fuseaux du navigateur. Elle diffère de celle du serveur (Node n'a pas la même
 * version des données) : on ne l'affiche qu'après l'affichage initial, sinon React signale
 * un écart d'hydratation (erreur n° 418).
 */
const noSubscription = () => () => undefined;
const NO_ZONES: string[] = [];
let browserZones: string[] | null = null;
function getBrowserZones(): string[] {
  browserZones ??= typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : NO_ZONES;
  return browserZones;
}

export function TimezoneForm({ current }: { current: string }) {
  const t = useTranslations("settings");
  const errorText = useErrorText();
  const router = useRouter();
  const device = useDeviceTimeZone(current);
  const [value, setValue] = useState(current);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  const all = useSyncExternalStore(noSubscription, getBrowserZones, () => NO_ZONES);
  const zones = useMemo(() => (all.includes(current) ? all : [current, ...all]), [all, current]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (value === current) return setMessage({ tone: "error", text: t("timezoneSame") });
    setPending(true);
    const result = await postJson("/api/settings/timezone", { timezone: value });
    setPending(false);
    if (result.ok) {
      setMessage({ tone: "success", text: t("timezoneSaved") });
      toast.success(t("timezoneSaved"));
      router.refresh();
    } else {
      setMessage({ tone: "error", text: errorText(result.code) });
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      {device !== current ? (
        <Button type="button" variant="ghost" className="justify-start px-0 text-link" onClick={() => setValue(device)}>
          {t("timezoneUseDevice", { timezone: device })}
        </Button>
      ) : null}
      <label htmlFor="timezone" className="text-sm font-bold">
        {t("timezoneSelect")}
      </label>
      <select
        id="timezone"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="min-h-12 rounded-xl border-2 border-ink bg-surface px-3 text-base"
      >
        {zones.map((z) => (
          <option key={z} value={z}>
            {z.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
      <Button type="submit" disabled={pending}>
        {t("timezoneSave")}
      </Button>
    </form>
  );
}
