// ═══════════════════════════════════════════════════════════════════════════
// importTemplates.js — génère les modèles CSV téléchargeables pour l'import
// ═══════════════════════════════════════════════════════════════════════════
// Pour chaque type d'import (clients / articles / ouvrages / devis / factures),
// renvoie un CSV avec :
//   - Ligne 1 : headers Supabase RÉELS (ce que la table attend en DB)
//   - Ligne 2 : ligne commentée "# label FR · format" — l'utilisateur la voit
//               en ouvrant le fichier, l'import la skip (cf importParser.js)
//   - Lignes 3-4 : deux exemples plausibles pour aider à comprendre le format
//
// Le séparateur est ',' (standard CSV). Les valeurs contenant , ou " ou \n
// sont entourées de "..." avec échappement "" → "".
// ═══════════════════════════════════════════════════════════════════════════

// ─── Templates ──────────────────────────────────────────────────────────────
// Chaque entrée = { headers: string[], hints: string[], examples: string[][] }
// hints[i] correspond à headers[i] et décrit le format / la contrainte.
const TEMPLATES = {
  clients: {
    filename: "modele-clients.csv",
    headers: ["nom", "prenom", "email", "telephone", "adresse", "code_postal", "ville", "type", "siret", "tva_intra", "notes"],
    hints:   ["Nom (requis)", "Prénom", "Email", "Tél FR 10 chiffres", "Rue + n°", "5 chiffres", "Ville", "particulier|professionnel", "14 chiffres", "FR + 11 chiffres", "Notes libres"],
    examples: [
      ["Dupont", "Jean", "jean@dupont.fr", "0612345678", "12 rue de la Paix", "75001", "Paris", "particulier", "", "", ""],
      ["SARL Bâtiment Sud", "", "contact@batiment-sud.fr", "0478123456", "3 avenue République", "69001", "Lyon", "professionnel", "12345678901234", "FR12123456789", "Client pro régulier"],
    ],
  },
  articles: {
    filename: "modele-articles.csv",
    // Cible : public.articles_catalogue (migration 20260524).
    headers: ["reference", "libelle", "unite", "prix_achat_ht", "tva_pct", "fournisseur_default", "categorie", "sous_categorie"],
    hints:   ["Réf fournisseur (clé dédup)", "Désignation article (requis)", "U|ml|m2|kg|sac|plaque...", "Prix HT en €", "Taux TVA : 5.5, 10, 20", "Point P, Gedimat, Brico Dépôt...", "Plomberie, Électricité, Carrelage...", "Bonde, Disjoncteur..."],
    examples: [
      ["GED-1234", "Bonde siphoïde Ø90 extra-plate", "U", "28.00", "20", "Point P", "Plomberie", "Bonde"],
      ["LM-5678", "Carrelage grès cérame 60x60 gris clair", "m2", "24.90", "20", "Leroy Merlin", "Carrelage", "Sol"],
    ],
  },
  ouvrages: {
    filename: "modele-ouvrages.csv",
    // Cible : public.ouvrages_catalogue (table existante côté Supabase, schéma
    // à confirmer pour Commit 3). Colonnes confirmées en Phase 0 :
    // - corps_id (slug : "plomberie", "carrelage"...)
    // - unite_code (slug : "u", "m2", "ml", "h"...)
    // - source (libre, "Personnel" pour les imports utilisateur)
    // Schéma complet ouvrages_catalogue à venir → ce template sera ajusté.
    headers: ["code", "libelle", "corps_id", "unite_code", "mo_moy", "fourn_moy", "temps_mo_unite", "detail", "source"],
    hints:   ["Code ouvrage unique (clé dédup)", "Désignation ouvrage (requis)", "Slug corps : plomberie|carrelage|electricite|...", "Slug unité : u|m2|m|ml|h|ens|kg", "Coût MO HT moyen", "Coût fournitures HT moyen", "Temps MO heures / unité", "Détail technique", "Personnel (par défaut)"],
    examples: [
      ["MAC-001", "Mur parpaing 20cm hourdé mortier", "maconnerie", "m2", "45.00", "25.00", "1.5", "Pose parpaings 20x20x50, mortier bâtard, joints lissés", "Personnel"],
      ["PEI-002", "Peinture acrylique murs et plafonds 2 couches", "peinture", "m2", "12.00", "4.50", "0.4", "Préparation + sous-couche + 2 couches finition mat ou satin", "Personnel"],
    ],
  },
  devis: {
    filename: "modele-devis.csv",
    // Cible : public.devis (JSONB data). 1 fichier = N lignes CSV groupées
    // par num_devis = 1 devis Supabase (cf prepareDocsForInsert dans importParser).
    headers: ["num_devis", "client_nom", "client_email", "date", "lot", "designation", "quantite", "unite", "pu_ht", "tva", "statut"],
    hints:   ["N° devis (requis, groupement)", "Nom client (lookup primaire, requis)", "Email client (lookup secondaire)", "JJ/MM/AAAA ou AAAA-MM-JJ", "Lot / tranche (groupement intra-devis)", "Désignation ligne (requis)", "Quantité", "U|m2|ml|h|ens", "Prix unitaire HT", "Taux TVA : 5.5, 10, 20", "brouillon|envoyé|accepté|refusé"],
    examples: [
      ["DEV-2026-001", "Dupont Jean", "jean@dupont.fr", "15/03/2026", "Gros œuvre", "Démolition cloison existante", "1", "ens", "350.00", "10", "envoyé"],
      ["DEV-2026-001", "Dupont Jean", "jean@dupont.fr", "15/03/2026", "Carrelage", "Pose carrelage sol 60x60 grès cérame", "25", "m2", "62.50", "10", "envoyé"],
    ],
  },
  factures: {
    filename: "modele-factures.csv",
    // Cible : public.devis avec data.type="facture". Groupement par num_facture.
    headers: ["num_facture", "client_nom", "client_email", "date", "date_echeance", "lot", "designation", "quantite", "unite", "pu_ht", "tva", "statut_paiement"],
    hints:   ["N° facture (requis, groupement)", "Nom client (lookup primaire, requis)", "Email client (lookup secondaire)", "JJ/MM/AAAA ou AAAA-MM-JJ", "Date échéance (J+30 par défaut)", "Lot / tranche", "Désignation ligne (requis)", "Quantité", "U|m2|ml|h|ens", "Prix unitaire HT", "Taux TVA : 5.5, 10, 20", "en attente|payé|annulé"],
    examples: [
      ["FAC-2026-001", "SARL Bâtiment Sud", "contact@batiment-sud.fr", "20/04/2026", "20/05/2026", "Travaux", "Rénovation salle de bain — fourni-posé", "1", "ens", "8500.00", "10", "en attente"],
      ["FAC-2026-002", "Dupont Jean", "jean@dupont.fr", "22/04/2026", "22/05/2026", "Travaux", "Peinture appartement T3 70m²", "70", "m2", "28.00", "10", "payé"],
    ],
  },
};

// ─── Encodage CSV ────────────────────────────────────────────────────────────
// Échappe une cellule selon RFC 4180 : si la valeur contient , " ou \n, on
// l'entoure de "..." et on double les " internes.
function escapeCsvCell(v) {
  const s = v == null ? "" : String(v);
  if (s === "") return "";
  if (/[,"\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowToCsv(cells) {
  return cells.map(escapeCsvCell).join(",");
}

// ─── Génération CSV pour un type ─────────────────────────────────────────────
// Retourne { filename, content } où content est la string CSV complète.
// La ligne 2 (commentée #) reprend les hints du template ; l'import parser
// devra skip toute ligne dont la 1ʳᵉ cellule (après trim) commence par #.
export function buildTemplate(type) {
  const tpl = TEMPLATES[type];
  if (!tpl) throw new Error(`Type d'import inconnu : ${type}`);
  const lines = [];
  // Ligne 1 : headers Supabase réels
  lines.push(rowToCsv(tpl.headers));
  // Ligne 2 : commentée — la première cellule commence par "# " pour signaler
  // au parser de la skip. Les autres cellules contiennent les labels FR + format.
  const commentRow = tpl.hints.map((h, i) => i === 0 ? `# ${h}` : h);
  lines.push(rowToCsv(commentRow));
  // Lignes 3+ : exemples
  for (const ex of tpl.examples) {
    lines.push(rowToCsv(ex));
  }
  // BOM UTF-8 en tête pour qu'Excel ouvre correctement les accents (Médiabat
  // export en CP1252 mais notre template est UTF-8 ; le BOM garantit la
  // détection côté Excel).
  return {
    filename: tpl.filename,
    content: "﻿" + lines.join("\r\n") + "\r\n",
  };
}

// ─── Helper download dans le browser ─────────────────────────────────────────
export function downloadTemplate(type) {
  const { filename, content } = buildTemplate(type);
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Helper introspection pour les tests / debug
export function listTemplateTypes() {
  return Object.keys(TEMPLATES);
}
