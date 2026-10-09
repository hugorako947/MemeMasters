"use client";

import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { canPromptInstall, isInstalled, promptInstall, subscribeInstall } from "@/lib/pwa/install-prompt";
import { detectPlatform, type InstallPlatform } from "@/lib/pwa/detect";

/**
 * Instructions d'installation, adaptées à l'appareil : seules celles qui
 * marchent sur ce téléphone ou cet ordinateur sont affichées.
 */
export function InstallGuide({ serverPlatform, qr }: { serverPlatform: InstallPlatform; qr: ReactNode }) {
  const t = useTranslations("installer");
  // Côté navigateur, on affine la détection du serveur (un iPad se présente comme un Mac).
  const platform = useSyncExternalStore(
    subscribeInstall,
    () => detectPlatform(navigator.userAgent, navigator.maxTouchPoints),
    () => serverPlatform,
  );
  const [copied, setCopied] = useState(false);
  const canPrompt = useSyncExternalStore(subscribeInstall, canPromptInstall, () => false);
  const installed = useSyncExternalStore(subscribeInstall, isInstalled, () => false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/installer`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (installed) {
    return <Box title={t("installed.title")} tone="success">{t("installed.text")}</Box>;
  }

  const copy = (
    <Button type="button" variant="secondary" onClick={copyLink}>
      {copied ? `✓ ${t("copied")}` : t("copyLink")}
    </Button>
  );

  switch (platform) {
    case "android":
    case "desktop-chromium":
      return (
        <Box title={t(platform === "android" ? "android.title" : "desktop.title")}>
          {canPrompt ? (
            <Button type="button" onClick={() => promptInstall()} className="justify-self-start px-8">
              {t("installButton")}
            </Button>
          ) : (
            <Steps steps={[{ icon: <MenuIcon />, text: t("android.step1") }, { icon: <PlusIcon />, text: t("android.step2") }]} />
          )}
          {platform === "desktop-chromium" ? <PhoneQr qr={qr} text={t("desktop.phone")} /> : null}
        </Box>
      );
    case "ios-safari":
      return (
        <Box title={t("ios.title")}>
          <Steps
            steps={[
              { icon: <ShareIcon />, text: t("ios.step1") },
              { icon: <PlusIcon />, text: t("ios.step2") },
              { icon: <CheckIcon />, text: t("ios.step3") },
            ]}
          />
        </Box>
      );
    case "ios-other":
      return (
        <Box title={t("iosOther.title")}>
          <Steps steps={[{ icon: <ShareIcon />, text: t("iosOther.step1") }, { icon: <PlusIcon />, text: t("iosOther.step2") }]} />
          <p className="text-sm text-ink-soft">{t("iosOther.fallback")}</p>
          {copy}
        </Box>
      );
    case "in-app":
      return (
        <Box title={t("inApp.title")}>
          <Steps steps={[{ icon: <MenuIcon />, text: t("inApp.step1") }, { icon: <CheckIcon />, text: t("inApp.step2") }]} />
          {copy}
        </Box>
      );
    default:
      return (
        <Box title={t("other.title")}>
          <PhoneQr qr={qr} text={t("other.text")} />
        </Box>
      );
  }
}

function Box({ title, tone, children }: { title: string; tone?: "success"; children: ReactNode }) {
  return (
    <section
      className={`grid gap-4 rounded-[1.75rem] border-2 p-5 shadow-[0_3px_0_0_var(--mm-shadow)] sm:p-6 ${
        tone === "success" ? "border-success bg-surface" : "border-ink bg-surface"
      }`}
    >
      <h2 className="font-display text-3xl leading-none">{title}</h2>
      {children}
    </section>
  );
}

function Steps({ steps }: { steps: Array<{ icon: ReactNode; text: string }> }) {
  return (
    <ol className="grid gap-3">
      {steps.map((s, i) => (
        <li key={i} className="flex items-center gap-4 rounded-2xl bg-paper p-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-candy font-display text-lg text-[var(--mm-accent-ink)]">{i + 1}</span>
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border-2 border-ink bg-surface text-ink" aria-hidden="true">
            {s.icon}
          </span>
          <span className="font-semibold">{s.text}</span>
        </li>
      ))}
    </ol>
  );
}

function PhoneQr({ qr, text }: { qr: ReactNode; text: string }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-paper p-4">
      {qr}
      <p className="min-w-40 flex-1 font-semibold">{text}</p>
    </div>
  );
}

const icon = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const ShareIcon = () => (
  <svg {...icon}>
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
  </svg>
);
const PlusIcon = () => (
  <svg {...icon}>
    <rect x="4" y="4" width="16" height="16" rx="4" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);
const MenuIcon = () => (
  <svg {...icon}>
    <circle cx="12" cy="5" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="19" r="1.2" fill="currentColor" />
  </svg>
);
const CheckIcon = () => (
  <svg {...icon}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </svg>
);
