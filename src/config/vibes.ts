/**
 * Les 6 vibes forment un cycle : chacune bat la suivante et perd contre la
 * précédente. L'ordre de ce tableau EST le cycle :
 * Chaos → Wholesome → Rage → Ironique → Cringe → Absurde → Chaos.
 */
export const VIBES = ["chaos", "wholesome", "rage", "ironique", "cringe", "absurde"] as const;

export type Vibe = (typeof VIBES)[number];

export type VibeMatchup = "advantage" | "neutral" | "weakness";

export function isVibe(value: unknown): value is Vibe {
  return typeof value === "string" && (VIBES as readonly string[]).includes(value);
}

/** La vibe que `vibe` bat. */
export function beats(vibe: Vibe): Vibe {
  return VIBES[(VIBES.indexOf(vibe) + 1) % VIBES.length];
}

/** La vibe qui bat `vibe`. */
export function beatenBy(vibe: Vibe): Vibe {
  return VIBES[(VIBES.indexOf(vibe) + VIBES.length - 1) % VIBES.length];
}

/** Relation entre la vibe d'un attaquant et celle de sa cible. */
export function matchup(attacker: Vibe, defender: Vibe): VibeMatchup {
  if (beats(attacker) === defender) return "advantage";
  if (beatenBy(attacker) === defender) return "weakness";
  return "neutral";
}

/** Emoji utilisé dans les pastilles de vibe (avec le nom écrit à côté). */
export const VIBE_EMOJI: Record<Vibe, string> = {
  chaos: "🌀",
  wholesome: "🌸",
  rage: "💢",
  ironique: "🙃",
  cringe: "😬",
  absurde: "🦆",
};
