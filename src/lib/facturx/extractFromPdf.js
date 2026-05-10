// ═══════════════════════════════════════════════════════════════════════════
// extractFromPdf.js — extraction d'une facture depuis un PDF Factur-X
// ═══════════════════════════════════════════════════════════════════════════
// Pipeline :
//   1. FileReader → ArrayBuffer (lu côté client, jamais uploadé serveur)
//   2. Lazy-load @stackforge-eu/factur-x (chunk déjà tiré par la génération
//      Factur-X — coût bundle 0 si déjà downloadé)
//   3. extractXml(bytes) → { xml, filename, profile }
//   4. parseCIIXml(xml) → facture structurée { numero, date, client, lignes,
//      totaux, factureMeta }
//
// Le parsing CII utilise DOMParser natif + match par localName (pas de XPath,
// pas de bibliothèque XML supplémentaire). On évite les pièges classiques :
//   - Namespace ram: parfois manquant → matchage par localName
//   - Dates format YYYYMMDD (UN/CEFACT standard) ou ISO → normalisation
//   - Montants avec séparateurs variés → parseAmount robuste
//   - Profils MINIMUM/BASIC WL sans lignes → on génère 1 ligne récap par taux
//     TVA extrait de ApplicableTradeTax (BT-116 assiette + BT-119 taux)
// ═══════════════════════════════════════════════════════════════════════════

// Limite : 20 MB pour les PDF (décision 7 validée — Factur-X parfois lourds).
const PDF_MAX_BYTES = 20 * 1024 * 1024;

// ─── Lecture fichier → Uint8Array ───────────────────────────────────────────
async function pdfFileToBytes(file) {
  if (!file) throw new Error("Aucun fichier fourni");
  if (file.size > PDF_MAX_BYTES) {
    throw new Error(`Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} MB, max 20 MB)`);
  }
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

// ─── Helpers de parsing ─────────────────────────────────────────────────────

// Trouve le 1ᵉʳ descendant direct ou indirect d'un nœud avec un localName donné.
// Insensible au namespace (utile car la déclaration `ram:` peut varier selon
// l'éditeur de Factur-X).
function findChild(node, localName) {
  if (!node) return null;
  // Parcours BFS pour préférer les descendants peu profonds (cas où le même
  // nom apparaît à plusieurs niveaux, ex Name dans Party et dans Product).
  const queue = [...(node.children || [])];
  while (queue.length) {
    const n = queue.shift();
    if (n.localName === localName) return n;
    queue.push(...(n.children || []));
  }
  return null;
}

// Renvoie tous les descendants directs/indirects matchant un localName.
function findAllChildren(node, localName) {
  const out = [];
  if (!node) return out;
  const queue = [...(node.children || [])];
  while (queue.length) {
    const n = queue.shift();
    if (n.localName === localName) out.push(n);
    queue.push(...(n.children || []));
  }
  return out;
}

// Renvoie tous les enfants DIRECTS (pas descendants) avec un localName donné.
// Utilisé pour itérer les <IncludedSupplyChainTradeLineItem> sans capter les
// lignes imbriquées (cas rare mais possible avec EXTENDED).
function findDirectChildren(node, localName) {
  if (!node) return [];
  return Array.from(node.children || []).filter(c => c.localName === localName);
}

function textOf(node) {
  if (!node) return "";
  return (node.textContent || "").trim();
}

// Parse une date Factur-X. Standard UN/CEFACT : `YYYYMMDD` (format 102 selon
// l'attribut `format` du nœud DateTimeString). On accepte aussi ISO au cas où.
function parseFacturXDate(s) {
  if (!s) return null;
  const v = String(s).trim();
  // YYYYMMDD (format 102, le plus courant)
  let m = v.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // ISO complet ou partiel
  m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

// Parse un montant : tolère espaces (séparateurs de milliers), virgule
// décimale FR, signes scientifiques. Retourne 0 si non parsable.
function parseAmount(s) {
  if (s == null || s === "") return 0;
  const cleaned = String(s).replace(/\s/g, "").replace(",", ".").replace(/[^\d.\-eE+]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// ─── Parsing du XML CII ─────────────────────────────────────────────────────
// Norme UN/CEFACT — racine `<rsm:CrossIndustryInvoice>`. Les sections :
//   - ExchangedDocument : header (BT-1 numéro, BT-2 date, BT-3 typeCode)
//   - SupplyChainTradeTransaction
//     - IncludedSupplyChainTradeLineItem (BG-25 — N lignes)
//     - ApplicableHeaderTradeAgreement (parties seller/buyer)
//     - ApplicableHeaderTradeDelivery
//     - ApplicableHeaderTradeSettlement (BG-22 totaux, BG-23 ventilation TVA,
//       BG-16 paiement)
function parseCIIXml(xml) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  // Erreur de parse : présence d'un <parsererror> dans le document
  const parseError = doc.getElementsByTagName("parsererror")[0];
  if (parseError) {
    throw new Error("XML Factur-X illisible : " + textOf(parseError).slice(0, 200));
  }
  const root = doc.documentElement;
  if (!root) throw new Error("XML vide");

  // ─── Header (BT-1, BT-2, BT-3) ────────────────────────────────────────────
  const exchangedDoc = findChild(root, "ExchangedDocument");
  const idNode = findChild(exchangedDoc, "ID");
  const issueDateNode = findChild(findChild(exchangedDoc, "IssueDateTime"), "DateTimeString");
  const typeCodeNode = findChild(exchangedDoc, "TypeCode");

  const numero = textOf(idNode) || "FACT-?";
  const date = parseFacturXDate(textOf(issueDateNode)) || new Date().toISOString().slice(0, 10);
  const typeCode = textOf(typeCodeNode) || "380";

  // ─── Transaction (lignes + parties + settlement) ─────────────────────────
  const tx = findChild(root, "SupplyChainTradeTransaction");

  // Parties : on cherche BuyerTradeParty dans ApplicableHeaderTradeAgreement.
  const agreement = findChild(tx, "ApplicableHeaderTradeAgreement");
  const buyer = findChild(agreement, "BuyerTradeParty");
  const buyerName = textOf(findChild(buyer, "Name"));
  // Email acheteur (BT-49) : DefinedTradeContact/EmailURIUniversalCommunication/URIID
  const buyerContact = findChild(buyer, "DefinedTradeContact");
  const buyerEmailComm = findChild(buyerContact, "EmailURIUniversalCommunication");
  const buyerEmail = textOf(findChild(buyerEmailComm, "URIID"));
  // Adresse acheteur (BT-50..55) : facultatif, utile pour suggérer un client
  const buyerAddr = findChild(buyer, "PostalTradeAddress");
  const buyerAddress = {
    line1: textOf(findChild(buyerAddr, "LineOne")) || null,
    postalCode: textOf(findChild(buyerAddr, "PostcodeCode")) || null,
    city: textOf(findChild(buyerAddr, "CityName")) || null,
    country: textOf(findChild(buyerAddr, "CountryID")) || "FR",
  };

  // Settlement (totaux + ventilation TVA + paiement)
  const settlement = findChild(tx, "ApplicableHeaderTradeSettlement");

  // Date échéance (BT-9) : SpecifiedTradePaymentTerms/DueDateDateTime/DateTimeString
  const paymentTerms = findChild(settlement, "SpecifiedTradePaymentTerms");
  const dueDateNode = findChild(findChild(paymentTerms, "DueDateDateTime"), "DateTimeString");
  const dateEcheance = parseFacturXDate(textOf(dueDateNode));

  // Totaux (BT-109 line, BT-110 tva, BT-112 ttc)
  const totauxNode = findChild(settlement, "SpecifiedTradeSettlementHeaderMonetarySummation");
  const totalHT = parseAmount(textOf(findChild(totauxNode, "TaxBasisTotalAmount")));
  const totalTVA = parseAmount(textOf(findChild(totauxNode, "TaxTotalAmount")));
  const totalTTC = parseAmount(textOf(findChild(totauxNode, "GrandTotalAmount")))
    || (totalHT + totalTVA);

  // Ventilation TVA par taux (BG-23) : ApplicableTradeTax (N entrées)
  // Chaque entrée : CalculatedAmount (BT-117), BasisAmount (BT-116),
  // RateApplicablePercent (BT-119), TypeCode (BT-118 "VAT"), CategoryCode (BT-118)
  const vatBreakdown = findAllChildren(settlement, "ApplicableTradeTax").map(tax => ({
    basisAmount: parseAmount(textOf(findChild(tax, "BasisAmount"))),
    taxAmount: parseAmount(textOf(findChild(tax, "CalculatedAmount"))),
    rate: parseAmount(textOf(findChild(tax, "RateApplicablePercent"))),
    categoryCode: textOf(findChild(tax, "CategoryCode")) || "S",
  }));

  // ─── Lignes (BG-25) — uniquement BASIC, EN16931, EXTENDED ──────────────
  // Chaque ligne : SpecifiedTradeProduct/Name (BT-153), BilledQuantity
  // (BT-129) + attribut unitCode (BT-130), NetPriceProductTradePrice/
  // ChargeAmount (BT-146), ApplicableTradeTax/RateApplicablePercent (BT-152).
  const lineNodes = findDirectChildren(tx, "IncludedSupplyChainTradeLineItem");
  const lignesXml = lineNodes.map((ln, idx) => {
    const product = findChild(ln, "SpecifiedTradeProduct");
    const designation = textOf(findChild(product, "Name")) || `Ligne ${idx + 1}`;
    const delivery = findChild(ln, "SpecifiedLineTradeDelivery");
    const qteNode = findChild(delivery, "BilledQuantity");
    const qte = parseAmount(textOf(qteNode)) || 1;
    const unite = qteNode?.getAttribute("unitCode") || "U";
    const lineAgreement = findChild(ln, "SpecifiedLineTradeAgreement");
    const priceNode = findChild(findChild(lineAgreement, "NetPriceProductTradePrice"), "ChargeAmount");
    const prixUnitHT = parseAmount(textOf(priceNode));
    const lineSettle = findChild(ln, "SpecifiedLineTradeSettlement");
    const tax = findChild(lineSettle, "ApplicableTradeTax");
    const tvaRate = parseAmount(textOf(findChild(tax, "RateApplicablePercent")));
    return {
      designation,
      qte,
      unite,
      prixUnitHT,
      tva: tvaRate || 20,
    };
  });

  return {
    numero,
    date,
    typeCode,
    dateEcheance,
    buyer: {
      nom: buyerName || "Client inconnu",
      email: buyerEmail || null,
      address: buyerAddress,
    },
    totaux: {
      ht: totalHT,
      tva: totalTVA,
      ttc: totalTTC,
    },
    vatBreakdown,
    lignesXml,
  };
}

// ─── Mapping unité UN/CEFACT → libellé interne ChantierPro ──────────────────
// Les unitCode des Factur-X suivent la nomenclature UN/CEFACT Rec 20.
// On mappe les plus courantes vers les libellés que ChantierPro utilise dans
// le devis pour rester cohérent avec l'UI existante. Les autres unitCode sont
// laissés tels quels (utilisable mais affichage brut).
const UNIT_CODE_MAP = {
  C62: "U",     // One (= unité, pièce)
  PCE: "U",     // Pieces
  EA:  "U",     // Each
  MTK: "m²",
  MTQ: "m³",
  MTR: "m",
  LM:  "ml",    // Linear meter (alias FR)
  HUR: "h",
  HRS: "h",
  KGM: "kg",
  LTR: "L",
  TNE: "T",
  XBJ: "bidon",
  XRO: "rouleau",
  XSA: "sac",
};
function mapUnitCode(code) {
  if (!code) return "U";
  return UNIT_CODE_MAP[code.toUpperCase()] || code;
}

// ─── Construction de la facture finale ──────────────────────────────────────
// Retourne l'objet qu'on stockera dans `devis.data` :
//   { type, date, numero, client, lignes, totaux, factureMeta }
// Pour MINIMUM/BASIC_WL : pas de lignesXml → on génère 1 ligne récap par
// taux TVA présent dans vatBreakdown (décision 5 validée).
function buildFactureFromParsed(parsed, { profile, filename }) {
  const profileStr = String(profile || "").toUpperCase();
  const isMinimal = profileStr === "MINIMUM" || profileStr === "BASIC_WL" || profileStr === "BASIC WL"
    || parsed.lignesXml.length === 0;

  let lignes;
  if (isMinimal && parsed.vatBreakdown.length > 0) {
    // 1 ligne récap par taux TVA
    lignes = parsed.vatBreakdown.map((vat, idx) => ({
      id: Date.now() + idx,
      type: "ligne",
      libelle: `Prestations selon facture PDF (TVA ${vat.rate}%)`,
      qte: 1,
      unite: "ens",
      prixUnitHT: Math.round(vat.basisAmount * 100) / 100,
      tva: vat.rate,
    }));
  } else if (parsed.lignesXml.length > 0) {
    lignes = parsed.lignesXml.map((l, idx) => ({
      id: Date.now() + idx,
      type: "ligne",
      libelle: l.designation,
      qte: l.qte,
      unite: mapUnitCode(l.unite),
      prixUnitHT: Math.round(l.prixUnitHT * 100) / 100,
      tva: l.tva,
    }));
  } else {
    // Fallback ultime : aucune ligne ni ventilation → 1 ligne récap au total HT
    lignes = [{
      id: Date.now(),
      type: "ligne",
      libelle: "Prestations selon facture PDF",
      qte: 1,
      unite: "ens",
      prixUnitHT: parsed.totaux.ht,
      tva: parsed.totaux.ht > 0
        ? Math.round((parsed.totaux.tva / parsed.totaux.ht) * 100 * 10) / 10
        : 20,
    }];
  }

  return {
    // Champs racines lus par VueFactures, ApercuDevis, etc.
    numero: parsed.numero,
    date: parsed.date,
    client: parsed.buyer.nom,
    statut: "envoyée",
    type: "facture",
    typeFact: parsed.typeCode === "384" ? "avoir" : "vente",
    lignes,
    // Bloc Factur-X — métadonnées riches utiles pour audit + reporting
    totaux: parsed.totaux,
    factureMeta: {
      profile: profileStr || "UNKNOWN",
      source: "facturx_pdf_import",
      filename: filename || null,
      typeCode: parsed.typeCode,
      dateEmission: parsed.date,
      dateEcheance: parsed.dateEcheance,
      statutPaiement: "à régler",
      clientEmail: parsed.buyer.email,
      clientAddress: parsed.buyer.address,
      vatBreakdown: parsed.vatBreakdown,
      isMinimalProfile: isMinimal,
    },
  };
}

// ─── Export principal ───────────────────────────────────────────────────────
// Pipeline complet : file → bytes → extractXml → parse → facture.
// Erreurs propagées avec messages utilisateur (affichés en toast UI) :
//   - "Fichier trop volumineux …"
//   - "Ce PDF n'est pas un Factur-X valide. …"
//   - "XML Factur-X illisible : …"
export async function extractFacturXFromPdf(file) {
  const bytes = await pdfFileToBytes(file);
  const { extractXml } = await import("@stackforge-eu/factur-x");
  let extracted;
  try {
    extracted = await extractXml(bytes);
  } catch (e) {
    const msg = e?.message || String(e);
    // L'erreur typique de la lib quand aucun attachement Factur-X n'est trouvé.
    if (/no.*xml|attachment|not.*found/i.test(msg)) {
      throw new Error("Ce PDF n'est pas un Factur-X valide (aucune facture électronique embarquée). Pour ce type de facture, utilise un export CSV/XLSX à la place.");
    }
    throw new Error("Erreur lecture Factur-X : " + msg.slice(0, 200));
  }
  const parsed = parseCIIXml(extracted.xml);
  const facture = buildFactureFromParsed(parsed, {
    profile: extracted.profile,
    filename: extracted.filename || file.name,
  });
  return {
    facture,
    profile: String(extracted.profile || "UNKNOWN"),
    rawXml: extracted.xml,
    sourceFilename: file.name,
  };
}
