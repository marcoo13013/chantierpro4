// ═══════════════════════════════════════════════════════════════════════════
// Import universel CSV/XLSX — ChantierPro (multi-types)
// ═══════════════════════════════════════════════════════════════════════════
// Types supportés : clients, devis, factures.
// Lazy-load papaparse + xlsx (import dynamique) pour réduire le bundle initial.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Lazy loaders ─────────────────────────────────────────────────────────
let _papa = null;
async function getPapa() {
  if (_papa) return _papa;
  const m = await import("papaparse");
  _papa = m.default || m;
  return _papa;
}
let _xlsx = null;
async function getXLSX() {
  if (_xlsx) return _xlsx;
  _xlsx = await import("xlsx");
  return _xlsx;
}

// ─── Catalogue des types d'import ─────────────────────────────────────────
export const IMPORT_TYPES = {
  clients: {
    label: "Clients",
    icon: "👥",
    color: "#2563EB",
    description: "Carnet d'adresses : noms, contacts, adresses, SIRET.",
    sampleFile: "/exemples/clients-exemple.csv",
    targetTable: "clients",
    groupByField: null, // 1 ligne CSV = 1 entité
  },
  devis: {
    label: "Devis",
    icon: "📋",
    color: "#7C3AED",
    description: "Devis avec leurs lignes (1 devis = N lignes CSV groupées par numéro).",
    sampleFile: "/exemples/devis-exemple.csv",
    targetTable: "devis",
    groupByField: "numero",
  },
  factures: {
    label: "Factures",
    icon: "💰",
    color: "#059669",
    description: "Factures avec lignes + lien vers devis (optionnel).",
    sampleFile: "/exemples/factures-exemple.csv",
    targetTable: "devis", // les factures partagent la table devis (data.type='facture')
    groupByField: "numero",
  },
};

// ─── Schémas des champs cibles par type ──────────────────────────────────
export const CLIENT_SCHEMA = [
  { key: "nom",         label: "Nom complet",     required: true },
  { key: "prenom",      label: "Prénom",          required: false },
  { key: "email",       label: "Email",           required: false },
  { key: "telephone",   label: "Téléphone",       required: false },
  { key: "adresse",     label: "Adresse",         required: false },
  { key: "code_postal", label: "Code postal",     required: false },
  { key: "ville",       label: "Ville",           required: false },
  { key: "type",        label: "Type",            required: false, help: "particulier / professionnel" },
  { key: "siret",       label: "SIRET",           required: false },
  { key: "notes",       label: "Notes",           required: false },
];

export const DEVIS_SCHEMA = [
  { key: "numero",            label: "N° devis",         required: true,  help: "Identifiant unique. Plusieurs lignes CSV partagent le même numéro = 1 devis." },
  { key: "date",              label: "Date émission",    required: false, help: "JJ/MM/AAAA ou AAAA-MM-JJ" },
  { key: "client_nom",        label: "Nom client",       required: true,  help: "Nom recherché dans la table clients." },
  { key: "designation",       label: "Désignation ligne", required: true, help: "Libellé de l'article/prestation." },
  { key: "qte",               label: "Quantité",         required: false },
  { key: "unite",             label: "Unité",            required: false, help: "M2, ML, U, h, etc." },
  { key: "prix_unitaire_ht",  label: "Prix unitaire HT", required: false },
  { key: "tva",               label: "Taux TVA (%)",     required: false, help: "0, 5.5, 10, 20" },
  { key: "statut",            label: "Statut",           required: false, help: "brouillon / envoyé / accepté / refusé" },
];

export const FACTURE_SCHEMA = [
  { key: "numero",            label: "N° facture",       required: true,  help: "Identifiant unique." },
  { key: "date",              label: "Date émission",    required: false },
  { key: "client_nom",        label: "Nom client",       required: true },
  { key: "devis_numero",      label: "N° devis lié",     required: false, help: "Optionnel — pour lier à un devis existant." },
  { key: "designation",       label: "Désignation ligne", required: true },
  { key: "qte",               label: "Quantité",         required: false },
  { key: "unite",             label: "Unité",            required: false },
  { key: "prix_unitaire_ht",  label: "Prix unitaire HT", required: false },
  { key: "tva",               label: "Taux TVA (%)",     required: false },
  { key: "type",              label: "Type",             required: false, help: "vente / acompte / situation" },
  { key: "statut",            label: "Statut",           required: false, help: "brouillon / envoyée / payée" },
  { key: "date_paiement",     label: "Date paiement",    required: false },
];

export function getSchema(type) {
  if (type === "devis") return DEVIS_SCHEMA;
  if (type === "factures") return FACTURE_SCHEMA;
  return CLIENT_SCHEMA;
}

// ─── Aliases (synonymes) par type ─────────────────────────────────────────
const COMMON_ALIASES = {
  // dates
  date: "date", date_emission: "date", date_creation: "date", date_de_creation: "date",
  // numéro
  numero: "numero", num: "numero", n: "numero", reference: "numero", ref: "numero",
  // client
  client: "client_nom", client_nom: "client_nom", nom_client: "client_nom",
  raison_sociale: "client_nom", entreprise: "client_nom", societe: "client_nom",
  // designation
  designation: "designation", description: "designation", libelle: "designation",
  article: "designation", prestation: "designation", lib: "designation",
  // qte
  qte: "qte", quantite: "qte", qtt: "qte", quantity: "qte",
  unite: "unite", u: "unite", unit: "unite", un: "unite",
  // prix
  pu: "prix_unitaire_ht", prix_unitaire: "prix_unitaire_ht", prix: "prix_unitaire_ht",
  prix_unitaire_ht: "prix_unitaire_ht", prix_ht: "prix_unitaire_ht", puht: "prix_unitaire_ht",
  prix_unit_ht: "prix_unitaire_ht",
  // tva
  tva: "tva", taux_tva: "tva", taux_de_tva: "tva", "tva_%": "tva", "tva_pct": "tva",
  // statut
  statut: "statut", status: "statut", etat: "statut", state: "statut",
  // type
  type: "type", categorie: "type", category: "type", nature: "type",
  // devis lié
  devis: "devis_numero", devis_numero: "devis_numero", "n_devis": "devis_numero",
  numero_devis: "devis_numero", reference_devis: "devis_numero",
  // date paiement
  date_paiement: "date_paiement", date_de_paiement: "date_paiement",
  paye_le: "date_paiement", payment_date: "date_paiement",
};

const CLIENT_ALIASES = {
  ...COMMON_ALIASES,
  nom: "nom", name: "nom", lastname: "nom", "last_name": "nom",
  prenom: "prenom", firstname: "prenom", first_name: "prenom",
  email: "email", mail: "email", "e_mail": "email", courriel: "email",
  "adresse_email": "email", "adresse_mail": "email",
  tel: "telephone", telephone: "telephone", phone: "telephone",
  "tel_portable": "telephone", "mobile": "telephone", "gsm": "telephone", "portable": "telephone",
  adresse: "adresse", address: "adresse", rue: "adresse",
  code_postal: "code_postal", cp: "code_postal", zip: "code_postal", postcode: "code_postal",
  ville: "ville", city: "ville", commune: "ville",
  siret: "siret", "n_siret": "siret", "numero_siret": "siret", siren: "siret",
  notes: "notes", note: "notes", commentaire: "notes", remarque: "notes",
};

function aliasesForType(type) {
  // Pour devis/factures on ne mappe PAS "nom" → "client_nom" car ça pourrait
  // capter accidentellement d'autres colonnes. On garde les aliases communs.
  if (type === "devis" || type === "factures") return COMMON_ALIASES;
  return CLIENT_ALIASES;
}

// ─── Normalisation header ─────────────────────────────────────────────────
export function normHeader(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// ─── Auto-mapping headers → schéma ────────────────────────────────────────
export function autoMapColumns(headers, schema, type = "clients") {
  const aliases = aliasesForType(type);
  const schemaKeys = new Set(schema.map(s => s.key));
  const result = {};
  for (const h of headers) {
    const norm = normHeader(h);
    let key = null;
    if (aliases[norm]) {
      key = aliases[norm];
    } else if (schemaKeys.has(norm)) {
      key = norm;
    } else {
      for (const s of schema) {
        if (norm.includes(s.key)) { key = s.key; break; }
        if (norm.includes(normHeader(s.label))) { key = s.key; break; }
      }
    }
    result[h] = key && schemaKeys.has(key) ? key : null;
  }
  return result;
}

// ─── Parse CSV via papaparse (lazy) ───────────────────────────────────────
async function parseCSVFile(file) {
  const Papa = await getPapa();
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      dynamicTyping: false,
      complete: (results) => {
        if (results.errors && results.errors.length > 0) {
          console.warn("[importParser] CSV parse warnings:", results.errors);
        }
        const headers = results.meta?.fields || [];
        const rows = results.data || [];
        resolve({ headers, rows });
      },
      error: (err) => reject(err),
    });
  });
}

// ─── Parse XLSX via xlsx (lazy) ───────────────────────────────────────────
async function parseXLSXFile(file) {
  const XLSX = await getXLSX();
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) throw new Error("Aucune feuille trouvée dans le fichier");
  const sheet = wb.Sheets[firstSheet];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  if (matrix.length === 0) return { headers: [], rows: [] };
  const headers = matrix[0].map(h => String(h || "").trim());
  const rows = [];
  for (let i = 1; i < matrix.length; i++) {
    const r = matrix[i];
    if (!r || r.every(v => v === "" || v == null)) continue;
    const obj = {};
    headers.forEach((h, j) => { obj[h] = String(r[j] ?? "").trim(); });
    rows.push(obj);
  }
  return { headers, rows };
}

// ─── Dispatch CSV ou XLSX selon extension ─────────────────────────────────
export async function parseFile(file) {
  if (!file) throw new Error("Aucun fichier fourni");
  if (file.size > 10 * 1024 * 1024) throw new Error("Fichier > 10 MB");
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return parseXLSXFile(file);
  if (name.endsWith(".csv") || name.endsWith(".txt")) return parseCSVFile(file);
  if (file.type?.includes("spreadsheet") || file.type?.includes("excel")) return parseXLSXFile(file);
  return parseCSVFile(file);
}

// ─── Helpers de parsing valeurs ───────────────────────────────────────────
function parseDateFR(s) {
  if (!s) return null;
  const str = String(s).trim();
  // Format ISO YYYY-MM-DD
  let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  // Format FR DD/MM/YYYY ou DD-MM-YYYY ou DD.MM.YYYY
  m = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  return null;
}

function parseNumber(s) {
  if (s == null || s === "") return 0;
  const str = String(s).replace(/\s/g, "").replace(",", ".").replace(/[^\d.\-]/g, "");
  const n = parseFloat(str);
  return Number.isFinite(n) ? n : 0;
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_TEL_FR = /^(?:\+33[ .]?|0)[1-9](?:[ .]?\d{2}){4}$/;
const RE_SIRET = /^\d{14}$/;
const RE_CP_FR = /^\d{5}$/;

export function normalizeTelephone(s) {
  if (!s) return "";
  return String(s).replace(/[\s.\-/()]/g, "").replace(/^00/, "+");
}

// ─── Validation par type ──────────────────────────────────────────────────
export function validateRow(row, type = "clients") {
  if (type === "devis" || type === "factures") return validateDevisFactureRow(row, type);
  return validateClientRow(row);
}

export function validateClientRow(row) {
  const errors = [];
  if (!row.nom || String(row.nom).trim().length === 0) {
    errors.push({ field: "nom", msg: "Nom requis" });
  }
  if (row.email) {
    const e = String(row.email).trim();
    if (!RE_EMAIL.test(e)) errors.push({ field: "email", msg: "Email invalide" });
  }
  if (row.telephone) {
    const t = normalizeTelephone(row.telephone);
    if (!RE_TEL_FR.test(t)) errors.push({ field: "telephone", msg: "Téléphone invalide (format FR attendu)" });
  }
  if (row.siret) {
    const s = String(row.siret).replace(/\s/g, "");
    if (!RE_SIRET.test(s)) errors.push({ field: "siret", msg: "SIRET doit faire 14 chiffres" });
  }
  if (row.code_postal) {
    const cp = String(row.code_postal).trim();
    if (!RE_CP_FR.test(cp)) errors.push({ field: "code_postal", msg: "CP : 5 chiffres" });
  }
  if (row.type) {
    const t = String(row.type).toLowerCase();
    if (t !== "particulier" && t !== "professionnel") {
      errors.push({ field: "type", msg: "Type : particulier ou professionnel" });
    }
  }
  return { valid: errors.length === 0, errors };
}

// Pour devis/factures : valide une LIGNE (avant groupement). Numero+designation requis.
export function validateDevisFactureRow(row, type) {
  const errors = [];
  if (!row.numero || String(row.numero).trim() === "") {
    errors.push({ field: "numero", msg: "N° requis" });
  }
  if (!row.client_nom || String(row.client_nom).trim() === "") {
    errors.push({ field: "client_nom", msg: "Nom client requis" });
  }
  if (!row.designation || String(row.designation).trim() === "") {
    errors.push({ field: "designation", msg: "Désignation requise" });
  }
  if (row.date && !parseDateFR(row.date)) {
    errors.push({ field: "date", msg: "Date invalide (JJ/MM/AAAA ou AAAA-MM-JJ attendu)" });
  }
  if (row.qte) {
    const q = parseNumber(row.qte);
    if (q <= 0) errors.push({ field: "qte", msg: "Quantité doit être > 0" });
  }
  if (row.prix_unitaire_ht) {
    const pu = parseNumber(row.prix_unitaire_ht);
    if (pu < 0) errors.push({ field: "prix_unitaire_ht", msg: "Prix HT négatif" });
  }
  return { valid: errors.length === 0, errors };
}

// ─── Application du mapping → format schéma cible (par ligne) ─────────────
export function applyMapping(rows, mapping) {
  return rows.map(r => {
    const out = {};
    for (const [header, schemaKey] of Object.entries(mapping)) {
      if (!schemaKey) continue;
      const val = r[header];
      if (val == null) continue;
      if (out[schemaKey] != null && out[schemaKey] !== "") {
        out[schemaKey] = `${out[schemaKey]} ${String(val).trim()}`.trim();
      } else {
        out[schemaKey] = String(val).trim();
      }
    }
    if (out.telephone) out.telephone = normalizeTelephone(out.telephone);
    if (out.type && (out.type === "particulier" || out.type === "professionnel" || /pro|entrep|societe|sasu|sarl|b2b/i.test(out.type))) {
      // Détection type client
      out.type = /pro|entrep|societe|sasu|sarl|b2b/i.test(out.type) ? "professionnel" : "particulier";
    }
    return out;
  });
}

// ─── Détection doublons clients (nom + email contre liste existante) ─────
export function detectDuplicates(toImport, existingClients = []) {
  const existingSet = new Set();
  for (const c of existingClients) {
    const k = `${normHeader(c.nom)}|${normHeader(c.email || "")}`;
    existingSet.add(k);
  }
  return toImport.map(r => {
    const k = `${normHeader(r.nom)}|${normHeader(r.email || "")}`;
    return { ...r, _isDuplicate: existingSet.has(k) };
  });
}

// ─── Détection doublons devis/factures (par numéro contre existants) ─────
export function detectDuplicatesByNumero(toImport, existingDocs = [], type = "devis") {
  const existingSet = new Set();
  for (const d of existingDocs) {
    const docType = d.type || "devis";
    if (docType !== type.replace(/s$/, "")) continue; // "devis" ou "facture"
    if (d.numero) existingSet.add(normHeader(d.numero));
  }
  return toImport.map(r => ({
    ...r,
    _isDuplicate: r.numero ? existingSet.has(normHeader(r.numero)) : false,
  }));
}

// ─── Groupement lignes CSV → 1 doc (devis ou facture) par numéro ─────────
// Retourne array de docs avec lignes[].
export function buildDocsFromRows(mappedRows, type = "devis") {
  const groups = new Map();
  for (let i = 0; i < mappedRows.length; i++) {
    const r = mappedRows[i];
    const num = String(r.numero || "").trim();
    if (!num) continue;
    if (!groups.has(num)) {
      groups.set(num, {
        numero: num,
        date: parseDateFR(r.date) || new Date().toISOString().slice(0, 10),
        client_nom: String(r.client_nom || "").trim(),
        statut: r.statut ? String(r.statut).toLowerCase() : (type === "factures" ? "envoyée" : "brouillon"),
        type: type === "factures" ? (r.type || "vente") : null,
        devis_numero: r.devis_numero || null,
        date_paiement: parseDateFR(r.date_paiement),
        lignes: [],
      });
    }
    const g = groups.get(num);
    if (r.designation) {
      g.lignes.push({
        designation: String(r.designation).trim(),
        qte: parseNumber(r.qte) || 1,
        unite: r.unite || "U",
        prix_unitaire_ht: parseNumber(r.prix_unitaire_ht),
        tva: parseNumber(r.tva) || 20,
      });
    }
  }
  return Array.from(groups.values()).map(g => ({
    ...g,
    montant_ht_total: g.lignes.reduce((a, l) => a + l.qte * l.prix_unitaire_ht, 0),
  }));
}

// ─── Lookup helpers ───────────────────────────────────────────────────────
function findClientByNom(nom, clients = []) {
  if (!nom) return null;
  const target = normHeader(nom);
  return clients.find(c => normHeader(c.nom) === target) || null;
}
function findDevisByNumero(numero, docs = []) {
  if (!numero) return null;
  const target = normHeader(numero);
  return docs.find(d => (d.type === "devis" || !d.type) && normHeader(d.numero) === target) || null;
}

// ─── Préparation finale insert clients ────────────────────────────────────
export function prepareClientsForInsert(rows, { skipInvalid = true, skipDuplicates = true, userId } = {}) {
  if (!userId) throw new Error("userId requis pour l'import");
  const out = [];
  let ignoredInvalid = 0;
  let ignoredDup = 0;
  const baseTime = Date.now();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (skipDuplicates && r._isDuplicate) { ignoredDup++; continue; }
    const v = validateClientRow(r);
    if (skipInvalid && !v.valid) { ignoredInvalid++; continue; }
    const id = baseTime + i;
    out.push({
      user_id: userId,
      id,
      nom: r.nom || "Sans nom",
      prenom: r.prenom || null,
      email: r.email || null,
      telephone: r.telephone || null,
      adresse: r.adresse || null,
      code_postal: r.code_postal || null,
      ville: r.ville || null,
      type: r.type || "particulier",
      siret: r.siret || null,
      notes: r.notes || null,
    });
  }
  return { rows: out, ignoredInvalid, ignoredDup };
}

// Backward-compat alias
export const prepareForInsert = prepareClientsForInsert;

// ─── Préparation finale insert devis/factures (jsonb) ─────────────────────
// Pour chaque doc groupé : construit l'objet { user_id, id, data: {...} }
// data = { type, numero, date, client, lignes:[{libelle, qte, unite, prixUnitHT, tva}], statut, ... }
//
// Si autoCreateClients est true et que client_nom n'est pas dans existingClients,
// on génère aussi une nouvelle ligne client minimale (côté retour).
export function prepareDocsForInsert(docs, {
  type = "devis",
  userId,
  existingClients = [],
  existingDocs = [],
  autoCreateClients = true,
  skipDuplicates = true,
  skipInvalid = true,
} = {}) {
  if (!userId) throw new Error("userId requis pour l'import");
  const out = [];
  const newClientsToCreate = [];
  let ignoredDup = 0;
  let ignoredInvalid = 0;
  let warningsClient = 0;
  let warningsDevisLink = 0;
  const baseTime = Date.now();
  for (let i = 0; i < docs.length; i++) {
    const d = docs[i];
    if (skipDuplicates && d._isDuplicate) { ignoredDup++; continue; }
    if (!d.numero || !d.client_nom || d.lignes.length === 0) {
      if (skipInvalid) { ignoredInvalid++; continue; }
    }
    // Lookup client
    const client = findClientByNom(d.client_nom, existingClients);
    let clientName = d.client_nom;
    if (!client && autoCreateClients) {
      // Crée client minimal (id bigint, nom)
      const newClient = {
        user_id: userId,
        id: baseTime + 100000 + i,
        nom: d.client_nom,
        prenom: null, email: null, telephone: null,
        adresse: null, code_postal: null, ville: null,
        type: "particulier", siret: null, notes: "Créé automatiquement à l'import",
      };
      newClientsToCreate.push(newClient);
    } else if (!client) {
      warningsClient++;
    }
    // Lookup devis (factures only)
    let devisOriginalId = null;
    if (type === "factures" && d.devis_numero) {
      const devis = findDevisByNumero(d.devis_numero, existingDocs);
      if (devis) devisOriginalId = devis.id;
      else warningsDevisLink++;
    }
    // Construit le doc data jsonb
    const docType = type === "factures" ? "facture" : "devis";
    const lignes = d.lignes.map((l, j) => ({
      id: baseTime * 100 + i * 1000 + j,
      type: "ligne",
      libelle: l.designation,
      qte: l.qte,
      unite: l.unite,
      prixUnitHT: l.prix_unitaire_ht,
      tva: l.tva,
    }));
    const dataRow = {
      id: baseTime + i,
      type: docType,
      numero: d.numero,
      date: d.date,
      client: clientName,
      statut: normalizeStatut(d.statut, docType),
      lignes,
      // factures spécifiques
      ...(docType === "facture" && {
        typeFact: d.type || "vente",
        datePaiement: d.date_paiement || null,
        devisOriginalId,
      }),
    };
    out.push({
      user_id: userId,
      id: dataRow.id,
      data: dataRow,
    });
  }
  return {
    rows: out,
    newClients: newClientsToCreate,
    ignoredDup,
    ignoredInvalid,
    warningsClient,
    warningsDevisLink,
  };
}

function normalizeStatut(s, docType) {
  if (!s) return docType === "facture" ? "envoyée" : "brouillon";
  const norm = String(s).toLowerCase().trim();
  if (docType === "facture") {
    if (norm.includes("payé") || norm.includes("paye") || norm === "paid") return "payé";
    if (norm.includes("brou") || norm === "draft") return "brouillon";
    if (norm.includes("env")) return "envoyée";
    if (norm.includes("annul") || norm === "void") return "annulée";
    return "envoyée";
  }
  if (norm.includes("brou") || norm === "draft") return "brouillon";
  if (norm.includes("env")) return "envoyé";
  if (norm.includes("accept") || norm === "accepted") return "accepté";
  if (norm.includes("refus") || norm === "rejected") return "refusé";
  if (norm.includes("attent")) return "en attente";
  return "brouillon";
}
