import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { InteractiveCard } from "@/components/card/InteractiveCard";
import { RarityShowcase } from "@/components/card/RarityShowcase";
import { SAMPLE_CARDS } from "@/components/card/sample-cards";
import { FeatureShowcase } from "@/components/home/FeatureShowcase";
import { PublicShell } from "@/components/layout/PublicShell";
import { PlayOnPhone } from "@/components/install/PlayOnPhone";
import { GAME_CONFIG } from "@/config/game.config";
import { AppShell } from "@/components/layout/AppShell";
import { PlayerFeatures } from "@/components/player/PlayerFeatures";
import { ButtonLink } from "@/components/ui/Button";
import { getAuthUser } from "@/lib/server/auth";
import { getBoosterState } from "@/lib/server/boosters";
import { getCollection } from "@/lib/server/cards";
import { resaleLeftCents } from "@/lib/server/duplicates";
import { getPlayer } from "@/lib/server/players";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const user = await getAuthUser();
  if (!user) return <GuestHome />;
  const player = await getPlayer(user.id);
  if (!player || !player.consentUpToDate) redirect("/bienvenue");
  const { vue } = await searchParams;
  const [collection, boosters, resaleLeft] = await Promise.all([getCollection(player.id), getBoosterState(player), resaleLeftCents(player)]);
  return (
    <AppShell player={player}>
      <div className="grid gap-6">
        <h1 className="font-display text-4xl leading-none md:text-5xl">{(await getTranslations("playerHome"))("title", { username: player.username })}</h1>
        <PlayerFeatures player={player} collection={collection} boosters={boosters} resaleLeftCents={resaleLeft} initial={typeof vue === "string" ? vue : undefined} />
      </div>
    </AppShell>
  );
}

const byRarity = (rarity: string) => SAMPLE_CARDS.find((c) => c.rarity === rarity)!;

/**
 * Accueil des visiteurs : titre géant, boutons, éventail de cartes, raretés
 * sur le côté et les trois piliers du jeu illustrés.
 */
async function GuestHome() {
  const t = await getTranslations("home");
  const fan = [byRarity("epique"), byRarity("godlevel"), byRarity("legendaire")];
  return (
    <PublicShell hideLogo back={false}>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
        <div className="grid content-start gap-14">
          <section>
            <h1 className="meme-caption -rotate-2 text-[clamp(3.4rem,14vw,7.5rem)] leading-[0.9]">
              {GAME_CONFIG.GAME_NAME}
            </h1>
            <div className="mt-6 grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <p className="max-w-md text-xl font-medium text-ink-soft">{t("guestLead")}</p>
                <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                  <ButtonLink href="/connexion" className="sm:min-w-44">
                    {t("signIn")}
                  </ButtonLink>
                  <ButtonLink href="/inscription" variant="secondary" className="sm:min-w-44">
                    {t("createAccount")}
                  </ButtonLink>
                </div>
                <div className="mt-6">
                  <PlayOnPhone />
                </div>
                <ButtonLink href="/contact" variant="ghost" className="mt-3">
                  {t("contact")}
                </ButtonLink>
              </div>

              {/* L'éventail : touche une carte pour ouvrir sa fiche. */}
              <div className="relative mx-auto h-[18.5rem] w-full max-w-[21rem] md:h-[24rem]">
                <div className="absolute left-0 top-10 w-[46%] -rotate-[11deg]">
                  <InteractiveCard card={fan[0]} size="compact" />
                </div>
                <div className="absolute right-0 top-10 w-[46%] rotate-[10deg]">
                  <InteractiveCard card={fan[2]} size="compact" />
                </div>
                <div className="absolute left-1/2 top-0 z-10 w-[58%] -translate-x-1/2">
                  <InteractiveCard card={fan[1]} />
                </div>
              </div>
            </div>
          </section>

          <RarityShowcase className="lg:hidden" />
          <FeatureShowcase />
        </div>

        <div className="hidden lg:block">
          <RarityShowcase />
        </div>
      </div>
    </PublicShell>
  );
}

