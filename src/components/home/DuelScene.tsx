import { getTranslations } from "next-intl/server";
import type { Card } from "@/lib/validation/card";
import { CharacterBubble } from "./CharacterBubble";

/** Illustration de la page Battle Royale : deux personnages qui se visent, une balle entre eux. */
export async function DuelScene({ left, right }: { left: Card; right: Card }) {
  const t = await getTranslations("playerHome.battles");
  return (
    <svg viewBox="0 0 360 140" role="img" aria-label={t("duelAlt")} className="mx-auto w-full max-w-sm">
      <CharacterBubble card={left} x={62} y={70} r={34} angle={0} id="mm-duel-left" />
      <CharacterBubble card={right} x={298} y={70} r={34} angle={180} id="mm-duel-right" />
      {/* Tir : éclair au bout du canon, une balle et sa traînée. */}
      <path d="M140 66 l9 10 l-9 10 l5 -10 Z" fill="#ffd23f" stroke="#1a1238" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M156 76 L200 76" stroke="#ffd23f" strokeWidth="5" strokeLinecap="round" opacity="0.85" />
      <circle cx="204" cy="76" r="5" fill="#ffffff" stroke="#1a1238" strokeWidth="2.5" />
    </svg>
  );
}
