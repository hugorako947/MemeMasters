# MemeMasters • Guide 1 : Connexion Google OAuth & Système d'E-mails

> **Identifiant Supabase du projet :** `gpctkgjxuetulqpbmzfv`  
> **URL de rappel OAuth :** `https://gpctkgjxuetulqpbmzfv.supabase.co/auth/v1/callback`

---

## 1. Comprendre l'erreur `{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}`

Lorsque tu cliques sur « Continuer avec Google » dans le jeu, ton navigateur envoie une requête vers Supabase pour initialiser la session.  
Si le fournisseur Google n'est pas encore activé dans le tableau de bord Supabase, le serveur renvoie immédiatement ce message d'erreur.  

Le script de diagnostic du jeu (`npm run doctor`) confirme ce statut :  
`⚠️ Connexion Google non configurée (le bouton affichera une erreur).`

Il suffit de relier Google Cloud à Supabase pour faire disparaître l'erreur.

---

## 2. Étape 1 : Créer le projet et l'écran de consentement sur Google Cloud Console

Google doit savoir quel jeu demande l'autorisation d'authentifier les joueurs.

1. **Accès :** Rends-toi sur [Google Cloud Console](https://console.cloud.google.com/) et connecte-toi avec ton compte Google.
2. **Nouveau projet :** En haut à gauche, clique sur le menu déroulant des projets puis sur **« Nouveau projet »**. Nomme-le **« MemeMasters »** puis clique sur **Créer**.
3. **Écran de consentement :** Dans le menu de gauche, va sur **APIs & Services** → **Écran de consentement OAuth** (*OAuth consent screen*).
4. **Type d'accès :** Choisis le type **Externe** (*External*) puis clique sur **Créer**.
5. **Informations obligatoires :**
   * Nom de l'application : `MemeMasters`
   * Adresse e-mail d'assistance utilisateur : ton adresse Gmail.
   * Coordonnées du développeur (e-mail) : ton adresse Gmail.
6. Clique sur **Enregistrer et continuer** jusqu'à la fin de l'assistant.

---

## 3. Étape 2 : Créer les Identifiants OAuth (Client ID & Client Secret)

C'est ici que tu génères les clés secrètes qui autorisent Supabase à communiquer avec Google.

1. Dans le menu de gauche de Google Cloud Console, va sur **APIs & Services** → **Identifiants** (*Credentials*).
2. Clique en haut sur **« + Créer des identifiants »** puis choisis **« ID client OAuth »**.
3. Choisis le type **Application Web** et donne-lui le nom **« MemeMasters Web »**.
4. Dans la section **« Origines JavaScript autorisées »**, clique sur **« + Ajouter un URI »** et saisis :
   * L'URL de ton site Vercel : `https://ton-projet.vercel.app`
   * Si tu testes en local : `http://localhost:3000`
5. Dans la section **« URI de redirection autorisés »** (*TRÈS IMPORTANT*), clique sur **« + Ajouter un URI »** et colle exactement :
   ```text
   https://gpctkgjxuetulqpbmzfv.supabase.co/auth/v1/callback
   ```
6. Clique sur **Créer**.
7. Google affiche alors une fenêtre avec deux clés :
   * **ID client** (*Client ID*)
   * **Code secret client** (*Client Secret*)  
   *(Copie ces deux clés précieusement).*

---

## 4. Étape 3 : Activer Google dans le Dashboard Supabase

1. Ouvre directement ton tableau de bord Supabase :  
   👉 [https://supabase.com/dashboard/project/gpctkgjxuetulqpbmzfv/auth/providers](https://supabase.com/dashboard/project/gpctkgjxuetulqpbmzfv/auth/providers)
2. Dans la liste des fournisseurs d'authentification, clique sur la ligne **Google**.
3. Active l'interrupteur **« Enable Sign in with Google »**.
4. Remplis les champs :
   * **Client ID :** colle le Client ID obtenu à l'étape 2.
   * **Client Secret :** colle le Client Secret obtenu à l'étape 2.
5. Clique sur le bouton **Save** en bas à droite pour enregistrer.

👉 *Dès cet instant, le bouton « Continuer avec Google » dans ton jeu fonctionne immédiatement sans aucune erreur !*

---

## 5. Étape 4 : Configurer l'envoi d'e-mails réels (Gmail SMTP)

Par défaut, Supabase bloque l'envoi d'e-mails au-delà de 3 e-mails par heure sans serveur personnel. Pour envoyer les e-mails de mot de passe oublié ou d'inscription sans aucune limite et sans finir dans les spams :

1. Va sur ton compte Google : [https://myaccount.google.com/security](https://myaccount.google.com/security).
2. Assure-toi que la **Validation en 2 étapes** est activée.
3. Va sur [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) (*Mots de passe des applications*).
4. Crée un mot de passe d'application nommé `MemeMasters` : Google te fournit un mot de passe unique de 16 lettres.
5. Dans Supabase, va dans **Project Settings** → **Authentication** → section **SMTP Settings** :
   * **Enable Custom SMTP :** Oui (coché)
   * **Sender email :** Ton adresse Gmail (ex. `moncompte@gmail.com`)
   * **Sender name :** `MemeMasters`
   * **Host :** `smtp.gmail.com`
   * **Port :** `465` (SSL) ou `587` (TLS)
   * **User :** Ton adresse Gmail
   * **Password :** Le mot de passe d'application de 16 lettres (sans espaces).
6. Clique sur **Save**.

---

## 6. Étape 5 : Installer les modèles d'e-mails HTML MemeMasters

Deux modèles d'e-mails aux couleurs de MemeMasters sont créés dans le projet :

1. **Mot de passe oublié :**
   * Dans Supabase : **Authentication** → **Email Templates** → **Reset Password**.
   * Sujet : `Nouveau mot de passe - MemeMasters`
   * Contenu : copie-colle le contenu du fichier `supabase/templates/recovery.html`.
2. **Confirmation d'inscription :**
   * Dans Supabase : **Authentication** → **Email Templates** → **Confirm Signup**.
   * Sujet : `Active ton compte - MemeMasters`
   * Contenu : copie-colle le contenu du fichier `supabase/templates/confirmation.html`.
3. **URL du site :**
   * Dans Supabase : **Authentication** → **URL Configuration**.
   * **Site URL :** mets l'adresse Vercel de ton site (`https://ton-projet.vercel.app`).
   * **Redirect URLs :** ajoute `https://ton-projet.vercel.app/**`.
