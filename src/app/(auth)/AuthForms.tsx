"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, FormMessage } from "@/components/ui/Field";
import { PASSWORD_MIN } from "@/lib/validation/auth";
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

export function SignInForm({ next, notice }: { next: string; notice?: string | null }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(signInAction, IDLE);
  return (
    <div className="grid gap-5">
      {notice ? <FormMessage tone="error">{notice}</FormMessage> : null}
      <GoogleButton next={next} />
      <Divider />
      <form action={action} className="grid gap-4" noValidate>
        <input type="hidden" name="suivant" value={next} />
        <Field label={t("email")} name="email" type="email" autoComplete="email" inputMode="email" required />
        <Field label={t("password")} name="password" type="password" autoComplete="current-password" required />
        <ErrorMessage state={state} />
        <Button type="submit" disabled={pending}>
          {pending ? t("pending") : t("submitSignIn")}
        </Button>
      </form>
      <div className="flex flex-col gap-2 text-sm">
        <Link href="/mot-de-passe-oublie" className="font-semibold text-link underline-offset-4 hover:underline">
          {t("forgot")}
        </Link>
        <p>
          {t("noAccount")}{" "}
          <Link href="/inscription" className="font-semibold text-link underline-offset-4 hover:underline">
            {t("signUpTitle")}
          </Link>
        </p>
      </div>
    </div>
  );
}

export function SignUpForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(signUpAction, IDLE);
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
        <Field label={t("email")} name="email" type="email" autoComplete="email" inputMode="email" required />
        <Field
          label={t("password")}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN}
          hint={t("passwordHint")}
          required
        />
        <ErrorMessage state={state} />
        <Button type="submit" disabled={pending}>
          {pending ? t("pending") : t("submitSignUp")}
        </Button>
      </form>
      <p className="text-sm">
        {t("haveAccount")}{" "}
        <Link href="/connexion" className="font-semibold text-link underline-offset-4 hover:underline">
          {t("signInTitle")}
        </Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(forgotPasswordAction, IDLE);
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
      <Field label={t("email")} name="email" type="email" autoComplete="email" inputMode="email" required />
      <ErrorMessage state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? t("pending") : t("forgotSubmit")}
      </Button>
    </form>
  );
}

export function NewPasswordForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(newPasswordAction, IDLE);
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
      <Field
        label={t("newPassword")}
        name="password"
        type="password"
        autoComplete="new-password"
        hint={t("passwordHint")}
        required
      />
      <Field label={t("confirmPassword")} name="confirm" type="password" autoComplete="new-password" required />
      <ErrorMessage state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? t("pending") : t("resetSubmit")}
      </Button>
    </form>
  );
}
