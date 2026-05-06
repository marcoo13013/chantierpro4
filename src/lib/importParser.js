// ═══════════════════════════════════════════════════════════════════════════
// Import universel CSV/XLSX — ChantierPro
// ═══════════════════════════════════════════════════════════════════════════
// Parse fichier CSV (papaparse) ou XLSX (xlsx), normalisation des headers,
// auto-mapping vers schéma cible (clients pour v1), validation FR
// (téléphone/email/SIRET), détection de doublons.
// ═══════════════════════════════════════════════════════════════════════════

import Papa from "papaparse";
import * as XLSX from "xlsx";

// ─── Schéma cible CLIENTS ─────────────────────────────────────────────────
// Aligné sur la table Supabase `clients` (cf migration 20260513_clients.sql).
export const CLIENT_SCHEMA = [
  { key: "nom",         label: "Nom complet",     required: true,  width: "1.5fr" },
  { key: "prenom",      label: "Prénom",          required: false, width: "1fr" },
  { key: "email",       label: "Email",           required: false, width: "1.5fr" },
  { key: "telephone",   label: "Téléphone",       required: false, width: "1fr" },
  { key: "adresse",     label: "Adresse",         required: false, width: "2fr" },
  { key: "code_postal", label: "Code postal",     required: false, width: "0.6fr" },
  { key: "ville",       label: "Ville",           required: false, width: "1fr" },
  { key: "type",        label: "Type",            required: false, width: "0.8fr", help: "particulier / professionnel" },
  { key: "siret",       label: "SIRET",           required: false, width: "1fr" },
  { key: "notes",       label: "Notes",           required: false, width: "1.5fr" },
];

// ─── Normalisation header ─────────────────────────────────────────────────
// "Adresse e-mail" → "adresse_e_mail" → match plus loose
export function normHeader(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Synonymes connus → clé schéma. Heuristique pour auto-mapping.
const HEADER_ALIASES = {
  // nom
  nom: "nom", name: "nom", lastname: "nom", "last_name": "nom",
  client: "nom", raison_sociale: "nom", "raison": "nom", entreprise: "nom",
  societe: "nom", company: "nom", denomination: "nom",
  // prénom
  prenom: "prenom", firstname: "prenom", first_name: "prenom", given_name: "prenom",
  // email
  email: "email", mail: "email", "e_mail": "email", courriel: "email",
  "adresse_email": "email", "adresse_mail": "email", "adresse_e_mail": "email",
  // tel
  tel: "telephone", telephone: "telephone", phone: "telephone",
  "tel_portable": "telephone", "mobile": "telephone", "gsm": "telephone", "portable": "telephone",
  numero: "telephone", "numero_de_telephone": "telephone",
  // adresse
  adresse: "adresse", address: "adresse", rue: "adresse", "adresse_postale": "adresse",
  voie: "adresse",
  // CP
  code_postal: "code_postal", cp: "code_postal", zip: "code_postal", postcode: "code_postal",
  "code_post": "code_postal", "zip_code": "code_postal",
  // ville
  ville: "ville", city: "ville", commune: "ville", localite: "ville",
  // type
  type: "type", categorie: "type", category: "type",
  // SIRET
  siret: "siret", "n_siret": "siret", "numero_siret": "siret", siren: "siret",
  // notes
  notes: "notes", note: "notes", commentaire: "notes", remarque: "notes",
  observations: "notes", description: "notes",
};

// ─── Auto-mapping headers → schéma ────────────────────────────────────────
// Retourne { [headerOriginal]: schemaKey | null }
export function autoMapColumns(headers, schema = CLIENT_SCHEMA) {
  const schemaKeys = new Set(schema.map(s => s.key));
  const result = {};
  for (const h of headers) {
    const norm = normHeader(h);
    let key = null;
    if (HEADER_ALIASES[norm]) {
      key = HEADER_ALIASES[norm];
    } else if (schemaKeys.has(norm)) {
      key = norm;
    } else {
      // Fuzzy : le header contient le mot-clé
      for (const s of schema) {
        if (norm.includes(s.key)) { key = s.key; break; }
        if (norm.includes(normHeader(s.label))) { key = s.key; break; }
      }
    }
    result[h] = key && schemaKeys.has(key) ? key : null;
  }
  return result;
}

// ─── Parse CSV via papaparse ──────────────────────────────────────────────
export function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      dynamicTyping: false,
      complete: (results) => {
        if (results.errors && results.errors.length > 0) {
          // On log les warnings mais on ne rejette pas (papaparse remonte
          // beaucoup de soft errors, ex: "Trailing quote on quoted field").
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

// ─── Parse XLSX via xlsx ──────────────────────────────────────────────────
export async function parseXLSXFile(file) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) throw new Error("Aucune feuille trouvée dans le fichier");
  const sheet = wb.Sheets[firstSheet];
  // header:1 → matrice [[h1,h2,...], [v1,v2,...], ...]
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
  // Détection MIME secondaire
  if (file.type?.includes("spreadsheet") || file.type?.includes("excel")) return parseXLSXFile(file);
  return parseCSVFile(file); // fallback : essaie en CSV
}

// ─── Validation ────────────────────────────────────────────────────────────
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_TEL_FR = /^(?:\+33[ .]?|0)[1-9](?:[ .]?\d{2}){4}$/;
const RE_SIRET = /^\d{14}$/;
const RE_CP_FR = /^\d{5}$/;

export function normalizeTelephone(s) {
  if (!s) return "";
  // Garde + et chiffres, supprime espaces/points/tirets
  return String(s).replace(/[\s.\-/()]/g, "").replace(/^00/, "+");
}

// Valide une ligne mappée (objet {schemaKey: value}). Retourne {valid, errors[]}.
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

// ─── Application du mapping → format schéma cible ─────────────────────────
// rows = [{header1: val1, ...}], mapping = {header1: schemaKey1, ...}
// Retourne [{schemaKey1: val1, ...}]
export function applyMapping(rows, mapping) {
  return rows.map(r => {
    const out = {};
    for (const [header, schemaKey] of Object.entries(mapping)) {
      if (!schemaKey) continue;
      const val = r[header];
      if (val == null) continue;
      // Concaténation si plusieurs headers mappent sur la même clé (rare)
      if (out[schemaKey] != null && out[schemaKey] !== "") {
        out[schemaKey] = `${out[schemaKey]} ${String(val).trim()}`.trim();
      } else {
        out[schemaKey] = String(val).trim();
      }
    }
    // Normalisations finales
    if (out.telephone) out.telephone = normalizeTelephone(out.telephone);
    if (out.type) {
      const t = String(out.type).toLowerCase().trim();
      out.type = (t.includes("pro") || t.includes("entrep") || t.includes("societe") || t.includes("sasu") || t.includes("sarl") || t === "b2b")
        ? "professionnel" : "particulier";
    }
    return out;
  });
}

// ─── Détection doublons (par nom + email contre liste existante) ──────────
// existingClients = clients déjà en base ; toImport = lignes à importer
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

// ─── Helper : prépare lignes pour insert Supabase ─────────────────────────
// Filtre invalides + (optionnellement) doublons. Ajoute user_id.
// L'id est généré côté client en BIGINT (pas UUID) pour matcher le schéma
// existant clients.id (cf migration 20260513_clients.sql). Format :
// timestamp millis × 10000 + random 0-9999 → unique sur le run, taille bigint OK.
export function prepareForInsert(rows, { skipInvalid = true, skipDuplicates = true, userId } = {}) {
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
    // ID bigint unique : base millis + index pour éviter collisions intra-batch
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
