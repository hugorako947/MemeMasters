import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TrainingLauncher } from "@/components/match/TrainingLauncher";
import { requireAdmin } from "@/lib/server/auth";
import { getCollection } from "@/lib/server/cards";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("match"))("title") };
}

/**
 * Page de partie, plein écran et hors du cadre du jeu (conception §12) : pour l'instant le mode Entraînement.
 * Réservée à l'équipe (admins et Super Admin) jusqu'à l'ouverture du Battle Royale (phase 5) ; pour les autres
 * joueurs, elle « n'existe pas » (404).
 */
export default async function MatchPage() {
  const { player } = await requireAdmin();
  const collection = await getCollection(player.id);
  return (
    <TrainingLauncher
      player={{ name: player.username, trophies: player.trophies }}
      owned={collection.filter((e) => e.quantity > 0).map((e) => ({ card: e.card, level: e.level }))}
      cards={collection.map((e) => e.card)}
    />
  );
}
