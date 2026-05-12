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
  articles: {
    label: "Articles bibliothèque",
    icon: "📚",
    color: "#0EA5E9",
    description: "Fournitures unitaires (références fournisseur + prix d'achat). Dédup par référence.",
    sampleFile: null, // pas d'exemple pré-rempli — uniquement le modèle vide
    targetTable: "articles_catalogue",
    groupByField: null,
  },
  ouvrages: {
    label: "Ouvrages bibliothèque",
    icon: "🔨",
    color: "#92400E",
    description: "Postes de travail (corps de métier × unité × temps MO). Dédup par code.",
    sampleFile: null,
    targetTable: "ouvrages_catalogue",
    groupByField: null,
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
  { key: "numero",            label: "N° facture",        required: true,  help: "Identifiant unique. Plusieurs lignes CSV partageant le même numéro = 1 facture." },
  { key: "client_nom",        label: "Nom client",        required: true,  help: "Clé primaire de lookup — match exact contre la table clients." },
  { key: "client_email",      label: "Email client",      required: false, help: "Clé secondaire — désambiguïse si plusieurs clients ont le même nom." },
  { key: "date",              label: "Date émission",     required: false, help: "JJ/MM/AAAA ou AAAA-MM-JJ" },
  { key: "date_echeance",     label: "Date échéance",     required: false, help: "Date limite de paiement (J+30 par défaut si absente)" },
  { key: "lot",               label: "Lot / tranche",     required: false, help: "Groupe les lignes en sections (Plomberie, Carrelage…). Optionnel." },
  { key: "designation",       label: "Désignation ligne", required: true,  help: "Libellé de la prestation / article facturé." },
  { key: "qte",               label: "Quantité",          required: false },
  { key: "unite",             label: "Unité",             required: false, help: "U, m², ml, h, ens…" },
  { key: "prix_unitaire_ht",  label: "Prix unitaire HT",  required: false },
  { key: "tva",               label: "Taux TVA (%)",      required: false, help: "0, 5.5, 10, 20" },
  { key: "statut_paiement",   label: "Statut paiement",   required: false, help: "à régler (défaut) | payée | en retard | annulée" },
  // Champ technique conservé pour rétro-compatibilité (rarement utilisé en
  // import historique Médiabat/Time, mais utile si un export inclut le n° du
  // devis d'origine pour relier la facture).
  { key: "devis_numero",      label: "N° devis lié",      required: false, help: "Optionnel — relie la facture à un devis existant." },
];

// Cible : public.articles_catalogue (migration 20260524). reference + libelle
// requis pour permettre dédup par référence + affichage minimal lisible.
export const ARTICLE_SCHEMA = [
  { key: "reference",           label: "Référence (clé de dédup)", required: true,  help: "Code fournisseur unique (ex GED-1234). Sert à détecter les doublons." },
  { key: "libelle",             label: "Désignation",              required: true,  help: "Libellé visible dans le catalogue." },
  { key: "unite",               label: "Unité",                    required: false, help: "U, ml, m2, kg, sac, plaque, boîte…" },
  { key: "prix_achat_ht",       label: "Prix achat HT (€)",        required: false, help: "Décimal (24.90). Virgule ou point acceptés." },
  { key: "tva_pct",             label: "Taux TVA (%)",             required: false, help: "5.5, 10, 20 — défaut 20 si absent" },
  { key: "fournisseur_default", label: "Fournisseur",              required: false, help: "Point P, Gedimat, Brico Dépôt, Leroy Merlin…" },
  { key: "categorie",           label: "Catégorie",                required: false, help: "Plomberie, Électricité, Carrelage, Peinture…" },
  { key: "sous_categorie",      label: "Sous-catégorie",           required: false, help: "Bonde, Disjoncteur, Mortier-colle…" },
  { key: "conditionnement",     label: "Conditionnement",          required: false, help: 'Ex : "Sac 25kg", "Boîte 100", "Pièce"' },
  { key: "coefficient_marge",   label: "Coef marge",               required: false, help: "Multiplicateur prix vente / achat (défaut 1.3)" },
];

// Cible : public.ouvrages_catalogue (existante côté Supabase ; user_id ajouté
// par la migration 20260526). 9 champs utilisateur (libelle_search est
// auto-généré par trigger, source / actif / user_id forcés à l'insert).
// Architecture calcul v6 : prix_ouvrage = temps_mo × taux_user + fourn_moy
// → pas de prix_ht stocké en DB.
export const OUVRAGE_SCHEMA = [
  { key: "code",            label: "Code ouvrage (clé dédup)", required: true,  help: "Identifiant unique chez toi (ex MAC-001, PEI-002). Sert à éviter les doublons." },
  { key: "libelle",         label: "Désignation",              required: true,  help: "Libellé visible dans la bibliothèque." },
  { key: "corps_id",        label: "Corps de métier",          required: true,  help: "Plomberie / Carrelage / Électricité… (12 corps valides — slugifié auto)." },
  { key: "unite_code",      label: "Unité",                    required: true,  help: "m², ml, h, u, ens, forfait, jour… (16 unités valides)." },
  { key: "temps_mo_unite",  label: "Temps MO (h / unité)",     required: false, help: "Heures de MO par unité. Défaut 0 si absent." },
  { key: "fourn_moy",       label: "Fournitures moyenne (€)",  required: false, help: "Coût fournitures HT moyen / unité. Si tu n'as qu'un prix HT total, mets-le ici (temps MO = 0)." },
  { key: "mo_min",          label: "MO min (€)",               required: false },
  { key: "mo_max",          label: "MO max (€)",               required: false },
  { key: "fourn_min",       label: "Fournitures min (€)",      required: false },
  { key: "fourn_max",       label: "Fournitures max (€)",      required: false },
  { key: "lot_suggere",     label: "Lot suggéré",              required: false, help: "Ex : Gros œuvre, Second œuvre…" },
  { key: "detail",          label: "Détail technique",         required: false },
];

export function getSchema(type) {
  if (type === "devis") return DEVIS_SCHEMA;
  if (type === "factures") return FACTURE_SCHEMA;
  if (type === "articles") return ARTICLE_SCHEMA;
  if (type === "ouvrages") return OUVRAGE_SCHEMA;
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

// Aliases dédiés articles : on map les noms français usuels + variations
// connues des exports comptables BTP (libellés "Référence", "Code article",
// "Code Article", "N° article"…). Tous tombent sur les colonnes canoniques
// de articles_catalogue.
const ARTICLE_ALIASES = {
  // reference
  reference: "reference", ref: "reference",
  code: "reference", code_article: "reference",
  code_mediabat: "reference", code_med: "reference",
  n_article: "reference", numero_article: "reference",
  // libelle
  libelle: "libelle", designation: "libelle", description: "libelle",
  nom: "libelle", intitule: "libelle", article: "libelle",
  // unite
  unite: "unite", u: "unite", unit: "unite", un: "unite",
  // prix
  prix_achat_ht: "prix_achat_ht", prix_achat: "prix_achat_ht",
  pu_ht: "prix_achat_ht", prix_ht: "prix_achat_ht",
  prix: "prix_achat_ht", puht: "prix_achat_ht",
  achat: "prix_achat_ht", prix_revient: "prix_achat_ht",
  // tva
  tva_pct: "tva_pct", tva: "tva_pct", taux_tva: "tva_pct",
  "tva_%": "tva_pct", taux: "tva_pct",
  // fournisseur
  fournisseur_default: "fournisseur_default", fournisseur: "fournisseur_default",
  fourn: "fournisseur_default", supplier: "fournisseur_default",
  marque: "fournisseur_default",
  // categorie
  categorie: "categorie", categorie_metier: "categorie",
  corps_metier: "categorie", corps: "categorie",
  famille: "categorie", metier: "categorie",
  // sous_categorie
  sous_categorie: "sous_categorie", sous_famille: "sous_categorie",
  sscat: "sous_categorie", "sous-categorie": "sous_categorie",
  // conditionnement
  conditionnement: "conditionnement", conditionne: "conditionnement",
  packaging: "conditionnement", emballage: "conditionnement",
  // coefficient_marge
  coefficient_marge: "coefficient_marge", coef_marge: "coefficient_marge",
  marge: "coefficient_marge", coef: "coefficient_marge",
  coefficient: "coefficient_marge",
};

// Aliases dédiés FACTURES : override de COMMON sur les champs où la
// sémantique diverge (email = email du CLIENT, pas de l'émetteur ; statut =
// statut de paiement spécifique facture ; lot = nouveau champ groupement).
const FACTURE_ALIASES = {
  ...COMMON_ALIASES,
  // numero — étendre les variantes courantes des exports Médiabat / Time
  num_facture: "numero", n_facture: "numero", numero_facture: "numero",
  numero_de_facture: "numero", "n_": "numero",
  // client_nom — overrides COMMON.client / client_nom déjà mappés
  client_nom: "client_nom", nom_client: "client_nom", client: "client_nom",
  raison_sociale: "client_nom", entreprise: "client_nom",
  societe: "client_nom", denomination: "client_nom",
  // client_email — IMPORTANT : pour les factures, "email" pointe vers le
  // client (pas l'émetteur). On override COMMON.email volontairement.
  email: "client_email", mail: "client_email", e_mail: "client_email",
  courriel: "client_email", adresse_email: "client_email",
  adresse_mail: "client_email", email_client: "client_email",
  mail_client: "client_email", client_email: "client_email",
  // date_echeance
  date_echeance: "date_echeance", echeance: "date_echeance",
  date_paiement_max: "date_echeance", due_date: "date_echeance",
  date_limite: "date_echeance", date_reglement: "date_echeance",
  // lot — groupement intra-facture (tranches / sections)
  lot: "lot", tranche: "lot", section: "lot", phase: "lot",
  groupe: "lot", chapitre: "lot",
  // statut_paiement — bascule depuis statut générique
  statut_paiement: "statut_paiement", statut: "statut_paiement",
  status: "statut_paiement", etat_paiement: "statut_paiement",
  etat: "statut_paiement", paid_status: "statut_paiement",
};

// Aliases dédiés OUVRAGES — couverture des exports Médiabat / Time + libellés
// usuels FR. La validation corps_id / unite_code se fait en aval via les maps
// CORPS_NORMALIZE / UNITE_NORMALIZE.
const OUVRAGE_ALIASES = {
  // code
  code: "code", reference: "code", ref: "code",
  num_ouvrage: "code", numero_ouvrage: "code",
  code_mediabat: "code", code_batiprix: "code",
  // libelle
  libelle: "libelle", designation: "libelle", description: "libelle",
  nom: "libelle", intitule: "libelle", ouvrage: "libelle",
  // corps_id (validation finale via CORPS_NORMALIZE)
  corps_id: "corps_id", corps: "corps_id",
  corps_metier: "corps_id", corps_de_metier: "corps_id",
  famille: "corps_id", categorie: "corps_id", metier: "corps_id",
  // unite_code (validation finale via UNITE_NORMALIZE)
  unite_code: "unite_code", unite: "unite_code",
  u: "unite_code", unite_mesure: "unite_code", unit: "unite_code",
  // temps_mo_unite
  temps_mo_unite: "temps_mo_unite", temps_mo: "temps_mo_unite",
  heures: "temps_mo_unite", h_unite: "temps_mo_unite",
  mo_h: "temps_mo_unite", temps: "temps_mo_unite",
  duree_mo: "temps_mo_unite", heures_mo: "temps_mo_unite",
  // fourn_moy / fourn_min / fourn_max
  fourn_moy: "fourn_moy", fournitures_moy: "fourn_moy",
  fournitures: "fourn_moy", cout_fournitures: "fourn_moy",
  // Si l'export n'a qu'un prix HT direct, on l'aspire dans fourn_moy
  // (décision 3 validée : ouvrage devient "article composé sans MO").
  prix_ht: "fourn_moy", pu_ht: "fourn_moy", prix: "fourn_moy",
  fourn_min: "fourn_min", fournitures_min: "fourn_min",
  fourn_max: "fourn_max", fournitures_max: "fourn_max",
  // mo_min / mo_max
  mo_min: "mo_min", main_oeuvre_min: "mo_min",
  mo_max: "mo_max", main_oeuvre_max: "mo_max",
  // lot_suggere
  lot_suggere: "lot_suggere", lot: "lot_suggere",
  section: "lot_suggere",
  // detail
  detail: "detail", description_detail: "detail",
  commentaire: "detail", notes: "detail", remarque: "detail",
};

// ─── Référentiels figés ─────────────────────────────────────────────────────
// 12 corps de métier valides (validés Marco depuis corps_metier côté DB).
// Le matching client est strict après slugify : input normalisé → slug exact
// dans cet ensemble, sinon "corps inconnu" → skip + flag à l'aperçu.
export const VALID_CORPS_IDS = new Set([
  "carrelage", "demolition", "divers", "electricite", "enduit_facade",
  "etancheite", "isolation", "maconnerie", "main_oeuvre", "menuiserie",
  "peinture", "plomberie",
]);

// Aliases libellés → slug officiel. Toute valeur d'input passe par
// normHeader() (lowercase + retrait accents/espaces → underscore), puis
// recherche dans CORPS_NORMALIZE. Si pas trouvé, on tente le match direct
// dans VALID_CORPS_IDS (cas où le CSV utilise déjà le slug propre).
export const CORPS_NORMALIZE = {
  // carrelage
  carrelage: "carrelage", faience: "carrelage",
  // demolition
  demolition: "demolition", demo: "demolition",
  // divers
  divers: "divers", autres: "divers", autre: "divers",
  // electricite
  electricite: "electricite", elec: "electricite",
  // enduit_facade
  enduit_facade: "enduit_facade", "enduit_facade_": "enduit_facade",
  facade: "enduit_facade", ravalement: "enduit_facade", crepi: "enduit_facade",
  // etancheite
  etancheite: "etancheite", etanch: "etancheite",
  // isolation
  isolation: "isolation", iso: "isolation", ite: "isolation", iti: "isolation",
  // maconnerie
  maconnerie: "maconnerie", macon: "maconnerie", macconerie: "maconnerie",
  // main_oeuvre
  main_oeuvre: "main_oeuvre", "main_d_oeuvre": "main_oeuvre",
  mo: "main_oeuvre", pose: "main_oeuvre",
  // menuiserie
  menuiserie: "menuiserie", menuis: "menuiserie", menuisier: "menuiserie",
  // peinture
  peinture: "peinture", peint: "peinture",
  // plomberie
  plomberie: "plomberie", plombier: "plomberie",
  sanitaire: "plomberie", plomb: "plomberie",
};

// Retourne le slug corps officiel ou null si non reconnu.
export function normalizeCorpsId(input) {
  if (!input) return null;
  const slug = normHeader(input);
  if (CORPS_NORMALIZE[slug]) return CORPS_NORMALIZE[slug];
  if (VALID_CORPS_IDS.has(slug)) return slug;
  return null;
}

// 16 unités valides (référentiel public.unites).
export const VALID_UNITE_CODES = new Set([
  "bidon", "ens", "forfait", "h", "jour", "kg", "l", "m", "m2", "m3",
  "marche", "ml", "rotation", "rouleau", "sac", "u",
]);

// Mapping libellés → code unité officiel.
export const UNITE_NORMALIZE = {
  // u
  u: "u", unite: "u", piece: "u", pc: "u",
  // m2 (m² perd l'accent via normHeader → "m2")
  m2: "m2",
  // m3 (idem)
  m3: "m3",
  // m
  m: "m", metre: "m",
  // ml
  ml: "ml", metre_lineaire: "ml",
  // h
  h: "h", heure: "h",
  // kg / l
  kg: "kg",
  l: "l", litre: "l",
  // ens / forfait / jour
  ens: "ens", ensemble: "ens",
  forfait: "forfait", ft: "forfait",
  jour: "jour", j: "jour",
  // sac / rouleau / bidon / rotation / marche
  sac: "sac",
  rouleau: "rouleau", rlx: "rouleau",
  bidon: "bidon",
  rotation: "rotation", rot: "rotation",
  marche: "marche",
};

// Retourne le code unité officiel ou null si non reconnu.
export function normalizeUniteCode(input) {
  if (!input) return null;
  const slug = normHeader(input);
  if (UNITE_NORMALIZE[slug]) return UNITE_NORMALIZE[slug];
  if (VALID_UNITE_CODES.has(slug)) return slug;
  return null;
}

function aliasesForType(type) {
  // Devis garde COMMON (pas de surcharge sur email/lot).
  if (type === "devis") return COMMON_ALIASES;
  // Factures : alias étendus (lot, client_email, date_echeance, statut_paiement)
  if (type === "factures") return FACTURE_ALIASES;
  if (type === "articles") return ARTICLE_ALIASES;
  if (type === "ouvrages") return OUVRAGE_ALIASES;
  return CLIENT_ALIASES;
}

// ─── Détection de preset à partir des headers du fichier ───────────────────
// Retourne { id: "preset_a"|"preset_b"|null, label: string|null } pour afficher
// un badge "Format détecté" à l'étape Mapping. La détection est best-effort,
// l'utilisateur peut toujours surcharger manuellement les mappings.
// La détection diffère selon le contexte : un export Médiabat de catalogue
// articles n'a pas les mêmes colonnes qu'un export de factures Médiabat.
// L'argument `importType` permet d'appliquer les heuristiques pertinentes.
export function detectImportPreset(headers = [], importType = "articles") {
  const normalized = headers.map(h => normHeader(h));
  const hasAny = (patterns) => patterns.some(p => normalized.some(h => h === p || h.includes(p)));
  if (importType === "factures") {
    // Médiabat factures : en-têtes "n_facture" + "client" + "designation"
    if (hasAny(["n_facture", "numero_facture"]) && hasAny(["client", "client_nom"])) {
      return { id: "preset_a", label: "Export factures (type A)" };
    }
    // Format alternatif : "numero" + "client" + "designation"
    if (hasAny(["numero", "num"]) && hasAny(["client", "client_nom"]) && hasAny(["designation", "description"])) {
      return { id: "preset_b", label: "Export factures (type B)" };
    }
    return { id: null, label: null };
  }
  if (importType === "ouvrages") {
    // Format export comptable type A : code dédié + "Désignation" + corps libellé
    if (hasAny(["code_mediabat", "ref_ouvrage_mediabat"])) {
      return { id: "preset_a", label: "Export ouvrages (type A)" };
    }
    // Format export comptable type B : "N° Ouvrage" + code référentiel BTP
    if (hasAny(["n_ouvrage", "numero_ouvrage", "code_batiprix"])) {
      return { id: "preset_b", label: "Export ouvrages (type B)" };
    }
    return { id: null, label: null };
  }
  // Articles (default)
  if (hasAny(["code_mediabat", "ref_mediabat"])) {
    return { id: "preset_a", label: "Export articles (type A)" };
  }
  if (hasAny(["n_article", "numero_article"])) {
    return { id: "preset_b", label: "Export articles (type B)" };
  }
  return { id: null, label: null };
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
// Skip ligne commentaire : toute ligne dont la 1ʳᵉ cellule (après trim)
// commence par "#" est ignorée. Permet aux modèles téléchargeables (cf
// importTemplates.js) d'inclure une ligne 2 d'aide en français qui ne pollue
// pas les data importées.
function isCommentRow(row, headers) {
  if (!row || headers.length === 0) return false;
  const first = String(row[headers[0]] ?? "").trim();
  return first.startsWith("#");
}
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
        const rows = (results.data || []).filter(r => !isCommentRow(r, headers));
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
    // Skip ligne commentaire — 1ʳᵉ cellule commence par "#" (cf parseCSVFile)
    const first = String(r[0] ?? "").trim();
    if (first.startsWith("#")) continue;
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
  if (type === "articles") return validateArticleRow(row);
  if (type === "ouvrages") return validateOuvrageRow(row);
  return validateClientRow(row);
}

// Valide une ligne ouvrage avant insert. Les corps/unité non reconnus sont
// signalés en erreurs spécifiques pour permettre à l'UI Aperçu d'afficher des
// badges distincts ("CORPS INCONNU" vs "INVALIDE générique").
export function validateOuvrageRow(row) {
  const errors = [];
  if (!row.code || String(row.code).trim() === "") {
    errors.push({ field: "code", msg: "Code requis" });
  }
  if (!row.libelle || String(row.libelle).trim() === "") {
    errors.push({ field: "libelle", msg: "Désignation requise" });
  }
  // corps_id : on rejette si non reconnu (skip à l'import)
  if (!row.corps_id || String(row.corps_id).trim() === "") {
    errors.push({ field: "corps_id", msg: "Corps de métier requis" });
  } else if (!normalizeCorpsId(row.corps_id)) {
    errors.push({ field: "corps_id", msg: `Corps non reconnu : "${row.corps_id}"`, kind: "unknown_corps" });
  }
  // unite_code : idem
  if (!row.unite_code || String(row.unite_code).trim() === "") {
    errors.push({ field: "unite_code", msg: "Unité requise" });
  } else if (!normalizeUniteCode(row.unite_code)) {
    errors.push({ field: "unite_code", msg: `Unité non reconnue : "${row.unite_code}"`, kind: "unknown_unite" });
  }
  // Numériques optionnels
  if (row.temps_mo_unite !== undefined && row.temps_mo_unite !== "") {
    const t = parseNumber(row.temps_mo_unite);
    if (t < 0) errors.push({ field: "temps_mo_unite", msg: "Temps MO négatif" });
  }
  for (const k of ["fourn_moy", "fourn_min", "fourn_max", "mo_min", "mo_max"]) {
    if (row[k] !== undefined && row[k] !== "") {
      const n = parseNumber(row[k]);
      if (n < 0) errors.push({ field: k, msg: `${k} négatif` });
    }
  }
  return { valid: errors.length === 0, errors };
}

export function validateArticleRow(row) {
  const errors = [];
  if (!row.reference || String(row.reference).trim() === "") {
    errors.push({ field: "reference", msg: "Référence requise (clé de dédup)" });
  }
  if (!row.libelle || String(row.libelle).trim() === "") {
    errors.push({ field: "libelle", msg: "Désignation requise" });
  }
  if (row.prix_achat_ht !== undefined && row.prix_achat_ht !== "") {
    const p = parseNumber(row.prix_achat_ht);
    if (p < 0) errors.push({ field: "prix_achat_ht", msg: "Prix HT négatif" });
  }
  if (row.tva_pct !== undefined && row.tva_pct !== "") {
    const t = parseNumber(row.tva_pct);
    if (t < 0 || t > 100) errors.push({ field: "tva_pct", msg: "Taux TVA hors [0..100]" });
  }
  if (row.coefficient_marge !== undefined && row.coefficient_marge !== "") {
    const c = parseNumber(row.coefficient_marge);
    if (c <= 0) errors.push({ field: "coefficient_marge", msg: "Coef marge doit être > 0" });
  }
  return { valid: errors.length === 0, errors };
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

// ─── Détection doublons ouvrages (par code contre Set existant) ─────────
// Le Set est rempli en amont via SELECT code FROM ouvrages_catalogue
// WHERE user_id = auth.uid() (côté PreviewStep).
export function detectOuvrageDuplicates(toImport, existingCodes = new Set()) {
  return toImport.map(r => {
    const code = normHeader(String(r.code || "").trim());
    return { ...r, _isDuplicate: code ? existingCodes.has(code) : false };
  });
}

// ─── Détection doublons articles (par reference contre Set existant) ─────
// existingReferences est un Set<string> de références normalisées qu'on a
// récupérées en amont via SELECT reference FROM articles_catalogue
// WHERE user_id = auth.uid().
export function detectArticleDuplicates(toImport, existingReferences = new Set()) {
  return toImport.map(r => {
    const ref = normHeader(String(r.reference || "").trim());
    return { ...r, _isDuplicate: ref ? existingReferences.has(ref) : false };
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
//   - Pour les factures, on capture aussi client_email, date_echeance,
//     statut_paiement, et lot AU NIVEAU LIGNE (le groupement en tranches se
//     fait plus tard dans prepareDocsForInsert).
//   - Compat ascendante préservée pour devis : aucun nouveau champ requis.
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
        // Champs spécifiques factures (no-op pour devis)
        client_email: type === "factures" ? (String(r.client_email || "").trim() || null) : null,
        date_echeance: type === "factures" ? parseDateFR(r.date_echeance) : null,
        statut_paiement: type === "factures" && r.statut_paiement
          ? String(r.statut_paiement).toLowerCase()
          : null,
        // Compat ascendante : on garde l'ancien champ statut pour devis
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
        // lot porté au niveau ligne pour permettre le regroupement en
        // tranches dans prepareDocsForInsert (factures uniquement).
        lot: type === "factures" && r.lot ? String(r.lot).trim() : null,
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
// Lookup tolérant pour les factures : retourne { status, client, candidates }
//   - status = "resolved"   : 1 seul match exact (ou désambiguïsé via email)
//   - status = "not_found"  : 0 match
//   - status = "ambiguous"  : N>1 matches sur le nom, aucun email pour trancher
// L'utilisateur peut décider à l'étape Aperçu de skip ou laisser l'import
// utiliser le 1ᵉʳ candidat (comportement par défaut).
export function resolveClient(nom, email, clients = []) {
  if (!nom) return { status: "not_found", client: null, candidates: [] };
  const targetNom = normHeader(nom);
  const matches = clients.filter(c => normHeader(c.nom) === targetNom);
  if (matches.length === 0) return { status: "not_found", client: null, candidates: [] };
  if (matches.length === 1) return { status: "resolved", client: matches[0], candidates: matches };
  // Plusieurs matches : email tiebreaker
  if (email) {
    const targetEmail = String(email).trim().toLowerCase();
    const byEmail = matches.find(c => (c.email || "").trim().toLowerCase() === targetEmail);
    if (byEmail) return { status: "resolved", client: byEmail, candidates: matches };
  }
  return { status: "ambiguous", client: matches[0], candidates: matches };
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

// ─── Préparation finale insert ouvrages ──────────────────────────────────
// Force user_id = auth.uid() (RLS WITH CHECK), source = "Personnel" (le
// catalogue global référentiels BTP a user_id NULL et reste intact),
// actif = true. libelle_search NON renseigné (trigger Postgres l'auto-génère).
//
// Cas spécial décision 3 : si le CSV contient un prix_ht direct sans
// décomposition MO + fournitures, OUVRAGE_ALIASES le pousse dans fourn_moy
// et temps_mo_unite reste à 0. On préfixe alors le detail pour signaler
// que la ligne est "à raffiner" manuellement.
export function prepareOuvragesForInsert(rows, { skipInvalid = true, skipDuplicates = true, userId } = {}) {
  if (!userId) throw new Error("userId requis pour l'import");
  const out = [];
  let ignoredInvalid = 0;
  let ignoredDup = 0;
  let warningsCorpsInconnu = 0;
  let warningsUniteInconnue = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (skipDuplicates && r._isDuplicate) { ignoredDup++; continue; }
    const v = validateOuvrageRow(r);
    if (skipInvalid && !v.valid) {
      ignoredInvalid++;
      // Bump compteurs spécifiques pour les warnings affichés au récap
      for (const e of v.errors) {
        if (e.kind === "unknown_corps") warningsCorpsInconnu++;
        if (e.kind === "unknown_unite") warningsUniteInconnue++;
      }
      continue;
    }
    const corpsId = normalizeCorpsId(r.corps_id);
    const uniteCode = normalizeUniteCode(r.unite_code);
    const tempsMo = r.temps_mo_unite !== undefined && r.temps_mo_unite !== ""
      ? parseNumber(r.temps_mo_unite)
      : 0;
    const fournMoy = r.fourn_moy !== undefined && r.fourn_moy !== ""
      ? parseNumber(r.fourn_moy)
      : 0;
    // Détecte le cas "import sans décomposition" : prix HT direct dans
    // fourn_moy sans MO → préfixe le detail pour que l'utilisateur sache
    // quelles lignes raffiner après import.
    const detailRaw = r.detail ? String(r.detail).trim() : "";
    const flagSansDecompo = tempsMo === 0 && fournMoy > 0 && !detailRaw.startsWith("[Import sans décomposition MO]");
    const detail = flagSansDecompo
      ? `[Import sans décomposition MO] ${detailRaw}`.trim()
      : detailRaw || null;
    out.push({
      // PAS d'id : ouvrages_catalogue.id est uuid PK auto-généré
      user_id: userId,
      code: String(r.code).trim(),
      libelle: String(r.libelle).trim(),
      corps_id: corpsId,
      unite_code: uniteCode,
      temps_mo_unite: Number.isFinite(tempsMo) && tempsMo >= 0 ? tempsMo : 0,
      fourn_moy: Number.isFinite(fournMoy) && fournMoy >= 0 ? fournMoy : null,
      mo_min: r.mo_min !== undefined && r.mo_min !== "" ? parseNumber(r.mo_min) : null,
      mo_max: r.mo_max !== undefined && r.mo_max !== "" ? parseNumber(r.mo_max) : null,
      fourn_min: r.fourn_min !== undefined && r.fourn_min !== "" ? parseNumber(r.fourn_min) : null,
      fourn_max: r.fourn_max !== undefined && r.fourn_max !== "" ? parseNumber(r.fourn_max) : null,
      lot_suggere: r.lot_suggere ? String(r.lot_suggere).trim() : null,
      detail,
      source: "Personnel",
      actif: true,
      // libelle_search : NON renseigné — trigger Postgres l'auto-génère
    });
  }
  return { rows: out, ignoredInvalid, ignoredDup, warningsCorpsInconnu, warningsUniteInconnue };
}

// ─── Préparation finale insert articles ──────────────────────────────────
// Force user_id = auth.uid() pour passer la RLS articles_catalogue (politique
// articles_insert : WITH CHECK user_id = auth.uid()).
// Force actif=true et coefficient_marge=1.3 si absents pour éviter d'avoir des
// articles invisibles ou avec un coef à 0 par défaut côté DB.
// La dédup par reference se fait AVANT cette fonction (champ _isDuplicate).
export function prepareArticlesForInsert(rows, { skipInvalid = true, skipDuplicates = true, userId } = {}) {
  if (!userId) throw new Error("userId requis pour l'import");
  const out = [];
  let ignoredInvalid = 0;
  let ignoredDup = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (skipDuplicates && r._isDuplicate) { ignoredDup++; continue; }
    const v = validateArticleRow(r);
    if (skipInvalid && !v.valid) { ignoredInvalid++; continue; }
    // Coerce numeric fields
    const prix = r.prix_achat_ht !== undefined && r.prix_achat_ht !== ""
      ? parseNumber(r.prix_achat_ht)
      : 0;
    const tva = r.tva_pct !== undefined && r.tva_pct !== ""
      ? parseNumber(r.tva_pct)
      : 20;
    const coef = r.coefficient_marge !== undefined && r.coefficient_marge !== ""
      ? parseNumber(r.coefficient_marge)
      : 1.3;
    out.push({
      // PAS d'id côté client : articles_catalogue.id est uuid PK auto-généré
      user_id: userId,
      reference: String(r.reference || "").trim() || null,
      libelle: String(r.libelle || "").trim(),
      unite: r.unite ? String(r.unite).trim() : "U",
      prix_achat_ht: Number.isFinite(prix) ? prix : 0,
      tva_pct: Number.isFinite(tva) ? tva : 20,
      fournisseur_default: r.fournisseur_default ? String(r.fournisseur_default).trim() : null,
      categorie: r.categorie ? String(r.categorie).trim() : "Divers",
      sous_categorie: r.sous_categorie ? String(r.sous_categorie).trim() : null,
      conditionnement: r.conditionnement ? String(r.conditionnement).trim() : null,
      coefficient_marge: coef > 0 ? coef : 1.3,
      actif: true,
    });
  }
  return { rows: out, ignoredInvalid, ignoredDup };
}

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
  let warningsClientAmbigu = 0;
  let warningsDevisLink = 0;
  const baseTime = Date.now();
  for (let i = 0; i < docs.length; i++) {
    const d = docs[i];
    if (skipDuplicates && d._isDuplicate) { ignoredDup++; continue; }
    if (!d.numero || !d.client_nom || d.lignes.length === 0) {
      if (skipInvalid) { ignoredInvalid++; continue; }
    }
    // Lookup client — pour les factures on utilise resolveClient (email
    // tiebreaker + détection ambiguïté). Pour les devis on garde l'ancien
    // findClientByNom (rétro-compat stricte demandée par le brief).
    let client = null;
    let clientResolution = "resolved"; // "resolved" | "not_found" | "ambiguous"
    if (type === "factures") {
      const res = resolveClient(d.client_nom, d.client_email, existingClients);
      client = res.client;
      clientResolution = res.status;
      if (clientResolution === "ambiguous") warningsClientAmbigu++;
    } else {
      client = findClientByNom(d.client_nom, existingClients);
      clientResolution = client ? "resolved" : "not_found";
    }
    let clientName = d.client_nom;
    if (!client && autoCreateClients) {
      const newClient = {
        user_id: userId,
        id: baseTime + 100000 + i,
        nom: d.client_nom,
        prenom: null,
        email: type === "factures" ? (d.client_email || null) : null,
        telephone: null,
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
    // ─── Factures : structure tranches optionnelle + factureMeta + totaux ──
    // Si AU MOINS UNE ligne CSV avait un `lot` rempli, on regroupe en
    // tranches. Sinon on garde data.lignes plat (comportement historique).
    let tranches = null;
    if (docType === "facture") {
      const hasLot = d.lignes.some(l => l.lot && l.lot.trim());
      if (hasLot) {
        const trMap = new Map();
        d.lignes.forEach((l, j) => {
          const k = (l.lot && l.lot.trim()) || "Sans lot";
          if (!trMap.has(k)) trMap.set(k, []);
          trMap.get(k).push({
            id: baseTime * 100 + i * 1000 + j,
            type: "ligne",
            libelle: l.designation,
            qte: l.qte,
            unite: l.unite,
            prixUnitHT: l.prix_unitaire_ht,
            tva: l.tva,
          });
        });
        tranches = Array.from(trMap.entries()).map(([lot, lns], idx) => ({
          id: baseTime * 1000 + i * 100 + idx,
          titre: lot,
          lignes: lns,
        }));
      }
    }
    // Totaux factures (calculés depuis les lignes après mapping)
    let totaux = null;
    if (docType === "facture") {
      const ht = lignes.reduce((a, l) => a + (+l.qte || 0) * (+l.prixUnitHT || 0), 0);
      const tva = lignes.reduce((a, l) => a + (+l.qte || 0) * (+l.prixUnitHT || 0) * (+l.tva || 0) / 100, 0);
      totaux = {
        ht: Math.round(ht * 100) / 100,
        tva: Math.round(tva * 100) / 100,
        ttc: Math.round((ht + tva) * 100) / 100,
      };
    }
    const dataRow = {
      id: baseTime + i,
      type: docType,
      numero: d.numero,
      date: d.date,
      client: clientName,
      statut: normalizeStatut(d.statut, docType),
      lignes,
      // factures spécifiques (rétro-compat — structure existante intacte)
      ...(docType === "facture" && {
        typeFact: d.type || "vente",
        datePaiement: d.date_paiement || null,
        devisOriginalId,
        // Nouveau : tranches + totaux + factureMeta (brief Commit 2bis)
        ...(tranches && { tranches }),
        ...(totaux && { totaux }),
        factureMeta: {
          dateEmission: d.date,
          dateEcheance: d.date_echeance || null,
          statutPaiement: d.statut_paiement || "à régler",
          clientEmail: d.client_email || null,
          clientResolution, // "resolved" | "not_found" | "ambiguous"
          source: "import-csv-historique",
        },
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
    warningsClientAmbigu,
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
