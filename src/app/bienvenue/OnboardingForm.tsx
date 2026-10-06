"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage } from "@/components/ui/Field";
import { postJson } from "@/lib/client/api";
import { useDeviceTimeZone } from "@/lib/client/use-device-timezone";
import { usernameProblem } from "@/lib/validation/username";

type Availability = "idle" | "checking" | "available" | "taken";

export function OnboardingForm() {
  const t = useTranslations("onboarding");
  const te = useTranslations("errors");
  const router = useRouter();
  const [username, setUsername] = useState("");
  const timezone = useDeviceTimeZone("Europe/Paris");
  // Dernier résultat de vérification, associé au pseudo vérifié.
  const [check, setCheck] = useState<{ name: string; result: "available" | "taken" | "unknown" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const localProblem = username.length > 0 ? usernameProblem(username) : null;

  const availability: Availability =
    !username || localProblem
      ? "idle"
      : check?.name !== username
        ? "checking"
        : check.result === "unknown"
          ? "idle"
          : check.result;

  // Vérification de disponibilité, 400 ms après la dernière frappe.
  useEffect(() => {
    if (!username || localProblem) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/username?u=${encodeURIComponent(username)}`, { signal: controller.signal });
        if (!res.ok) return setCheck({ name: username, result: "unknown" });
        const body = (await res.json()) as { available: boolean };
        setCheck({ name: username, result: body.available ? "available" : "taken" });
      } catch {
        // Requête annulée ou réseau absent : la vérification finale se fera à l'envoi.
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [username, localProblem]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (localProblem) return setError(te(`username_${localProblem}`));
    setPending(true);
    setError(null);
    const result = await postJson("/api/onboarding", { username, timezone });
    if (result.ok) {
      router.replace("/");
      router.refresh();
      return;
    }
    setPending(false);
    setError(te(result.code as "server_error"));
  }

  const hint =
    availability === "checking" ? t("checking") : availability === "available" ? `✓ ${t("available")}` : t("usernameHint");
  const fieldError = localProblem
    ? te(`username_${localProblem}`)
    : availability === "taken"
      ? te("username_taken")
      : null;

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <Field
        label={t("username")}
        name="username"
        value={username}
        onChange={(e) => setUsername(e.target.value.trim())}
        autoComplete="nickname"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={20}
        hint={hint}
        error={username ? fieldError : null}
        required
      />
      <div className="rounded-xl border-2 border-line bg-surface px-4 py-3 text-sm">
        <p className="font-semibold">{t("timezone", { timezone })}</p>
        <p className="mt-1 text-ink-soft">{t("timezoneHint")}</p>
      </div>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Button type="submit" disabled={pending || !username || Boolean(fieldError)}>
        {pending ? "…" : t("submit")}
      </Button>
    </form>
  );
}
