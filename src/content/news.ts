/**
 * News du jeu (onglet Infos → News), de la plus récente à la plus ancienne.
 * Pour publier une news : ajouter une entrée en haut de la liste.
 * Chaque texte existe au moins en français ; les autres langues sont
 * facultatives (à défaut, la version française s'affiche).
 * Une interface d'administration pourra remplacer ce fichier (phase 2).
 */
export type NewsKind = "news" | "update" | "upcoming" | "change";

type Localized = { fr: string } & Partial<Record<"en" | "zh" | "es" | "ar" | "pt" | "de", string>>;

export interface NewsItem {
  id: string;
  date: string;
  kind: NewsKind;
  title: Localized;
  body: Localized;
}

export const NEWS: readonly NewsItem[] = [
  {
    id: "2026-10-09-infos",
    date: "2026-10-09",
    kind: "news",
    title: { fr: "Nouvel onglet Infos", en: "New Info tab" },
    body: {
      fr: "Raretés, classement des joueurs et news sont désormais réunis au même endroit. Choisis ton classement : autour de toi, dans ton rang ou dans le monde.",
      en: "Rarities, player rankings and news are now in one place. Pick your ranking: around you, in your rank or worldwide.",
    },
  },
  {
    id: "2026-10-08-raretes",
    date: "2026-10-08",
    kind: "change",
    title: { fr: "7 raretés et 3 boosters", en: "7 rarities and 3 boosters" },
    body: {
      fr: "Bienvenue aux raretés Brainrot et SuperBrainrot ! Les boosters journaliers, Super Boosters et Ultra Boosters ont chacun leur composition. La Godlevel, elle, ne s'obtient que par chance.",
      en: "Welcome Brainrot and SuperBrainrot rarities! Daily boosters, Super Boosters and Ultra Boosters each have their own line-up. Godlevel cards can only be won by luck.",
    },
  },
  {
    id: "2026-10-07-langues",
    date: "2026-10-07",
    kind: "update",
    title: { fr: "7 langues et 4 thèmes", en: "7 languages and 4 themes" },
    body: {
      fr: "Le jeu parle désormais anglais, chinois, espagnol, arabe, français, portugais et allemand. Dans les réglages : thème clair, obscur, inversé ou personnalisé.",
      en: "The game now speaks English, Chinese, Spanish, Arabic, French, Portuguese and German. In settings: light, dark, inverted or custom theme.",
    },
  },
  {
    id: "a-venir-boosters",
    date: "2026-10-06",
    kind: "upcoming",
    title: { fr: "Bientôt : l'ouverture des boosters", en: "Coming soon: opening boosters" },
    body: {
      fr: "Déchire, retourne, collectionne : l'ouverture des boosters et la collection arrivent dans la prochaine mise à jour, suivies des batailles en temps réel.",
      en: "Tear, flip, collect: opening boosters and the collection arrive in the next update, followed by real-time battles.",
    },
  },
];

export function localized(text: Localized, locale: string): { text: string; lang: string } {
  const value = (text as Record<string, string | undefined>)[locale];
  return value ? { text: value, lang: locale } : { text: text.fr, lang: "fr" };
}
