import { cardArtDataUri } from "@/lib/art/generate";
import type { Card } from "@/lib/validation/card";

/**
 * Personnage du Battle Royale dessiné en SVG (illustrations de l'accueil) : l'illustration de la carte dans un
 * disque au contour de sa rareté, et une arme pointée dans la direction `angle` (en degrés, 0 = vers la droite).
 */
export function CharacterBubble({ card, x, y, r = 30, angle = 0, id }: { card: Card; x: number; y: number; r?: number; angle?: number; id: string }) {
  const art = card.imageUrl ?? cardArtDataUri({ seed: card.artSeed, rarity: card.rarity });
  const flip = Math.abs(((angle % 360) + 360) % 360 - 180) < 90;
  return (
    <g>
      <ellipse cx={x} cy={y + r + 6} rx={r * 0.85} ry={r * 0.2} fill="#1a1238" opacity="0.2" />
      {/* Arme : un pistolet tenu à côté du personnage, retourné quand il vise vers la gauche. */}
      <g transform={`translate(${x} ${y}) rotate(${angle})${flip ? " scale(1 -1)" : ""}`}>
        <g transform={`translate(${r * 0.6} ${r * 0.18})`}>
          <rect x="0" y={-r * 0.2} width={r * 1.3} height={r * 0.38} rx={r * 0.08} fill="#4b4f6b" stroke="#1a1238" strokeWidth={r * 0.07} />
          <rect x={r * 0.9} y={-r * 0.11} width={r * 0.65} height={r * 0.2} rx={r * 0.05} fill="#2f3247" stroke="#1a1238" strokeWidth={r * 0.06} />
          <path d={`M${r * 0.18} ${r * 0.16} L${r * 0.48} ${r * 0.16} L${r * 0.4} ${r * 0.66} L${r * 0.1} ${r * 0.66} Z`} fill="#3a3d55" stroke="#1a1238" strokeWidth={r * 0.07} strokeLinejoin="round" />
        </g>
      </g>
      <clipPath id={id}>
        <circle cx={x} cy={y} r={r} />
      </clipPath>
      <image href={art} x={x - r * 1.45} y={y - r * 1.25} width={r * 2.9} height={r * 2.32} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id})`} />
      <circle cx={x} cy={y} r={r} fill="none" stroke={`var(--color-r-${card.rarity})`} strokeWidth={r * 0.18} />
      <circle cx={x} cy={y} r={r * 1.12} fill="none" stroke="#1a1238" strokeWidth={r * 0.08} />
    </g>
  );
}
