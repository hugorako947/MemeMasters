"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { ConsentFields, UsernameField, useUsernameAvailability } from "@/app/(auth)/AuthForms";
import { Button } from "@/components/ui/Button";
import { FormMessage, RequiredNote } from "@/components/ui/Field";
import { postJson } from "@/lib/client/api";
import { useDeviceTimeZone } from "@/lib/client/use-device-timezone";
import { usernameProblem } from "@/lib/validation/username";

/** Profil d'un compte Google : pseudo, majorité, conditions. */
export function OnboardingForm() {
  const t = useTranslations("onboarding");
  const ta = useTranslations("auth");
  const te = useTranslations("errors");
  const router = useRouter();
  const timezone = useDeviceTimeZone("Europe/Paris");
  const [username, setUsername] = useState("");
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const availability = useUsernameAvailability(username);
  const ready = usernameProblem(username) === null && availability !== "taken" && adult && terms;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setPending(true);
    setError(null);
    const result = await postJson("/api/onboarding", { username, timezone, adult, terms });
    if (result.ok) {
      router.replace("/");
      router.refresh();
      return;
    }
    setPending(false);
    setError(te(result.code as "server_error"));
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <RequiredNote>{ta("requiredNote")}</RequiredNote>
      <UsernameField value={username} onChange={setUsername} />
      <div className="rounded-xl border-2 border-line bg-surface px-4 py-3 text-sm">
        <p className="font-semibold">{t("timezone", { timezone })}</p>
        <p className="mt-1 text-ink-soft">{t("timezoneHint")}</p>
      </div>
      <ConsentFields adult={adult} terms={terms} onAdult={setAdult} onTerms={setTerms} />
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Button type="submit" disabled={!ready || pending}>
        {pending ? ta("pending") : t("submit")}
      </Button>
    </form>
  );
}

/** Nouvelle acceptation après une mise à jour des conditions. */
export function ConsentForm() {
  const t = useTranslations("onboarding");
  const ta = useTranslations("auth");
  const te = useTranslations("errors");
  const router = useRouter();
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!adult || !terms) return;
    setPending(true);
    const result = await postJson("/api/consent", { adult, terms });
    if (result.ok) {
      router.replace("/");
      router.refresh();
      return;
    }
    setPending(false);
    setError(te(result.code as "server_error"));
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <RequiredNote>{ta("requiredNote")}</RequiredNote>
      <ConsentFields adult={adult} terms={terms} onAdult={setAdult} onTerms={setTerms} />
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Button type="submit" disabled={!adult || !terms || pending}>
        {pending ? ta("pending") : t("consentSubmit")}
      </Button>
    </form>
  );
}
