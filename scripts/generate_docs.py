"""
Générateur des documents Word d'instructions pour MemeMasters :
1. Guide 1 : Google OAuth & E-mails (Google Cloud + Supabase)
2. Guide 2 : Monétisation Stripe, MemeMoney & Conformité Légale
"""

import os
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    """Définit la couleur d'arrière-plan d'une cellule de tableau."""
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=140, bottom=140, left=200, right=200):
    """Définit le rembourrage interne d'une cellule (en dxa)."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}>'
                      f'<w:top w:w="{top}" w:type="dxa"/>'
                      f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
                      f'<w:left w:w="{left}" w:type="dxa"/>'
                      f'<w:right w:w="{right}" w:type="dxa"/>'
                      f'</w:tcMar>')
    tcPr.append(tcMar)

def add_callout(doc, text, title="IMPORTANT :", bg_color="FFFBEB", border_color="F59E0B"):
    """Ajoute un bloc d'alerte ou de note mise en valeur."""
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    table.columns[0].width = Inches(6.5)
    
    cell = table.cell(0, 0)
    set_cell_background(cell, bg_color)
    set_cell_margins(cell, top=160, bottom=160, left=220, right=220)
    
    # Bordure gauche épaisse
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(f'<w:tcBorders {nsdecls("w")}>'
                        f'<w:top w:val="none"/>'
                        f'<w:left w:val="single" w:sz="36" w:space="0" w:color="{border_color}"/>'
                        f'<w:bottom w:val="none"/>'
                        f'<w:right w:val="none"/>'
                        f'</w:tcBorders>')
    tcPr.append(borders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.15
    run_t = p.add_run(f"{title} ")
    run_t.bold = True
    run_t.font.name = "Arial"
    run_t.font.size = Pt(10.5)
    run_t.font.color.rgb = RGBColor(180, 83, 9)
    
    run_b = p.add_run(text)
    run_b.font.name = "Arial"
    run_b.font.size = Pt(10.5)
    run_b.font.color.rgb = RGBColor(30, 41, 59)
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

def setup_styles(doc):
    """Configure les polices et marges du document."""
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.9)
        section.right_margin = Inches(0.9)

def add_header_title(doc, category, title, subtitle):
    # Catégorie
    p_cat = doc.add_paragraph()
    p_cat.paragraph_format.space_before = Pt(0)
    p_cat.paragraph_format.space_after = Pt(2)
    r_cat = p_cat.add_run(category.upper())
    r_cat.bold = True
    r_cat.font.name = "Arial"
    r_cat.font.size = Pt(9.5)
    r_cat.font.color.rgb = RGBColor(99, 102, 241) # Indigo
    
    # Titre principal
    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(0)
    p_title.paragraph_format.space_after = Pt(4)
    r_title = p_title.add_run(title)
    r_title.bold = True
    r_title.font.name = "Arial"
    r_title.font.size = Pt(22)
    r_title.font.color.rgb = RGBColor(15, 23, 42)
    
    # Sous-titre
    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(16)
    r_sub = p_sub.add_run(subtitle)
    r_sub.font.name = "Arial"
    r_sub.font.size = Pt(11)
    r_sub.font.color.rgb = RGBColor(100, 116, 139)
    
    # Ligne de séparation
    p_sep = doc.add_paragraph()
    p_sep.paragraph_format.space_after = Pt(14)
    p_border = parse_xml(f'<w:pBdr {nsdecls("w")}><w:bottom w:val="single" w:sz="8" w:space="1" w:color="E2E8F0"/></w:pBdr>')
    p_sep._p.get_or_add_pPr().append(p_border)

def add_h1(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(18)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    run.bold = True
    run.font.name = "Arial"
    run.font.size = Pt(14)
    run.font.color.rgb = RGBColor(30, 41, 59)
    return p

def add_h2(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    run.bold = True
    run.font.name = "Arial"
    run.font.size = Pt(12)
    run.font.color.rgb = RGBColor(71, 85, 105)
    return p

def add_body(doc, text, bold_prefix=None):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.15
    if bold_prefix:
        r_pre = p.add_run(bold_prefix)
        r_pre.bold = True
        r_pre.font.name = "Arial"
        r_pre.font.size = Pt(10.5)
        r_pre.font.color.rgb = RGBColor(15, 23, 42)
    run = p.add_run(text)
    run.font.name = "Arial"
    run.font.size = Pt(10.5)
    run.font.color.rgb = RGBColor(51, 65, 85)
    return p

def add_bullet(doc, text, bold_prefix=None):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.15
    if bold_prefix:
        r_pre = p.add_run(bold_prefix)
        r_pre.bold = True
        r_pre.font.name = "Arial"
        r_pre.font.size = Pt(10.5)
        r_pre.font.color.rgb = RGBColor(15, 23, 42)
    run = p.add_run(text)
    run.font.name = "Arial"
    run.font.size = Pt(10.5)
    run.font.color.rgb = RGBColor(51, 65, 85)
    return p

def add_table_data(doc, headers, rows):
    table = doc.add_table(rows=len(rows) + 1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    
    # En-tête
    hdr_cells = table.rows[0].cells
    for i, title in enumerate(headers):
        hdr_cells[i].text = title
        set_cell_background(hdr_cells[i], "1E293B")
        set_cell_margins(hdr_cells[i], top=100, bottom=100, left=150, right=150)
        p = hdr_cells[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        for run in p.runs:
            run.font.name = "Arial"
            run.font.size = Pt(10)
            run.font.bold = True
            run.font.color.rgb = RGBColor(255, 255, 255)
            
    # Lignes
    for r_idx, row_data in enumerate(rows):
        row_cells = table.rows[r_idx + 1].cells
        bg = "F8FAFC" if r_idx % 2 == 0 else "FFFFFF"
        for c_idx, val in enumerate(row_data):
            row_cells[c_idx].text = str(val)
            set_cell_background(row_cells[c_idx], bg)
            set_cell_margins(row_cells[c_idx], top=80, bottom=80, left=150, right=150)
            p = row_cells[c_idx].paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            for run in p.runs:
                run.font.name = "Arial"
                run.font.size = Pt(9.5)
                run.font.color.rgb = RGBColor(30, 41, 59)
    
    doc.add_paragraph().paragraph_format.space_after = Pt(6)


# ==============================================================================
# DOCUMENT 1 : GOOGLE OAUTH & EMAILS
# ==============================================================================
def generate_google_doc(output_path):
    doc = Document()
    setup_styles(doc)
    
    add_header_title(
        doc,
        category="MemeMasters • Guide d'implémentation",
        title="Guide 1 : Connexion Google OAuth & Système d'E-mails",
        subtitle="Instructions détaillées pour Google Cloud Console, Supabase Auth et la livraison des e-mails en production."
    )
    
    add_callout(
        doc,
        "Ce guide est pré-configuré spécifiquement pour ton projet MemeMasters (Identifiant Supabase : gpctkgjxuetulqpbmzfv). Toutes les URLs indiquées correspondent exactement à ton infrastructure.",
        title="PROJET DÉJÀ IDENTIFIÉ :",
        bg_color="EFF6FF",
        border_color="3B82F6"
    )
    
    add_h1(doc, "1. Comprendre l'erreur « Unsupported provider: provider is not enabled »")
    add_body(doc, "Lorsque tu cliques sur « Continuer avec Google » dans le jeu, ton navigateur envoie une requête vers Supabase pour initialiser la session. Si Google n'a pas encore été configuré et coché comme fournisseur actif dans le tableau de bord Supabase, le serveur renvoie immédiatement ce message d'erreur JSON :")
    add_body(doc, '{"code":400, "error_code":"validation_failed", "msg":"Unsupported provider: provider is not enabled"}')
    add_body(doc, "Le script de diagnostic du jeu (npm run doctor) confirme d'ailleurs ce statut : « ⚠️ Connexion Google non configurée (le bouton affichera une erreur) ». Il suffit de relier Google Cloud à Supabase pour faire disparaître l'erreur.")

    add_h1(doc, "2. Étape 1 : Créer le projet et les clés sur Google Cloud Console")
    add_body(doc, "Google doit savoir quel jeu demande l'autorisation de connecter les joueurs.")
    add_bullet(doc, "Rends-toi sur Google Cloud Console (https://console.cloud.google.com/) et connecte-toi avec ton compte Google.", "1. Accès : ")
    add_bullet(doc, "En haut à gauche, clique sur le menu déroulant des projets puis sur « Nouveau projet ». Nomme-le « MemeMasters » puis valide.", "2. Nouveau projet : ")
    add_bullet(doc, "Dans le menu de gauche, va sur APIs & Services → Écran de consentement OAuth (OAuth consent screen).", "3. Écran de consentement : ")
    add_bullet(doc, "Choisis le type « Externe » (External) puis clique sur Créer.", "4. Type d'accès : ")
    add_bullet(doc, "Remplis les informations requises : Nom de l'application = « MemeMasters », adresse e-mail d'assistance = ton Gmail, et coordonnées du développeur = ton Gmail. Clique sur « Enregistrer et continuer » jusqu'à la fin de l'assistant.", "5. Informations : ")

    add_h1(doc, "3. Étape 2 : Créer les Identifiants OAuth (Client ID & Client Secret)")
    add_body(doc, "C'est ici que tu génères les clés secrètes qui autorisent Supabase à parler à Google.")
    add_bullet(doc, "Dans le menu de gauche de Google Cloud Console, va sur APIs & Services → Identifiants (Credentials).", "1. Menu : ")
    add_bullet(doc, "Clique en haut sur « + Créer des identifiants » puis choisis « ID client OAuth ».", "2. Création : ")
    add_bullet(doc, "Choisis « Application Web » et donne-lui le nom « MemeMasters Web ».", "3. Type d'application : ")
    add_bullet(doc, "Dans la section « Origines JavaScript autorisées », clique sur « + Ajouter un URI » et ajoute l'adresse de ton site Vercel (ex. https://ton-projet.vercel.app) ainsi que http://localhost:3000 si tu testes en local.", "4. Origines autorisées : ")
    add_bullet(doc, "Dans la section « URI de redirection autorisés » (TRÈS IMPORTANT), clique sur « + Ajouter un URI » et colle exactement l'adresse de rappel Supabase :", "5. URI de redirection : ")
    
    add_callout(
        doc,
        "https://gpctkgjxuetulqpbmzfv.supabase.co/auth/v1/callback",
        title="URL DE REDIRECTION EXACTE À COLLER DANS GOOGLE CLOUD :",
        bg_color="F0FDF4",
        border_color="22C55E"
    )
    
    add_bullet(doc, "Clique sur « Créer ». Google affiche alors une modale contenant deux clés : l'ID client (Client ID) et le Code secret client (Client Secret). Copie-les précieusement.", "6. Récupération des clés : ")

    add_h1(doc, "4. Étape 3 : Activer Google dans le Dashboard Supabase")
    add_bullet(doc, "Connecte-toi à ton projet Supabase via le lien direct suivant : https://supabase.com/dashboard/project/gpctkgjxuetulqpbmzfv/auth/providers", "1. Accès direct : ")
    add_bullet(doc, "Dans la liste des fournisseurs d'authentification, clique sur la ligne « Google ».", "2. Fournisseur : ")
    add_bullet(doc, "Active l'interrupteur « Enable Sign in with Google ».", "3. Activation : ")
    add_bullet(doc, "Colle le Client ID obtenu à l'étape 2.", "4. Client ID : ")
    add_bullet(doc, "Colle le Client Secret obtenu à l'étape 2.", "5. Client Secret : ")
    add_bullet(doc, "Clique sur le bouton « Save » en bas à droite pour enregistrer.", "6. Sauvegarde : ")
    add_body(doc, "👉 Dès que cette sauvegarde est effectuée, le bouton « Continuer avec Google » dans ton jeu fonctionne immédiatement sans aucune erreur !")

    add_h1(doc, "5. Étape 4 : Configurer l'envoi d'e-mails réels (Gmail SMTP)")
    add_body(doc, "Par défaut, Supabase bloque l'envoi d'e-mails au-delà de 3 e-mails par heure. Pour envoyer les e-mails de mot de passe oublié ou d'inscription sans aucune limite et sans passer par les spams, connecte ton compte Gmail :")
    add_bullet(doc, "Va sur ton compte Google à l'adresse https://myaccount.google.com/security.", "1. Sécurité Google : ")
    add_bullet(doc, "Assure-toi que la « Validation en 2 étapes » est activée.", "2. Double authentification : ")
    add_bullet(doc, "Recherche « Mots de passe des applications » (accessible directement sur https://myaccount.google.com/apppasswords).", "3. Mots de passe d'application : ")
    add_bullet(doc, "Crée un mot de passe d'application nommé « MemeMasters » : Google te donne un mot de passe unique de 16 lettres.", "4. Génération du mot de passe : ")
    add_bullet(doc, "Dans Supabase, va dans Project Settings → Authentication → section « SMTP Settings ».", "5. Supabase SMTP : ")
    
    headers_smtp = ["Paramètre Supabase", "Valeur à renseigner"]
    rows_smtp = [
        ["Enable Custom SMTP", "Oui (coché)"],
        ["Sender email", "Ton adresse Gmail (ex. moncompte@gmail.com)"],
        ["Sender name", "MemeMasters"],
        ["Host", "smtp.gmail.com"],
        ["Port", "465 (avec SSL) ou 587 (avec TLS)"],
        ["User", "Ton adresse Gmail"],
        ["Password", "Le mot de passe d'application de 16 lettres (sans espaces)"],
    ]
    add_table_data(doc, headers_smtp, rows_smtp)

    add_h1(doc, "6. Étape 5 : Installer les modèles d'e-mails HTML MemeMasters")
    add_body(doc, "Deux magnifiques modèles d'e-mails aux couleurs de MemeMasters ont été créés dans le projet. Il suffit de copier leur code dans Supabase :")
    add_bullet(doc, "Dans Supabase, ouvre Authentication → Email Templates → Reset Password. Copie-colle le contenu du fichier supabase/templates/recovery.html et mets comme sujet « Nouveau mot de passe - MemeMasters ».", "1. Mot de passe oublié : ")
    add_bullet(doc, "Dans Supabase, ouvre Authentication → Email Templates → Confirm Signup. Copie-colle le contenu du fichier supabase/templates/confirmation.html et mets comme sujet « Active ton compte - MemeMasters ».", "2. Activation de compte : ")
    add_bullet(doc, "Dans Supabase, va dans Authentication → URL Configuration et définis l'URL de base de ton site Vercel dans « Site URL » (ex. https://ton-projet.vercel.app sans slash final).", "3. URL Vercel : ")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    doc.save(output_path)
    print(f"Document généré : {output_path}")


# ==============================================================================
# DOCUMENT 2 : STRIPE, MONÉTISATION & CONFORMITÉ LÉGALE
# ==============================================================================
def generate_stripe_doc(output_path):
    doc = Document()
    setup_styles(doc)
    
    add_header_title(
        doc,
        category="MemeMasters • Monétisation & Business",
        title="Guide 2 : Système de Paiements Stripe & Conformité Légale",
        subtitle="Transformer la MemeMoney en revenus réels, intégrer Stripe en toute sécurité et se mettre en règle juridiquement."
    )
    
    add_callout(
        doc,
        "La base de données et l'architecture du jeu MemeMasters sont DÉJÀ prêtes pour Stripe : les tables 'purchases' et 'stripe_events' sont créées, et les packs de MemeMoney sont définis dans src/config/game.config.ts et src/config/shop.ts.",
        title="ARCHITECTURE PRÊTE DANS LE CODE :",
        bg_color="EFF6FF",
        border_color="3B82F6"
    )
    
    add_h1(doc, "1. Comment fonctionne la monétisation dans MemeMasters ?")
    add_body(doc, "Le modèle économique du jeu repose sur la MemeMoney (la monnaie virtuelle du jeu) :")
    add_bullet(doc, "Les joueurs peuvent ouvrir des boosters gratuits chaque jour ou acheter des boosters supplémentaires avec leur MemeMoney.", "• Rôle de la monnaie : ")
    add_bullet(doc, "Pour aller plus vite et compléter leur collection, les joueurs achètent des recharges de MemeMoney avec du vrai argent (carte bancaire, Apple Pay, Google Pay).", "• Ventes de MemeMoney : ")
    add_bullet(doc, "Le paiement est 100 % géré par Stripe Checkout (une page sécurisée hébergée par Stripe). Ton jeu ne touche JAMAIS aux numéros de carte bancaire des joueurs, ce qui te dispense de toute contrainte technique lourde (conformité PCI-DSS).", "• Sécurité bancaire : ")
    add_bullet(doc, "Une fois le paiement validé, Stripe envoie un signal automatique (Webhook) à ton serveur pour créditer instantanément le compte du joueur.", "• Crédit instantané : ")

    add_h1(doc, "2. Les packs de MemeMoney et les tarifs définis dans le jeu")
    add_body(doc, "Les produits configurés dans le code (src/config/game.config.ts) sont les suivants :")
    
    headers_packs = ["Code Produit", "MemeMoney", "Bonus Offert", "Prix en €", "Particularité"]
    rows_packs = [
        ["mm_20", "20 MM", "0", "0,25 €", "⚠️ Sous le minimum Stripe (voir note ci-dessous)"],
        ["mm_100", "100 MM", "+10 bonus", "1,00 €", "Pack populaire (Tag « Popular »)"],
        ["mm_200", "200 MM", "+40 bonus", "2,00 €", "Pack standard"],
        ["mm_500", "500 MM", "+150 bonus", "5,00 €", "Meilleure valeur (Tag « Best Value »)"],
    ]
    add_table_data(doc, headers_packs, rows_packs)
    
    add_callout(
        doc,
        "Règle bancaire Stripe : Stripe refuse les paiements par carte bancaire sous 0,50 €. De plus, les frais fixes de transaction (environ 0,25 € par paiement en Europe) absorberaient 100 % du pack à 0,25 €. En production, le premier pack vendable seul par carte doit donc être celui à 1,00 € (ou un panier minimum de 1,00 €).",
        title="ATTENTION SUR LES PETITS PRIX :",
        bg_color="FEF2F2",
        border_color="EF4444"
    )

    add_h1(doc, "3. Étape 1 : Créer et configurer son compte Stripe")
    add_bullet(doc, "Rends-toi sur https://stripe.com et crée un compte marchand.", "1. Inscription : ")
    add_bullet(doc, "Dans un premier temps, ton compte démarre en « Mode Test ». Tu peux tester des faux paiements avec des cartes fictives (ex. 4242 4242 4242 4242) sans dépenser un centime.", "2. Mode Test : ")
    add_bullet(doc, "Pour recevoir du vrai argent, clique sur « Activer les paiements ». Stripe te demandera tes informations d'entreprise ou de particulier :", "3. Activation Réelle : ")
    add_bullet(doc, "En France, tu peux démarrer en Micro-entreprise (Auto-entrepreneur) ou Société (SASU, SARL). Stripe demande ton numéro SIRET, ton adresse physique, et ton IBAN bancaire pour te verser tes gains.", "4. Statut juridique : ")

    add_h1(doc, "4. Étape 2 : Récupérer les clés API Stripe")
    add_body(doc, "Dans le tableau de bord Stripe (rubrique Développeurs → Clés API) :")
    add_bullet(doc, "STRIPE_SECRET_KEY : Clé secrète qui commence par sk_test_... (en test) ou sk_live_... (en vrai). Ne JAMAIS la divulguer.", "• Clé secrète : ")
    add_bullet(doc, "Cette clé doit être renseignée dans ton fichier .env.local ainsi que dans les variables d'environnement de Vercel (Settings → Environment Variables).", "• Configuration : ")

    add_h1(doc, "5. Étape 3 : Configurer le Webhook Stripe (Livraison automatique)")
    add_body(doc, "Le Webhook est la passerelle de communication sécurisée entre Stripe et MemeMasters :")
    add_bullet(doc, "Dans Stripe Dashboard → Développeurs → Webhooks, clique sur « Ajouter un point de terminaison ».", "1. Création : ")
    add_bullet(doc, "Indique l'URL de ton site en production : https://ton-projet.vercel.app/api/stripe/webhook", "2. URL d'écoute : ")
    add_bullet(doc, "Sélectionne l'événement : checkout.session.completed (cet événement se déclenche uniquement quand la banque confirme que l'argent a été débité).", "3. Événement : ")
    add_bullet(doc, "Stripe te fournit alors un secret de signature : STRIPE_WEBHOOK_SECRET (commence par whsec_...). Ajoute-le dans .env.local et sur Vercel.", "4. Secret Webhook : ")

    add_h1(doc, "6. Étape 4 : L'Étape OBLIGATOIRE — Les Pages Légales du Jeu")
    add_callout(
        doc,
        "Stripe vérifie systématiquement ton site avant d'activer les paiements réels. Si tes pages légales (Mentions Légales, CGU, Politique de Confidentialité) sont vides ou incomplètes, Stripe refusera ou suspendra ton compte vendeur. C'est également une obligation légale stricte en droit français et européen.",
        title="EXIGENCE LÉGALE & STRIPE :",
        bg_color="FFFBEB",
        border_color="F59E0B"
    )
    
    add_body(doc, "Dans le projet MemeMasters, toutes les pages existent déjà ! Il te reste simplement à remplir tes informations dans le fichier src/config/legal.config.ts :")
    
    headers_legal = ["Champ dans legal.config.ts", "Ce qu'il faut écrire", "Obligatoire ?"]
    rows_legal = [
        ["PUBLISHER.name", "Ton Nom et Prénom (ou nom de ton entreprise)", "Oui"],
        ["PUBLISHER.legalForm", "Ex. « Micro-entreprise », « SAS », « Particulier »", "Oui"],
        ["PUBLISHER.registration", "Numéro SIREN ou SIRET (si entreprise)", "Oui (si pro)"],
        ["PUBLISHER.address", "Adresse postale de domiciliation", "Oui"],
        ["PUBLISHER.email", "Adresse e-mail de contact des joueurs", "Oui"],
        ["PUBLISHER.phone", "Numéro de téléphone de contact", "Recommandé"],
        ["PUBLISHER.publicationDirector", "Nom du directeur de la publication (toi-même)", "Oui"],
        ["HOSTS (Supabase)", "Adresse du siège de Supabase Inc.", "Oui"],
    ]
    add_table_data(doc, headers_legal, rows_legal)

    add_h2(doc, "Les 4 pages légales intégrées au jeu :")
    add_bullet(doc, "Accessible sur /mentions-legales : Identifie l'éditeur du site et l'hébergeur conformément à la loi LCEN.", "1. Mentions Légales : ")
    add_bullet(doc, "Accessible sur /conditions-utilisation : Régit l'achat de MemeMoney. Les textes actuels stipulent bien que les achats sont définitifs, sans droit de rétractation une fois la monnaie virtuelle livrée, et réservés aux personnes majeures (+18 ans).", "2. CGU / CGV : ")
    add_bullet(doc, "Accessible sur /confidentialite : Explique le respect du RGPD, la conservation des données de compte et le fait que les paiements sont traités par Stripe sans stockage de carte bancaire sur le jeu.", "3. Politique de Confidentialité : ")
    add_bullet(doc, "Accessible sur /regles-communaute : Interdit la triche, l'utilisation de bots, le harcèlement et la revente de comptes.", "4. Règles de la Communauté : ")

    add_h1(doc, "7. Étape 5 : Protections Joueurs & Réglementations intégrées")
    add_body(doc, "MemeMasters intègre déjà des protections avancées pour respecter les règles des jeux en ligne :")
    add_bullet(doc, "Plafond mensuel de 50 € par joueur par défaut (MONTHLY_SPEND_CAP_CENTS: 5000) pour éviter les dépenses excessives compulsives.", "• Jeu responsable : ")
    add_bullet(doc, "La Belgique interdit strictement les jeux contenant des pochettes de cartes payantes avec tirage aléatoire (Loi sur les jeux de hasard). La boutique est donc automatiquement désactivée pour les connexions belges (BLOCKED_COUNTRIES: ['BE']).", "• Exclusion de la Belgique : ")
    add_bullet(doc, "Seuls les joueurs majeurs (+18 ans) qui ont coché la case d'attestation lors de l'inscription peuvent effectuer des transactions.", "• Majorité requise : ")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    doc.save(output_path)
    print(f"Document généré : {output_path}")

if __name__ == "__main__":
    docs_dir = os.path.join(os.getcwd(), "docs")
    g1 = os.path.join(docs_dir, "Guide_1_Google_OAuth_et_Emails.docx")
    g2 = os.path.join(docs_dir, "Guide_2_Stripe_Paiements_et_MemeMoney.docx")
    generate_google_doc(g1)
    generate_stripe_doc(g2)
