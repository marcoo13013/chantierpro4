// ═══════════════════════════════════════════════════════════════════════════
// buildInput.js — convertit (facture, entreprise, client) en FacturXInvoiceInput
// ═══════════════════════════════════════════════════════════════════════════
// Cible : profil BASIC WL (Without Lines).
// Les lignes détaillées NE SONT PAS envoyées dans le XML CII (BASIC WL ne les
// supporte pas) — elles restent visibles dans le PDF pour l'humain. Le XML
// porte les totaux + ventilation TVA par taux + parties (vendeur/acheteur)
// + paiement, ce qui est suffisant pour la facturation électronique B2B FR.
// ═══════════════════════════════════════════════════════════════════════════

// Round 2 décimales (norme Factur-X exige précision 2 décimales sur monnaies)
function r2(n) {
  const v = Number(n) || 0;
  return Math.round(v * 100) / 100;
}

// ISO YYYY-MM-DD à partir d'un timestamp ou d'une string ISO partielle.
function toISODate(d) {
  if (!d) return new Date().toISOString().slice(0, 10);
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return new Date().toISOString().slice(0, 10);
  return dt.toISOString().slice(0, 10);
}

// Date d'échéance par défaut : émission + 30 jours
function defaultDueDate(issueDate) {
  const d = new Date(issueDate);
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

// Aplati toutes les lignes de la facture (qui peut avoir des tranches/postes
// imbriqués selon le format de stockage ChantierPro) en une liste plate.
function extraireLignesPlates(facture) {
  const out = [];
  // Format simple : facture.lignes = [...]
  if (Array.isArray(facture?.lignes)) {
    for (const l of facture.lignes) {
      if (l?.type === "titre" || l?.type === "soustitre") continue; // labels
      out.push(l);
    }
  }
  // Format tranches : facture.tranches = [{lignes:[...]}]
  if (Array.isArray(facture?.tranches)) {
    for (const t of facture.tranches) {
      for (const l of (t?.lignes || [])) {
        if (l?.type === "titre" || l?.type === "soustitre") continue;
        out.push(l);
      }
    }
  }
  return out;
}

// Calcule le total HT d'une ligne. Compatible CreateurDevis (prixUnitHT × qte)
// et ancien format (puHT × qte).
function totalHTLigne(l) {
  const pu = Number(l.prixUnitHT ?? l.puHT ?? 0);
  const q = Number(l.qte ?? l.quantite ?? 1);
  return pu * q;
}

// Taux TVA applicable à une ligne (par défaut 20)
function tvaPctLigne(l) {
  const t = Number(l.tvaPct ?? l.tva ?? 20);
  return Number.isFinite(t) ? t : 20;
}

// Mapping taux TVA → categoryCode VatCategoryCode (UNCL5305).
// Pour la France :
//   "S" (Standard rate) : 20 %, 10 %, 5.5 %, 2.1 %
//   "Z" (Zero rated) : 0 %
//   "E" (Exempt) : exonéré (export, etc.)
function vatCategoryCodeFromPct(pct) {
  const p = Number(pct);
  if (p === 0) return "Z"; // zero rated
  return "S"; // standard rate (FR a plusieurs taux mais tous "S")
}

// Construit la ventilation TVA par taux (BG-23 / BT-116 / BT-117).
// Si autoliquidation BTP : une seule entrée "AE" (Reverse Charge UNCL5305)
// avec taux 0 et la totalité du HT en base imposable. Le preneur (donneur
// d'ordre BTP) reverse la TVA à l'administration — art. 283-2 nonies CGI.
function ventilationTVA(lignes, { autoliquidation = false } = {}) {
  if (autoliquidation) {
    const totalHT = lignes.reduce((a, l) => a + totalHTLigne(l), 0);
    return [{
      categoryCode: "AE", // VAT Reverse Charge
      ratePercent: 0,
      taxableAmount: r2(totalHT),
      taxAmount: 0,
      exemptionReason: "Autoliquidation - TVA due par le preneur (art. 283-2 nonies du CGI)",
    }];
  }
  const grouped = new Map();
  for (const l of lignes) {
    const pct = tvaPctLigne(l);
    const ht = totalHTLigne(l);
    const key = pct;
    const cur = grouped.get(key) || { ratePercent: pct, taxableAmount: 0, taxAmount: 0 };
    cur.taxableAmount += ht;
    cur.taxAmount += ht * (pct / 100);
    grouped.set(key, cur);
  }
  return Array.from(grouped.values()).map((b) => ({
    categoryCode: vatCategoryCodeFromPct(b.ratePercent),
    ratePercent: r2(b.ratePercent),
    taxableAmount: r2(b.taxableAmount),
    taxAmount: r2(b.taxAmount),
  }));
}

// Adresse cliente : on combine adresse (rue) + code_postal + ville.
// Si client n'a pas tout, fallback minimal France (city = "Paris" pour passer
// la validation BR-58 — au moins city/postal/country requis).
function adresseClient(client) {
  return {
    line1: (client?.adresse || "").trim() || "Adresse non renseignée",
    city: (client?.ville || "").trim() || "Non renseignée",
    postalCode: (client?.code_postal || "").trim() || "00000",
    country: (client?.pays || "FR").toUpperCase().slice(0, 2),
  };
}

function adresseEntreprise(entreprise) {
  return {
    line1: (entreprise?.adresse || "").trim() || "Adresse non renseignée",
    city: (entreprise?.ville || "").trim() || "Non renseignée",
    postalCode: (entreprise?.code_postal || "").trim() || "00000",
    country: (entreprise?.pays || "FR").toUpperCase().slice(0, 2),
  };
}

// ─── Export principal ────────────────────────────────────────────────────────
export function buildFacturXInvoiceInput({ facture, entreprise, client }) {
  const lignesPlates = extraireLignesPlates(facture);
  const breakdown = ventilationTVA(lignesPlates, {
    autoliquidation: facture?.autoliquidation_btp === true,
  });

  const lineTotal = r2(breakdown.reduce((a, b) => a + b.taxableAmount, 0));
  const taxTotal = r2(breakdown.reduce((a, b) => a + b.taxAmount, 0));
  const grandTotal = r2(lineTotal + taxTotal);

  const issueDate = toISODate(facture?.dateEmission || facture?.date_emission || facture?.date);
  const dueDate = facture?.dateEcheance || facture?.date_echeance || defaultDueDate(issueDate);

  // Tax registrations : on met TVA intra et SIRET (FC). Les deux sont utiles
  // pour le validateur et l'écosystème PEPPOL/PPF.
  const sellerTaxRegs = [];
  if (entreprise?.tva_intra) {
    sellerTaxRegs.push({ id: String(entreprise.tva_intra).replace(/\s/g, "").toUpperCase(), schemeId: "VA" });
  }
  if (entreprise?.siret) {
    sellerTaxRegs.push({ id: String(entreprise.siret).replace(/\s/g, ""), schemeId: "FC" });
  }

  const buyerTaxRegs = [];
  if (client?.tva_intra) {
    buyerTaxRegs.push({ id: String(client.tva_intra).replace(/\s/g, "").toUpperCase(), schemeId: "VA" });
  }
  if (client?.siret) {
    buyerTaxRegs.push({ id: String(client.siret).replace(/\s/g, ""), schemeId: "FC" });
  }

  // Nom acheteur : raison sociale si pro, sinon nom + prénom particulier
  const buyerName = (client?.raison_sociale && client.raison_sociale.trim())
    || ([client?.prenom, client?.nom].filter(Boolean).join(" ").trim())
    || (client?.nom || "Client").trim();

  const input = {
    document: {
      id: String(facture?.numero || "FACT-?"),
      issueDate,
      // typeCode default = COMMERCIAL_INVOICE (380), pas besoin de l'expliciter
      buyerReference: facture?.referenceCommande || facture?.reference_commande || undefined,
    },
    seller: {
      name: (entreprise?.nom || "Mon Entreprise").trim(),
      address: adresseEntreprise(entreprise),
      taxRegistrations: sellerTaxRegs.length > 0 ? sellerTaxRegs : undefined,
    },
    buyer: {
      name: buyerName,
      address: adresseClient(client),
      taxRegistrations: buyerTaxRegs.length > 0 ? buyerTaxRegs : undefined,
    },
    // BASIC WL : pas de lignes — le PDF visuel les contient pour l'humain
    payment: {
      meansCode: "30", // Credit transfer (UNCL 4461)
      dueDate,
      iban: entreprise?.iban ? String(entreprise.iban).replace(/\s/g, "").toUpperCase() : undefined,
      // BIC inclus seulement si valide (champ optionnel BASIC_WL)
      bic: entreprise?.bic ? String(entreprise.bic).replace(/\s/g, "").toUpperCase() : undefined,
    },
    totals: {
      lineTotal,
      taxBasisTotal: lineTotal,
      taxTotal,
      grandTotal,
      duePayableAmount: grandTotal,
      currency: "EUR",
    },
    vatBreakdown: breakdown.length > 0 ? breakdown : [
      // Garde-fou : facture sans ligne, on met une ventilation 0 € TVA 20 %
      // pour passer la validation BR-CO-18 (au moins une catégorie TVA requise)
      { categoryCode: "S", ratePercent: 20, taxableAmount: 0, taxAmount: 0 },
    ],
  };

  return input;
}
