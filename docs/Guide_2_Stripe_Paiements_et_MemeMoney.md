# MemeMasters • Guide 2 : Système de Paiements Stripe & Conformité Légale

> **Objectif :** Vendre des packs de MemeMoney contre de l'argent réel, encaisser les revenus sur ton compte bancaire et respecter scrupuleusement la loi et les exigences de Stripe.

---

## 1. Comment fonctionne la monétisation dans MemeMasters ?

Le modèle économique du jeu repose sur la **MemeMoney** (la monnaie virtuelle du jeu) :

1. Les joueurs reçoivent des boosters gratuits chaque jour, mais peuvent acheter des boosters supplémentaires avec leur MemeMoney.
2. Pour accélérer leur progression et compléter leur collection de cartes, les joueurs achètent des recharges de MemeMoney avec du **vrai argent** (Carte bancaire, Apple Pay, Google Pay).
3. **Sécurité bancaire totale :** Le paiement est entièrement géré par **Stripe Checkout** (page sécurisée de paiement hébergée par Stripe). Ton jeu ne touche **JAMAIS** aux numéros de carte bancaire, ce qui garantit une sécurité maximale sans contrainte technique (PCI-DSS géré par Stripe).
4. **Crédit automatique :** Dès que la banque valide le paiement, Stripe envoie une notification sécurisée (**Webhook**) à ton serveur pour créditer immédiatement le compte du joueur.

---

## 2. Les packs de MemeMoney configurés dans le jeu

Les packs sont définis dans `src/config/game.config.ts` :

| Code Produit | MemeMoney | Bonus Offert | Prix (€) | Remarque |
| :--- | :--- | :--- | :--- | :--- |
| `mm_20` | 20 MM | 0 | 0,25 € | ⚠️ *Sous le seuil minimal Stripe* (voir ci-dessous) |
| `mm_100` | 100 MM | +10 bonus | 1,00 € | Pack le plus populaire (*Tag Popular*) |
| `mm_200` | 200 MM | +40 bonus | 2,00 € | Pack intermédiaire |
| `mm_500` | 500 MM | +150 bonus | 5,00 € | Meilleur rapport qualité/prix (*Tag Best Value*) |

> **⚠️ Règle importante sur les petits montants :**  
> Stripe refuse tout paiement par carte bancaire inférieur à **0,50 €**.  
> De plus, les frais bancaires fixes (environ 0,25 € par transaction en Europe) absorberaient 100 % d'un achat à 0,25 €. En production, le premier pack achetable seul par carte bancaire est donc celui à **1,00 €**.

---

## 3. Étape 1 : Créer et activer ton compte Stripe

1. Rends-toi sur [https://stripe.com](https://stripe.com) et crée un compte marchand.
2. **Mode Test :** Au début, ton compte est en mode test. Tu peux simuler des faux paiements avec des cartes fictives (ex. `4242 4242 4242 4242`) pour vérifier que la MemeMoney est bien créditée.
3. **Activation pour de vrai :** Pour encaisser de vrais euros, clique sur **« Activer les paiements »** :
   * **Statut juridique :** En France, tu peux exercer en Micro-entreprise (Auto-entrepreneur), Société (SASU, SARL, etc.) ou statut légal adapté.
   * Stripe te demandera ton numéro SIRET, ta pièce d'identité et ton **IBAN** bancaire pour te verser tes gains automatiquement.

---

## 4. Étape 2 : Récupérer les clés API Stripe

Dans le tableau de bord Stripe (**Développeurs** → **Clés API**) :

* `STRIPE_SECRET_KEY` : Clé secrète qui commence par `sk_test_...` (en test) ou `sk_live_...` (en production).  
  *Ne jamais la divulguer publiquement.*
* Ajoute cette variable dans ton fichier `.env.local` et sur **Vercel** (*Settings → Environment Variables*).

---

## 5. Étape 3 : Configurer le Webhook Stripe (Livraison automatique)

Le Webhook est le signal envoyé par Stripe à ton jeu pour livrer la MemeMoney dès que le paiement est réussi :

1. Dans le tableau de bord Stripe : **Développeurs** → **Webhooks** → clique sur **« Ajouter un point de terminaison »**.
2. Renseigne l'URL d'écoute :  
   `https://ton-projet.vercel.app/api/stripe/webhook`
3. Sélectionne l'événement à écouter :  
   `checkout.session.completed`  
   *(Cet événement se déclenche uniquement quand la carte bancaire a été débitée avec succès).*
4. Stripe t'affiche alors le secret de signature : `STRIPE_WEBHOOK_SECRET` (commence par `whsec_...`).
5. Renseigne ce secret dans `.env.local` et dans les variables d'environnement de Vercel.

---

## 6. Étape 4 : L'Étape OBLIGATOIRE — Les Pages Légales du Jeu

> **⚠️ Exigence stricte de Stripe et de la loi :**  
> Stripe vérifie obligatoirement ton site avant d'autoriser les paiements réels.  
> Si tes pages légales (Mentions Légales, CGU, Politique de Confidentialité) sont vides ou mentionnent « À compléter », Stripe refusera d'activer ton compte marchand ou suspendra les versements.

Dans MemeMasters, toutes les pages et textes juridiques sont **déjà rédigés** !  
Il te reste simplement à inscrire tes coordonnées dans le fichier [`src/config/legal.config.ts`](file:///c:/Users/Hugo/Desktop/MemeMasters/src/config/legal.config.ts) :

```typescript
export const LEGAL = {
  PUBLISHER: {
    name: "Ton Nom et Prénom (ou raison sociale)",
    legalForm: "Micro-entreprise (ou Particulier, SASU...)",
    registration: "Numéro SIREN / SIRET (si entreprise)",
    address: "Ton adresse postale",
    email: "contact@mememasters.com",
    phone: "Ton numéro de téléphone",
    publicationDirector: "Ton Nom et Prénom",
  },
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
      address: "970 Toa Payoh North #07-04, Singapour 318992",
      website: "https://supabase.com",
    },
  ],
};
```

### Les 4 pages légales intégrées au jeu :
1. **Mentions Légales** (`/mentions-legales`) : Obligation de la loi LCEN (qui édite et qui héberge le jeu).
2. **Conditions Générales d'Utilisation et de Vente** (`/conditions-utilisation`) : Encadre l'achat de monnaie virtuelle. Le texte précise que la MemeMoney n'a pas de valeur financière dans le monde réel, qu'elle ne peut pas être échangée contre des euros, qu'il n'y a pas de droit de rétractation après fourniture immédiate (article L.221-28 du Code de la consommation), et que les achats sont réservés aux majeurs (+18 ans).
3. **Politique de Confidentialité** (`/confidentialite`) : Conforme au RGPD. Explique que les données de paiement sont traitées par Stripe sans stockage de carte bancaire sur le jeu.
4. **Règles de la Communauté** (`/regles-communaute`) : Interdiction de triche, de bots et de revente de comptes.

---

## 7. Étape 5 : Protections Joueurs & Réglementations déjà intégrées

MemeMasters intègre déjà nativement des garde-fous pour respecter la législation sur les jeux vidéo :

* **Jeu responsable :** Plafond mensuel de dépenses fixé par défaut à **50 € par mois** (`MONTHLY_SPEND_CAP_CENTS: 5000`) pour éviter les achats compulsifs.
* **Blocage de la Belgique :** La Belgique interdit strictement les jeux vendant des pochettes de cartes aléatoires avec de l'argent réel. La boutique est donc automatiquement désactivée pour les joueurs résidant en Belgique (`BLOCKED_COUNTRIES: ["BE"]`).
* **Majorité :** Les joueurs attestent de leur majorité (+18 ans) lors de l'inscription.
