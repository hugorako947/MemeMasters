/**
 * Informations juridiques affichées dans le pied de page et les pages légales.
 *
 * ⚠️ À COMPLÉTER PAR L'ÉDITEUR avant la mise en ligne : les champs vides
 * s'affichent « À compléter » et un bandeau d'avertissement apparaît sur les
 * pages légales. Les textes fournis sont des modèles : faites-les relire par
 * un professionnel du droit.
 */
export const LEGAL = {
  /** Change cette date quand les conditions évoluent : les joueurs devront les accepter à nouveau. */
  TERMS_VERSION: "2026-10-06",
  COPYRIGHT_START_YEAR: 2026,

  /** Éditeur du site (article 6 de la loi pour la confiance dans l'économie numérique). */
  PUBLISHER: {
    /** Nom et prénom, ou raison sociale. */
    name: "",
    /** Ex. « Particulier », « Micro-entreprise », « SAS au capital de 1 000 € ». */
    legalForm: "",
    /** SIREN / SIRET, si vous êtes une entreprise. */
    registration: "",
    address: "",
    email: "",
    phone: "",
    /** Directeur de la publication (souvent l'éditeur lui-même). */
    publicationDirector: "",
  },

  /** Hébergeurs. Vérifiez les adresses sur leurs sites avant publication. */
  HOSTS: [
    {
      role: "Hébergement du site",
      name: "Vercel Inc.",
      address: "440 N Barranca Ave #4133, Covina, CA 91723, États-Unis",
      website: "https://vercel.com",
    },
    {
      role: "Base de données, comptes et fichiers",
      name: "Supabase Inc.",
      address: "",
      website: "https://supabase.com",
    },
  ],

  /** Région où sont stockées les données des joueurs (projet Supabase). */
  DATA_REGION: "Union européenne (Irlande)",
  GOVERNING_LAW: "le droit français",
  /** Autorité de contrôle pour les données personnelles. */
  DATA_AUTHORITY: { name: "CNIL", website: "https://www.cnil.fr" },
} as const;

/** Champs obligatoires encore vides (affichés « À compléter »). */
export function missingLegalFields(): string[] {
  const p = LEGAL.PUBLISHER;
  const required: Array<[string, string]> = [
    ["éditeur", p.name],
    ["adresse de l'éditeur", p.address],
    ["e-mail de contact", p.email],
    ["directeur de la publication", p.publicationDirector],
  ];
  for (const host of LEGAL.HOSTS) required.push([`adresse de ${host.name}`, host.address]);
  return required.filter(([, value]) => value.trim() === "").map(([label]) => label);
}
