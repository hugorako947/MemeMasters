/**
 * Textes juridiques (français). MODÈLES À FAIRE RELIRE par un professionnel
 * du droit avant la mise en ligne. Les informations de l'éditeur et des
 * hébergeurs viennent de src/config/legal.config.ts.
 * Pour traduire : créer content/legal/<langue>.tsx sur le même modèle.
 */
import type { ReactNode } from "react";
import { GAME_CONFIG } from "@/config/game.config";
import { LEGAL } from "@/config/legal.config";

const NAME = GAME_CONFIG.GAME_NAME;

/** Valeur de configuration, ou un repère visible si elle manque. */
function V({ value }: { value: string }) {
  if (value.trim()) return <>{value}</>;
  return <mark className="rounded bg-sticker px-1 font-semibold">À compléter</mark>;
}

const contact = (
  <>
    {LEGAL.PUBLISHER.email ? <a href={`mailto:${LEGAL.PUBLISHER.email}`}>{LEGAL.PUBLISHER.email}</a> : <V value="" />}
  </>
);

export interface LegalDocument {
  title: string;
  updated: string;
  body: ReactNode;
}

export const LEGAL_NOTICE: LegalDocument = {
  title: "Mentions légales",
  updated: LEGAL.TERMS_VERSION,
  body: (
    <>
      <h2>Éditeur</h2>
      <p>
        Le site et le jeu {NAME} sont édités par <V value={LEGAL.PUBLISHER.name} />
        {LEGAL.PUBLISHER.legalForm ? <>, {LEGAL.PUBLISHER.legalForm}</> : null}
        {LEGAL.PUBLISHER.registration ? <>, immatriculation {LEGAL.PUBLISHER.registration}</> : null}.
      </p>
      <ul>
        <li>
          Adresse : <V value={LEGAL.PUBLISHER.address} />
        </li>
        <li>E-mail : {contact}</li>
        {LEGAL.PUBLISHER.phone ? <li>Téléphone : {LEGAL.PUBLISHER.phone}</li> : null}
        <li>
          Directeur de la publication : <V value={LEGAL.PUBLISHER.publicationDirector} />
        </li>
      </ul>

      <h2>Hébergement</h2>
      <ul>
        {LEGAL.HOSTS.map((host) => (
          <li key={host.name}>
            {host.role} : {host.name}, <V value={host.address} /> (<a href={host.website}>{host.website.replace("https://", "")}</a>).
          </li>
        ))}
      </ul>
      <p>Les données des joueurs sont stockées dans l&apos;{LEGAL.DATA_REGION}.</p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Le nom {NAME}, le logo, les textes, le code et les illustrations des cartes sont protégés. Les illustrations sont
        des créations originales : elles ne reproduisent aucun meme existant ni aucune personne réelle. Toute
        reproduction sans autorisation est interdite.
      </p>
      <p>
        {NAME} est un projet indépendant, sans lien avec Instagram, TikTok, X, Reddit ou tout autre réseau social. Les
        marques citées appartiennent à leurs propriétaires.
      </p>

      <h2>Signaler un contenu</h2>
      <p>Pour signaler un contenu illicite ou un comportement contraire aux règles, écrivez à {contact}.</p>
    </>
  ),
};

export const TERMS: LegalDocument = {
  title: "Conditions d'utilisation",
  updated: LEGAL.TERMS_VERSION,
  body: (
    <>
      <h2>1. Objet</h2>
      <p>
        Ces conditions encadrent l&apos;utilisation de {NAME}, jeu en ligne de cartes à collectionner sur le thème des
        memes. En créant un compte, tu les acceptes ainsi que les{" "}
        <a href="/regles-communaute">règles de la communauté</a> et la <a href="/confidentialite">politique de confidentialité</a>.
      </p>

      <h2>2. Compte</h2>
      <ul>
        <li>Le jeu est réservé aux personnes de {GAME_CONFIG.MIN_ACCOUNT_AGE ?? 18} ans et plus : certains memes peuvent heurter, et le jeu propose des achats.</li>
        <li>Un seul compte par personne. Tu es responsable de la confidentialité de ton mot de passe.</li>
        <li>Ton pseudo ne doit pas usurper l&apos;identité d&apos;autrui ni être injurieux.</li>
        <li>Tu peux supprimer ton compte à tout moment en écrivant à {contact}.</li>
      </ul>

      <h2>3. Contenus virtuels</h2>
      <p>
        Les cartes, boosters, la MemeMoney, la poussière de meme, les trophées et les autres éléments du jeu sont des
        contenus virtuels. Ils n&apos;ont
        aucune valeur monétaire, ne sont ni remboursables, ni échangeables contre de l&apos;argent, ni cessibles à un
        tiers. Leur vente ou leur échange en dehors du jeu est interdit.
      </p>

      <h2>4. Gratuité et achats</h2>
      <ul>
        <li>Jouer est gratuit : des boosters gratuits sont offerts chaque jour, et aucun achat n&apos;est nécessaire.</li>
        <li>
          La MemeMoney, monnaie du jeu, se gagne en jouant (victoires, nouveaux rangs) et peut aussi être achetée. Elle
          sert à obtenir des boosters supplémentaires, spéciaux ou très spéciaux.
        </li>
        <li>
          Le contenu des boosters est aléatoire ; les probabilités de chaque rareté sont affichées avant toute dépense.
        </li>
        <li>
          Les achats sont réservés aux personnes majeures et plafonnés à{" "}
          {(GAME_CONFIG.PURCHASES.MONTHLY_SPEND_CAP_CENTS / 100).toLocaleString("fr-FR")} € par période de 30 jours,
          plafond que tu peux abaisser. Ils peuvent être indisponibles dans certains pays.
        </li>
        <li>
          Les contenus numériques étant fournis immédiatement, tu renonces à ton droit de rétractation dès l&apos;ouverture
          du booster, dans les conditions prévues par la loi.
        </li>
      </ul>

      <h2>5. Comportement</h2>
      <p>
        Tu t&apos;engages à respecter les <a href="/regles-communaute">règles de la communauté</a>. La triche
        (modification du jeu, robots, exploitation de bugs) est interdite.
      </p>

      <h2>6. Sanctions</h2>
      <p>
        En cas de manquement, {NAME} peut avertir, suspendre ou supprimer un compte, et retirer les contenus virtuels
        obtenus de façon irrégulière. Tu peux contester une sanction en écrivant à {contact}.
      </p>

      <h2>7. Disponibilité et responsabilité</h2>
      <p>
        Le jeu est fourni en l&apos;état. Nous faisons de notre mieux pour qu&apos;il soit disponible et sans erreur, sans
        pouvoir le garantir. L&apos;équilibrage des cartes peut évoluer.
      </p>

      <h2>8. Modifications</h2>
      <p>
        Ces conditions peuvent évoluer. En cas de changement important, il te sera demandé de les accepter à nouveau à ta
        prochaine connexion.
      </p>

      <h2>9. Droit applicable</h2>
      <p>
        Ces conditions sont soumises à {LEGAL.GOVERNING_LAW}. En cas de litige, une solution amiable sera recherchée avant
        toute action ; les règles de protection des consommateurs de ton pays de résidence restent applicables.
      </p>
    </>
  ),
};

export const PRIVACY: LegalDocument = {
  title: "Politique de confidentialité",
  updated: LEGAL.TERMS_VERSION,
  body: (
    <>
      <h2>Responsable du traitement</h2>
      <p>
        <V value={LEGAL.PUBLISHER.name} />, joignable à {contact}.
      </p>

      <h2>Données collectées</h2>
      <ul>
        <li>Compte : adresse e-mail, pseudo, mot de passe (stocké chiffré, jamais lisible), fuseau horaire.</li>
        <li>Attestation de majorité et acceptation des conditions, horodatées.</li>
        <li>Connexion avec Google : ton adresse e-mail et ton identifiant Google, rien d&apos;autre.</li>
        <li>Jeu : collection, decks, combats, trophées et leur historique, MemeMoney, défis, classements.</li>
        <li>Préférences : langue et thème choisis.</li>
        <li>Sécurité : adresse IP, utilisée pour limiter les abus (tentatives de connexion répétées).</li>
        <li>Achats : historique des achats. Les données de paiement sont traitées par Stripe et ne nous sont jamais transmises.</li>
      </ul>

      <h2>Pourquoi</h2>
      <ul>
        <li>Fournir le jeu et ton compte (exécution du contrat).</li>
        <li>Sécuriser le service et prévenir la triche (intérêt légitime).</li>
        <li>Respecter nos obligations légales, notamment comptables pour les achats.</li>
      </ul>
      <p>Aucune publicité, aucune revente de données, aucun profilage publicitaire.</p>

      <h2>Destinataires</h2>
      <ul>
        <li>Supabase (base de données, comptes) : données stockées dans l&apos;{LEGAL.DATA_REGION}.</li>
        <li>Vercel (hébergement du site) : peut traiter des données techniques hors de l&apos;Union européenne, encadrées par des clauses contractuelles types.</li>
        <li>Google, si tu choisis de te connecter avec ton compte Google.</li>
        <li>Stripe, pour les paiements.</li>
      </ul>

      <h2>Durée de conservation</h2>
      <p>
        Tant que ton compte existe, puis suppression sous 30 jours après sa fermeture, sauf les données d&apos;achat
        conservées le temps imposé par la loi.
      </p>

      <h2>Cookies</h2>
      <p>
        {NAME} n&apos;utilise que des cookies strictement nécessaires (maintien de ta session). Aucun cookie publicitaire ou
        de mesure d&apos;audience : aucun consentement n&apos;est donc demandé.
      </p>

      <h2>Tes droits</h2>
      <p>
        Tu peux accéder à tes données, les rectifier, les supprimer, en demander une copie ou t&apos;opposer à certains
        traitements en écrivant à {contact}. Tu peux aussi saisir la {LEGAL.DATA_AUTHORITY.name} (
        <a href={LEGAL.DATA_AUTHORITY.website}>{LEGAL.DATA_AUTHORITY.website.replace("https://", "")}</a>).
      </p>
    </>
  ),
};

export const COMMUNITY_RULES: LegalDocument = {
  title: "Règles de la communauté",
  updated: LEGAL.TERMS_VERSION,
  body: (
    <>
      <p>
        {NAME} se joue pour rire. Ces règles gardent le jeu agréable pour tout le monde ; les enfreindre peut entraîner un
        avertissement, une suspension ou la suppression du compte.
      </p>
      <h2>Respecte les autres joueurs</h2>
      <ul>
        <li>Pas de harcèlement, de menaces ni d&apos;insultes.</li>
        <li>Aucune haine ni discrimination (origine, religion, genre, orientation, handicap…).</li>
        <li>Pas de contenu sexuel, violent ou illégal, y compris dans les pseudos.</li>
      </ul>
      <h2>Joue franc-jeu</h2>
      <ul>
        <li>Pas de triche, de robots, de scripts ni de modification du jeu.</li>
        <li>Si tu trouves un bug, signale-le au lieu de l&apos;exploiter.</li>
        <li>Pas d&apos;abandon volontaire et répété des combats pour manipuler le classement.</li>
      </ul>
      <h2>Garde ton compte pour toi</h2>
      <ul>
        <li>Un compte par personne ; pas de partage, de vente ni d&apos;achat de comptes.</li>
        <li>Pas de vente de cartes ou de boosters contre de l&apos;argent réel.</li>
        <li>Ne communique jamais ton mot de passe : l&apos;équipe ne te le demandera jamais.</li>
      </ul>
      <h2>Signaler</h2>
      <p>Un comportement te pose problème ? Écris à {contact} en indiquant le pseudo concerné.</p>
    </>
  ),
};
