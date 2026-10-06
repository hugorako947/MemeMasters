import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/Logo";
import { MemeCard } from "@/components/card/MemeCard";
import { SAMPLE_CARDS } from "@/components/card/sample-cards";
import { AppShell } from "@/components/layout/AppShell";
import { ButtonLink } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { getAuthUser } from "@/lib/server/auth";
import { getPlayer, type Player } from "@/lib/server/players";

export default async function HomePage() {
  const user = await getAuthUser();
  if (!user) return <GuestHome />;
  const player = await getPlayer(user.id);
  if (!player) redirect("/bienvenue");
  return (
    <AppShell username={player.username}>
      <PlayerHome player={player} />
    </AppShell>
  );
}

const byRarity = (rarity: string) => SAMPLE_CARDS.find((c) => c.rarity === rarity)!;

async function GuestHome() {
  const t = await getTranslations("home");
  const fan = [byRarity("epique"), byRarity("godlevel"), byRarity("legendaire")];
  return (
    <div className="safe-top mx-auto flex min-h-dvh max-w-5xl flex-col px-5 pb-10 pt-6 md:px-8">
      <header>
        <Logo />
      </header>
      <main id="contenu" className="grid flex-1 items-center gap-10 py-8 md:grid-cols-[1.05fr_1fr] md:gap-6">
        <div className="order-2 md:order-1">
          <h1 className="font-display text-[2.9rem] leading-[0.95] tracking-tight text-balance md:text-7xl">
            {t("guestTitle")}
          </h1>
          <p className="mt-5 max-w-md text-lg text-ink-soft">{t("guestLead")}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/inscription">{t("createAccount")}</ButtonLink>
            <ButtonLink href="/connexion" variant="secondary">
              {t("signIn")}
            </ButtonLink>
          </div>
          <ButtonLink href="/raretes" variant="ghost" className="mt-4 px-0">
            {t("seeRarities")}
          </ButtonLink>
        </div>

        {/* L'éventail de cartes est le moment fort de l'accueil : touche-les. */}
        <div className="relative order-1 mx-auto h-[23rem] w-full max-w-[22rem] md:order-2 md:h-[30rem] md:max-w-[28rem]">
          <div className="absolute left-0 top-10 w-[46%] -rotate-[11deg]">
            <MemeCard card={fan[0]} size="compact" />
          </div>
          <div className="absolute right-0 top-10 w-[46%] rotate-[10deg]">
            <MemeCard card={fan[2]} size="compact" />
          </div>
          <div className="absolute left-1/2 top-0 z-10 w-[58%] -translate-x-1/2">
            <MemeCard card={fan[1]} />
          </div>
        </div>
      </main>
    </div>
  );
}

async function PlayerHome({ player }: { player: Player }) {
  const t = await getTranslations("home");
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-4xl leading-none md:text-5xl">{t("playerTitle", { username: player.username })}</h1>
        <p className="mt-3 max-w-prose text-ink-soft">{t("playerLead")}</p>
      </div>
      <Panel className="grid grid-cols-3 gap-2 text-center">
        <Stat label={t("statLevel")} value={player.level} />
        <Stat label={t("statElo")} value={player.elo} />
        <Stat label={t("statRecord")} value={player.wins} />
      </Panel>
      <div className="flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/raretes">{t("openRarities")}</ButtonLink>
        <ButtonLink href={`/profil/${encodeURIComponent(player.username)}`} variant="secondary">
          {t("openProfile")}
        </ButtonLink>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-display text-3xl leading-none">{value}</p>
      <p className="mt-1 text-sm font-semibold text-ink-soft">{label}</p>
    </div>
  );
}
