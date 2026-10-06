import Link from "next/link";
import { GAME_CONFIG } from "@/config/game.config";

/** Logo typographique : nom du jeu en légende de meme. */
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const cls = size === "lg" ? "text-4xl" : "text-2xl";
  return (
    <Link href="/" className={`meme-caption ${cls} -rotate-2 inline-block`} aria-label={`${GAME_CONFIG.GAME_NAME}, accueil`}>
      {GAME_CONFIG.GAME_NAME}
    </Link>
  );
}
