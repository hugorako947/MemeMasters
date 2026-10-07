/** Première carte de démonstration de chaque rareté (vitrines). */
export function sampleOf(rarity: Card["rarity"]): Card {
  return SAMPLE_CARDS.find((c) => c.rarity === rarity)!;
}

/**
 * Cartes de démonstration (au moins une par rareté), pour l'accueil et la page
 * /raretes. Elles respectent le budget de stats (test : sample-cards.test.ts).
 * Le vrai jeu de 40 cartes est livré par le seed SQL (phase 2).
 */
import type { Card } from "@/lib/validation/card";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const SAMPLE_CARDS: readonly Card[] = [
  {
    id: id(1), slug: "lundi-matin", name: "Lundi Matin", rarity: "commune", vibe: "rage",
    description: "Il arrive chaque semaine. Personne ne l'a invité.",
    hp: 90, atk: 40, def: 35, spd: 80,
    normalAttack: { name: "Soupir lourd", power: 28 },
    specialAttack: { name: "Réveil brutal", power: 55, energyCost: 2, effect: { kind: "debuff", stat: "spd", stages: 1 } },
    defenseAbility: { name: "Café serré", effect: { kind: "heal", percent: 10 } },
    artSeed: 7311, imageUrl: null,
  },
  {
    id: id(2), slug: "mamie-wifi", name: "Mamie Wi-Fi", rarity: "rare", vibe: "wholesome",
    description: "Transfère chaque message à toute la famille, avec trois cœurs.",
    hp: 96, atk: 42, def: 38, spd: 80,
    normalAttack: { name: "Bisou sonore", power: 30 },
    specialAttack: { name: "Partage en chaîne", power: 60, energyCost: 3, effect: { kind: "multi", hits: 2, percent: 40 } },
    defenseAbility: { name: "Câlin réseau", effect: { kind: "heal", percent: 12 } },
    artSeed: 52, imageUrl: null,
  },
  {
    id: id(3), slug: "le-pigeon-philosophe", name: "Le Pigeon Philosophe", rarity: "epique", vibe: "absurde",
    description: "A lu un seul livre. L'a mangé.",
    hp: 100, atk: 46, def: 36, spd: 88,
    normalAttack: { name: "Coup de bec pensif", power: 30 },
    specialAttack: { name: "Et si tout était miettes", power: 65, energyCost: 3, effect: { kind: "stun", chance: 25 } },
    defenseAbility: { name: "Envol pensif", effect: { kind: "dodge", chance: 20 } },
    artSeed: 90210, imageUrl: null,
  },
  {
    id: id(4), slug: "le-stagiaire-en-pls", name: "Le Stagiaire en PLS", rarity: "rare", vibe: "cringe",
    description: "A cliqué sur « Répondre à tous ». Deux fois.",
    hp: 96, atk: 40, def: 40, spd: 80,
    normalAttack: { name: "Réponse à tous", power: 29 },
    specialAttack: { name: "Mail de 3 h du matin", power: 70, energyCost: 3, effect: { kind: "dot", percent: 8, turns: 2 } },
    defenseAbility: { name: "Excuses en boucle", effect: { kind: "cleanse" } },
    artSeed: 4242, imageUrl: null,
  },
  {
    id: id(5), slug: "le-chat-qui-juge", name: "Le Chat Qui Juge", rarity: "legendaire", vibe: "ironique",
    description: "T'a vu. N'a rien dit. N'en pense pas moins.",
    hp: 116, atk: 48, def: 38, spd: 80,
    normalAttack: { name: "Regard en coin", power: 31 },
    specialAttack: { name: "Clignement lent", power: 75, energyCost: 3, effect: { kind: "debuff", stat: "def", stages: 1 } },
    defenseAbility: { name: "Indifférence totale", effect: { kind: "reflect", percent: 30 } },
    artSeed: 1337, imageUrl: null,
  },
  {
    id: id(6), slug: "spirale-du-scroll-infini", name: "Spirale du Scroll Infini", rarity: "brainrot", vibe: "chaos",
    description: "« Encore une vidéo » depuis 2019.",
    hp: 116, atk: 50, def: 44, spd: 80,
    normalAttack: { name: "Swipe", power: 32 },
    specialAttack: { name: "Encore une vidéo", power: 80, energyCost: 4, effect: { kind: "drain", percent: 40 } },
    defenseAbility: { name: "Algorithme protecteur", effect: { kind: "recharge", amount: 1 } },
    artSeed: 2600, imageUrl: null,
  },
  {
    id: id(7), slug: "cerveau-en-puree-cosmique", name: "Cerveau en Purée Cosmique", rarity: "superbrainrot", vibe: "absurde",
    description: "Pense en sons de vidéos. Parle en sous-titres.",
    hp: 120, atk: 56, def: 42, spd: 84,
    normalAttack: { name: "Bruit de fond", power: 32 },
    specialAttack: { name: "Court-circuit total", power: 82, energyCost: 4, effect: { kind: "pierce", percent: 40 } },
    defenseAbility: { name: "Bug d'affichage", effect: { kind: "dodge", chance: 25 } },
    artSeed: 8086, imageUrl: null,
  },
  {
    id: id(8), slug: "l-algorithme-supreme", name: "L'Algorithme Suprême", rarity: "godlevel", vibe: "chaos",
    description: "Il sait ce que tu vas regarder avant toi.",
    hp: 126, atk: 56, def: 43, spd: 92,
    normalAttack: { name: "Notification", power: 33 },
    specialAttack: { name: "Tendance mondiale", power: 88, energyCost: 4, effect: { kind: "buff", stat: "atk", stages: 1 } },
    defenseAbility: { name: "Mise à jour divine", effect: { kind: "heal", percent: 15 } },
    artSeed: 777, imageUrl: null,
  },
];
