// ═══════════════════════════════════════════════════════════════════════════
// Devis-démo v2 — Structure hiérarchique TRANCHES / LIGNES (Sprint 1)
// ═══════════════════════════════════════════════════════════════════════════
// Nouvelle structure : devis.tranches[].lignes[] (vs anciennement devis.lignes[])
// Chaque tranche a son sous-total auto-calculé.
//
// Utilisation :
//   import { DEVIS_DEMO_PAR_CORPS, getDevisDemoPourCorps } from "./lib/devisDemo";
//   const devisDemo = getDevisDemoPourCorps("plomberie");
//
// Structure d'un devis :
//   {
//     numero, client: {nom, email, tel, adresse},
//     objet, dateEmission, validiteJours, statut, tauxTVA,
//     tranches: [
//       { id, titre, lignes: [{code, libelle, qte, unite, puHT, totalHT, corps}], sousTotalHT }
//     ],
//     totalHT, totalTVA, totalTTC,
//     notes, isDemo, corpsPrincipal
//   }
// ═══════════════════════════════════════════════════════════════════════════

// Helper : créer une ligne
function L(code, libelle, qte, unite, puHT, corps) {
  const totalHT = +(qte * puHT).toFixed(2);
  return { code, libelle, qte, unite, puHT, totalHT, corps };
}

// Helper : créer une tranche avec calcul auto du sous-total
function T(id, titre, lignes) {
  const sousTotalHT = +lignes.reduce((s, l) => s + (l.totalHT || 0), 0).toFixed(2);
  return { id, titre, lignes, sousTotalHT };
}

// Helper : finaliser un devis (calcul des totaux)
function finaliseDevis(devis, tauxTVA = 10) {
  const totalHT = +devis.tranches.reduce((s, t) => s + (t.sousTotalHT || 0), 0).toFixed(2);
  const totalTVA = +(totalHT * tauxTVA / 100).toFixed(2);
  const totalTTC = +(totalHT + totalTVA).toFixed(2);
  const lignes=(devis.tranches||[]).reduce((a,t)=>a.concat((t.lignes||[]).map(l=>({...l,prixUnitHT:l.prixUnitHT||l.puHT||0}))),[]); return { ...devis, tauxTVA, totalHT, totalTVA, totalTTC, lignes };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. PLOMBERIE — Rénovation salle de bain (3 tranches)
// ═══════════════════════════════════════════════════════════════════════════
const DEVIS_PLOMBERIE = finaliseDevis({
  numero: "DEMO-PLO-001",
  client: { nom: "M. Martin", email: "martin.demo@example.com", tel: "06 00 00 00 01", adresse: "12 rue des Lilas, 13000 Marseille" },
  objet: "Rénovation complète salle de bain (8m²)",
  dateEmission: "2026-04-15",
  validiteJours: 90,
  statut: "envoyé",
  tranches: [
    T("T1", "DÉPOSE & PRÉPARATION", [
      L("DEPOSE-SDB", "Dépose ancienne salle de bain (lavabo, WC, douche)", 1, "F", 320, "Plomberie"),
      L("EVAC-DECH", "Évacuation déchets en déchetterie agréée",            1, "F", 120, "Plomberie"),
    ]),
    T("T2", "FOURNITURE & POSE SANITAIRES", [
      L("PLO-001", "Lavabo simple vasque posé sur meuble",                1, "U", 280, "Plomberie"),
      L("PLO-002", "WC suspendu avec bâti-support",                       1, "U", 720, "Plomberie"),
      L("PLO-004", "Douche receveur extra-plat + colonne thermostatique", 1, "U", 980, "Plomberie"),
      L("PLO-011", "Robinet mélangeur lavabo chromé",                     1, "U", 165, "Plomberie"),
    ]),
    T("T3", "RÉSEAUX & FINITIONS", [
      L("PLO-007", "Tube cuivre diamètre 14/16 mm (alimentation)",       28, "ml", 14,  "Plomberie"),
      L("PLO-009", "Évacuation PVC diamètre 40 mm",                      18, "ml", 12,  "Plomberie"),
      L("PEI-006", "Peinture intérieure plafond salle de bain",           4, "m²", 14,  "Peinture"),
    ]),
  ],
  notes: "Délai de réalisation : 5 jours ouvrés. Évacuation déchets incluse. Garantie décennale.",
  isDemo: true,
  corpsPrincipal: "plomberie",
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. ÉLECTRICITÉ — Mise aux normes T3 (4 tranches)
// ═══════════════════════════════════════════════════════════════════════════
const DEVIS_ELECTRICITE = finaliseDevis({
  numero: "DEMO-ELE-001",
  client: { nom: "Mme Bernard", email: "bernard.demo@example.com", tel: "06 00 00 00 02", adresse: "8 avenue du Prado, 13008 Marseille" },
  objet: "Mise aux normes électriques T3 (75m²)",
  dateEmission: "2026-04-18",
  validiteJours: 90,
  statut: "brouillon",
  tranches: [
    T("T1", "DÉPOSE & SÉCURISATION", [
      L("ELE-DEPOSE", "Dépose ancienne installation électrique",  1, "F", 480, "Électricité"),
    ]),
    T("T2", "TABLEAU & CÂBLAGE", [
      L("ELE-TABLEAU", "Tableau électrique 3 rangées + disjoncteur 30mA", 1, "U", 620, "Électricité"),
      L("ELE-LUMIERE", "Point lumineux DCL avec câblage",                18, "U", 65,  "Électricité"),
    ]),
    T("T3", "APPAREILLAGE", [
      L("ELE-PRISES", "Pose prise 16A complète (encastrée)", 32, "U", 38, "Électricité"),
      L("ELE-INTER",  "Pose interrupteur va-et-vient",       18, "U", 32, "Électricité"),
      L("ELE-RJ45",   "Prise RJ45 catégorie 6",               4, "U", 58, "Électricité"),
    ]),
    T("T4", "CONTRÔLE & CONFORMITÉ", [
      L("ELE-CONSUEL", "Attestation de conformité Consuel", 1, "F", 180, "Électricité"),
    ]),
  ],
  notes: "Coupure courant 1 jour. Test fin de chantier inclus. Certificat Consuel fourni.",
  isDemo: true,
  corpsPrincipal: "electricite",
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. MAÇONNERIE / GROS ŒUVRE — Construction garage (4 tranches, TVA 20%)
// ═══════════════════════════════════════════════════════════════════════════
const DEVIS_MACONNERIE = finaliseDevis({
  numero: "DEMO-MAC-001",
  client: { nom: "M. Durand", email: "durand.demo@example.com", tel: "06 00 00 00 03", adresse: "Lot. Les Pins, 13013 Marseille" },
  objet: "Construction garage individuel 28m²",
  dateEmission: "2026-04-10",
  validiteJours: 90,
  statut: "accepté",
  tranches: [
    T("T1", "GROS ŒUVRE - FONDATIONS", [
      L("MAC-TERR", "Terrassement et préparation terrain (28m²)", 28, "m²", 18, "Maçonnerie"),
      L("MAC-001",  "Fondations semelles filantes + béton armé",  18, "ml", 95, "Maçonnerie"),
    ]),
    T("T2", "ÉLÉVATION & DALLE", [
      L("MAC-002",   "Dalle béton armée 15cm + treillis", 28, "m²", 78,   "Maçonnerie"),
      L("MAC-003",   "Élévation parpaings 20x20x50",      72, "m²", 62,   "Maçonnerie"),
      L("MAC-CHAIN", "Chaînages horizontaux + verticaux",  1, "F", 1280,  "Maçonnerie"),
      L("MAC-LINT",  "Linteaux béton préfabriqués",        3, "U", 145,   "Maçonnerie"),
    ]),
    T("T3", "FINITIONS EXTÉRIEURES", [
      L("MAC-ENDUIT", "Enduit ciment hydrofuge extérieur", 72, "m²", 42, "Maçonnerie"),
    ]),
    T("T4", "MENUISERIE & FERMETURES", [
      L("MEN-PORTE", "Porte de garage sectionnelle motorisée", 1, "U", 1850, "Menuiserie"),
    ]),
  ],
  notes: "Délai 4 semaines. Permis de construire à la charge du client. Garantie décennale.",
  isDemo: true,
  corpsPrincipal: "maconnerie",
}, 20); // TVA 20% (construction neuve)

// ═══════════════════════════════════════════════════════════════════════════
// 4. CARRELAGE / REVÊTEMENT — Cuisine + Cellier (3 tranches)
// ═══════════════════════════════════════════════════════════════════════════
const DEVIS_CARRELAGE = finaliseDevis({
  numero: "DEMO-CAR-001",
  client: { nom: "Mme Lopez", email: "lopez.demo@example.com", tel: "06 00 00 00 04", adresse: "23 bd Michelet, 13009 Marseille" },
  objet: "Pose carrelage cuisine 18m² + cellier 6m² + faïence",
  dateEmission: "2026-04-22",
  validiteJours: 90,
  statut: "envoyé",
  tranches: [
    T("T1", "PRÉPARATION SUPPORT", [
      L("CAR-PREP", "Préparation support + ragréage", 24, "m²", 22, "Carrelage"),
    ]),
    T("T2", "POSE SOLS", [
      L("CAR-001",   "Pose carrelage sol grès cérame ≤30x30", 18, "m²", 47,  "Carrelage"),
      L("CAR-003",   "Pose grand format 80x80 dans cellier",   6, "m²", 74,  "Carrelage"),
      L("CAR-PLINT", "Plinthes assorties (contour pièce)",    18, "ml", 12,  "Carrelage"),
    ]),
    T("T3", "POSE MURS & FINITIONS", [
      L("CAR-004",   "Pose faïence murale crédence cuisine", 6.5, "m²", 46,  "Carrelage"),
      L("CAR-JOINTS","Joints époxy hydrofuge",                 1, "F", 180,  "Carrelage"),
    ]),
  ],
  notes: "Carrelage fourni par le client. Pose dans les 3 jours. Évacuation gravats incluse.",
  isDemo: true,
  corpsPrincipal: "carrelage",
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. PEINTURE / ENDUIT — Rafraîchissement T3 (2 tranches)
// ═══════════════════════════════════════════════════════════════════════════
const DEVIS_PEINTURE = finaliseDevis({
  numero: "DEMO-PEI-001",
  client: { nom: "M. Petit", email: "petit.demo@example.com", tel: "06 00 00 00 05", adresse: "5 rue Paradis, 13001 Marseille" },
  objet: "Rafraîchissement complet T3 (75m² murs + plafonds)",
  dateEmission: "2026-04-25",
  validiteJours: 90,
  statut: "envoyé",
  tranches: [
    T("T1", "PRÉPARATION & PROTECTION", [
      L("PEI-PREP",   "Préparation : rebouchage, ponçage, brossage", 75, "m²", 7,   "Peinture"),
      L("PEI-PROTEC", "Bâches de protection mobilier + sols",         1, "F", 120, "Peinture"),
    ]),
    T("T2", "MISE EN PEINTURE", [
      L("PEI-005", "Sous-couche + 2 couches mate murs",            210, "m²", 10,  "Peinture"),
      L("PEI-006", "Peinture plafond mate spéciale",                75, "m²", 13,  "Peinture"),
      L("PEI-010", "Peinture glycéro boiseries (portes, plinthes)",  1, "F", 480,  "Peinture"),
    ]),
  ],
  notes: "Peinture acrylique mate blanche standard incluse. Couleurs spécifiques en option (+15%).",
  isDemo: true,
  corpsPrincipal: "peinture",
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. MENUISERIE — Pose 8 fenêtres PVC (3 tranches)
// ═══════════════════════════════════════════════════════════════════════════
const DEVIS_MENUISERIE = finaliseDevis({
  numero: "DEMO-MEN-001",
  client: { nom: "M. Roux", email: "roux.demo@example.com", tel: "06 00 00 00 06", adresse: "16 rue de Rome, 13006 Marseille" },
  objet: "Remplacement 8 fenêtres PVC + volets roulants électriques",
  dateEmission: "2026-04-20",
  validiteJours: 90,
  statut: "accepté",
  tranches: [
    T("T1", "DÉPOSE", [
      L("MEN-DEPOSE", "Dépose 8 dormants existants + évacuation", 8, "U", 110, "Menuiserie"),
    ]),
    T("T2", "FOURNITURE & POSE MENUISERIES", [
      L("MEN-FEN",   "Fenêtre PVC double vitrage 4-16-4 (120x100)", 6, "U", 480, "Menuiserie"),
      L("MEN-FENGD", "Fenêtre PVC grande dimension (180x140)",       2, "U", 720, "Menuiserie"),
      L("MEN-POSE",  "Pose en applique avec mousse PU + finitions",  8, "U", 145, "Menuiserie"),
    ]),
    T("T3", "VOLETS & ÉTANCHÉITÉ", [
      L("MEN-006",    "Volet roulant électrique aluminium",         8, "U", 380, "Menuiserie"),
      L("MEN-ETANCH", "Joint étanchéité périphérique extérieur",    8, "U", 32,  "Menuiserie"),
    ]),
  ],
  notes: "Éligible MaPrimeRénov'. Devis valable pour aide CEE. Pose en 2 jours.",
  isDemo: true,
  corpsPrincipal: "menuiserie",
});

// ═══════════════════════════════════════════════════════════════════════════
// MAPPING activité principale → devis-démo
// ═══════════════════════════════════════════════════════════════════════════
export const DEVIS_DEMO_PAR_CORPS = {
  plomberie:    DEVIS_PLOMBERIE,
  electricite:  DEVIS_ELECTRICITE,
  maconnerie:   DEVIS_MACONNERIE,
  carrelage:    DEVIS_CARRELAGE,
  peinture:     DEVIS_PEINTURE,
  menuiserie:   DEVIS_MENUISERIE,
  // renovation_generale + multi_corps : utilisent Djaouel (déjà en mémoire)
};

// Helper : récupérer le devis-démo correspondant à une activité principale
export function getDevisDemoPourCorps(corps) {
  if (!corps) return null;
  const key = String(corps)
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s/]+/g, "_")
    .replace(/_+$/, "");

  const aliases = {
    plombier:                  "plomberie",
    plomberie:                 "plomberie",
    electricien:               "electricite",
    electricite:               "electricite",
    macon:                     "maconnerie",
    maconnerie:                "maconnerie",
    "maconnerie_gros_oeuvre":  "maconnerie",
    "gros_oeuvre":             "maconnerie",
    carreleur:                 "carrelage",
    carrelage:                 "carrelage",
    "carrelage_revetement":    "carrelage",
    peintre:                   "peinture",
    peinture:                  "peinture",
    "peinture_enduit":         "peinture",
    menuisier:                 "menuiserie",
    menuiserie:                "menuiserie",
  };

  const normalized = aliases[key] || key;
  return DEVIS_DEMO_PAR_CORPS[normalized] || null;
}
