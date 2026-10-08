"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState, type AnimationEvent, type ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CheckboxField, Field, FormMessage, RequiredNote } from "@/components/ui/Field";
import { PasswordChecklist } from "@/components/ui/PasswordChecklist";
import { PasswordField } from "@/components/ui/PasswordField";
import { useDeviceTimeZone } from "@/lib/client/use-device-timezone";
import { looksLikeEmail, PASSWORD_MAX, passwordIsStrong } from "@/lib/validation/auth";
import { usernameProblem } from "@/lib/validation/username";
import {
  forgotPasswordAction,
  newPasswordAction,
  signInAction,
  signUpAction,
  type AuthFormState,
} from "./actions";
import { GoogleButton } from "./GoogleButton";

const IDLE: AuthFormState = { status: "idle" };

function ErrorMessage({ state }: { state: AuthFormState }) {
  const t = useTranslations("errors");
  if (state.status !== "error") return null;
  return <FormMessage tone="error">{t(state.code as "server_error")}</FormMessage>;
}

function Divider() {
  const t = useTranslations("auth");
  return (
    <div className="flex items-center gap-3 text-sm font-semibold text-ink-soft" aria-hidden="true">
      <span className="h-0.5 flex-1 bg-line" />
      {t("or")}
      <span className="h-0.5 flex-1 bg-line" />
    </div>
  );
}

const linkClass = "font-semibold text-link underline underline-offset-4 hover:text-candy-ink";

/** Lien vers un texte légal, ouvert dans un nouvel onglet pour ne pas perdre le formulaire. */
function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener" className={linkClass}>
      {children}
    </a>
  );
}

// ---------------------------------------------------------------------------
// Connexion
// ---------------------------------------------------------------------------

export function SignInForm({ next, notice }: { next: string; notice?: string | null }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(signInAction, IDLE);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Remplissage automatique du navigateur : les valeurs ne sont lisibles qu'après
  // une interaction, mais le bouton doit déjà s'allumer.
  const [autofilled, setAutofilled] = useState(false);
  const onAutofill = (e: AnimationEvent<HTMLInputElement>) => {
    if (e.animationName === "mm-autofill") setAutofilled(true);
  };
  const ready = autofilled || (looksLikeEmail(email) && password.length > 0);

  return (
    <div className="grid gap-5">
      {notice ? <FormMessage tone="error">{notice}</FormMessage> : null}
      <GoogleButton next={next} />
      <Divider />
      <form action={action} className="grid gap-4" noValidate>
        <input type="hidden" name="suivant" value={next} />
        <RequiredNote>{t("requiredNote")}</RequiredNote>
        <Field
          label={t("email")}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onAnimationStart={onAutofill}
          required
        />
        <PasswordField
          label={t("password")}
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onAnimationStart={onAutofill}
          required
        />
        <ErrorMessage state={state} />
        <Button type="submit" disabled={!ready || pending}>
          {pending ? t("pending") : t("submitSignIn")}
        </Button>
      </form>
      <div className="flex flex-col items-center gap-2 text-center text-sm">
        <Link href="/mot-de-passe-oublie" className={linkClass}>
          {t("forgot")}
        </Link>
        <p>
          {t("noAccount")}{" "}
          <Link href="/inscription" className={linkClass}>
            {t("signUpLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inscription
// ---------------------------------------------------------------------------

type Availability = "idle" | "checking" | "available" | "taken";

/** Vérifie en direct qu'un pseudo est libre (400 ms après la dernière frappe). */
export function useUsernameAvailability(username: string): Availability {
  const [check, setCheck] = useState<{ name: string; result: "available" | "taken" | "unknown" } | null>(null);
  const valid = username.length > 0 && usernameProblem(username) === null;

  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/username?u=${encodeURIComponent(username)}`, { signal: controller.signal });
        if (!res.ok) return setCheck({ name: username, result: "unknown" });
        const body = (await res.json()) as { available: boolean };
        setCheck({ name: username, result: body.available ? "available" : "taken" });
      } catch {
        // Requête annulée ou réseau absent : le serveur revérifie à l'envoi.
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [username, valid]);

  if (!valid) return "idle";
  if (check?.name !== username) return "checking";
  return check.result === "unknown" ? "idle" : check.result;
}

/** Champ pseudo avec vérification de disponibilité (partagé avec /bienvenue). */
export function UsernameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations("auth");
  const te = useTranslations("errors");
  const availability = useUsernameAvailability(value);
  const problem = value ? usernameProblem(value) : null;
  const error = problem ? te(`username_${problem}`) : availability === "taken" ? te("username_taken") : null;
  const hint =
    availability === "checking" ? t("checking") : availability === "available" ? `✓ ${t("available")}` : t("usernameHint");
  return (
    <Field
      label={t("username")}
      name="username"
      value={value}
      onChange={(e) => onChange(e.target.value.trim())}
      autoComplete="nickname"
      autoCapitalize="none"
      spellCheck={false}
      maxLength={20}
      hint={hint}
      error={value ? error : null}
      required
    />
  );
}

/** Cases d'attestation de majorité et d'acceptation des conditions (partagées avec /bienvenue). */
export function ConsentFields({
  adult,
  terms,
  onAdult,
  onTerms,
}: {
  adult: boolean;
  terms: boolean;
  onAdult: (v: boolean) => void;
  onTerms: (v: boolean) => void;
}) {
  const t = useTranslations("auth");
  return (
    <div className="grid gap-3 rounded-xl border-2 border-line bg-surface p-4">
      <CheckboxField name="adult" checked={adult} onChange={onAdult} required>
        {t("adultLabel")}
      </CheckboxField>
      <CheckboxField name="terms" checked={terms} onChange={onTerms} required>
        {t.rich("termsLabel", {
          terms: (c) => <LegalLink href="/conditions-utilisation">{c}</LegalLink>,
          community: (c) => <LegalLink href="/regles-communaute">{c}</LegalLink>,
          legal: (c) => <LegalLink href="/mentions-legales">{c}</LegalLink>,
          privacy: (c) => <LegalLink href="/confidentialite">{c}</LegalLink>,
        })}
      </CheckboxField>
    </div>
  );
}

export function SignUpForm() {
  const t = useTranslations("auth");
  const te = useTranslations("errors");
  const [state, action, pending] = useActionState(signUpAction, IDLE);
  const timezone = useDeviceTimeZone("Europe/Paris");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const availability = useUsernameAvailability(username);

  const mismatch = confirm.length > 0 && confirm !== password;
  const ready =
    usernameProblem(username) === null &&
    availability !== "taken" &&
    looksLikeEmail(email) &&
    passwordIsStrong(password) &&
    confirm === password &&
    adult &&
    terms;

  if (state.status === "check_email") {
    return (
      <div className="grid gap-4">
        <h2 className="font-display text-3xl">{t("checkEmailTitle")}</h2>
        <p className="text-ink-soft">{t("checkEmailLead", { email: state.email })}</p>
        <ButtonLink href="/connexion" variant="secondary">
          {t("backToSignIn")}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <GoogleButton next="/bienvenue" />
      <Divider />
      <form action={action} className="grid gap-4" noValidate>
        <input type="hidden" name="timezone" value={timezone} />
        <RequiredNote>{t("requiredNote")}</RequiredNote>
        <UsernameField value={username} onChange={setUsername} />
        <Field
          label={t("email")}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={email && !looksLikeEmail(email) ? te("invalid_email") : null}
          required
        />
        <PasswordField
          label={t("password")}
          name="password"
          autoComplete="new-password"
          maxLength={PASSWORD_MAX}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={<PasswordChecklist password={password} />}
          required
        />
        <PasswordField
          label={t("confirmPassword")}
          name="confirm"
          autoComplete="new-password"
          maxLength={PASSWORD_MAX}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          hint={confirm && !mismatch ? `✓ ${t("passwordsMatch")}` : undefined}
          error={mismatch ? te("password_mismatch") : null}
          required
        />
        <ConsentFields adult={adult} terms={terms} onAdult={setAdult} onTerms={setTerms} />
        <ErrorMessage state={state} />
        <Button type="submit" disabled={!ready || pending}>
          {pending ? t("pending") : t("submitSignUp")}
        </Button>
      </form>
      <p className="text-center text-sm">
        {t("haveAccount")}{" "}
        <Link href="/connexion" className={linkClass}>
          {t("signInLink")}
        </Link>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mot de passe oublié / nouveau mot de passe
// ---------------------------------------------------------------------------

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(forgotPasswordAction, IDLE);
  const [email, setEmail] = useState("");
  if (state.status === "sent") {
    return (
      <div className="grid gap-4">
        <FormMessage tone="success">{t("forgotSent")}</FormMessage>
        <ButtonLink href="/connexion" variant="secondary">
          {t("backToSignIn")}
        </ButtonLink>
      </div>
    );
  }
  return (
    <form action={action} className="grid gap-4" noValidate>
      <RequiredNote>{t("requiredNote")}</RequiredNote>
      <Field
        label={t("email")}
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <ErrorMessage state={state} />
      <Button type="submit" disabled={!looksLikeEmail(email) || pending}>
        {pending ? t("pending") : t("forgotSubmit")}
      </Button>
    </form>
  );
}

export function NewPasswordForm() {
  const t = useTranslations("auth");
  const te = useTranslations("errors");
  const [state, action, pending] = useActionState(newPasswordAction, IDLE);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm.length > 0 && confirm !== password;
  if (state.status === "done") {
    return (
      <div className="grid gap-4">
        <FormMessage tone="success">{t("resetDone")}</FormMessage>
        <ButtonLink href="/">{t("continue")}</ButtonLink>
      </div>
    );
  }
  return (
    <form action={action} className="grid gap-4" noValidate>
      <RequiredNote>{t("requiredNote")}</RequiredNote>
      <PasswordField
        label={t("newPassword")}
        name="password"
        autoComplete="new-password"
        maxLength={PASSWORD_MAX}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        hint={<PasswordChecklist password={password} />}
        required
      />
      <PasswordField
        label={t("confirmPassword")}
        name="confirm"
        autoComplete="new-password"
        maxLength={PASSWORD_MAX}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={mismatch ? te("password_mismatch") : null}
        required
      />
      <ErrorMessage state={state} />
      <Button type="submit" disabled={!passwordIsStrong(password) || confirm !== password || pending}>
        {pending ? t("pending") : t("resetSubmit")}
      </Button>
    </form>
  );
}
