import { RANK_COLORS, RANKS, type Rank } from "@/config/ranks";

/** Écusson de rang, aux couleurs du rang. Décoratif : le nom du rang est toujours écrit à côté. */
export function RankShield({ rank, size = 28 }: { rank: Rank; size?: number }) {
  const { fill, ink } = RANK_COLORS[rank];
  const tier = RANKS.indexOf(rank);
  const isTop = rank === "immortel";
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 40 46" aria-hidden="true" className="mm-keep-colors shrink-0">
      <path d="M20 2 37 8v14c0 11-7.5 18.5-17 22C10.5 40.5 3 33 3 22V8z" fill={fill} stroke="#1a1238" strokeWidth="3" strokeLinejoin="round" />
      <path d="M20 7 32 11.5V22c0 8-5 13.5-12 16.5" fill="none" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="2.5" strokeLinecap="round" />
      {isTop ? (
        <path d="m13 25 3.5-8 3.5 5 3.5-5 3.5 8z" fill={ink} stroke={ink} strokeWidth="1.5" strokeLinejoin="round" />
      ) : (
        <text x="20" y="29" textAnchor="middle" fontFamily="var(--font-display)" fontSize="16" fill={ink}>
          {tier + 1}
        </text>
      )}
    </svg>
  );
}

/** Icône de trophée. */
export function TrophyIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="mm-keep-colors shrink-0">
      <path d="M7 3h10v5a5 5 0 0 1-10 0z" fill="#ffd23f" stroke="#1a1238" strokeWidth="2" strokeLinejoin="round" />
      <path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" fill="none" stroke="#1a1238" strokeWidth="2" />
      <path d="M12 13v4M8 21h8l-1-4H9z" fill="#ffd23f" stroke="#1a1238" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/** Pièce de MemeMoney. */
export function MemeCoin({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`mm-coin mm-keep-colors ${className}`}>
      M
    </span>
  );
}
