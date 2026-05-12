// ═══════════════════════════════════════════════════════════════════════════
// affectation.js — auto-affectation des ouvriers selon les compétences corps
// ═══════════════════════════════════════════════════════════════════════════
// Sprint Affectation IA Ouvriers — Commit 1 (catalogue + UI).
//
// CORPS_LABELS expose la liste des 12 corps de métier valides (slugs
// alignés sur public.corps_metier côté Supabase) avec leur libellé FR
// affichable et une icône, pour piloter la grille de checkboxes dans la
// fiche ouvrier (VueEquipe).
//
// normalizeCorpsBibliotheque() mappe le champ `corps` des ouvrages
// hardcodés BIBLIOTHEQUE_BTP (string capitalisé FR "Carrelage",
// "Maçonnerie", "Plomberie"…) vers le slug officiel ("carrelage",
// "maconnerie", "plomberie"). Réutilise normalizeCorpsId() du sprint
// Import pour ne pas dupliquer le mapping.
//
// affecterOuvrierAuto() (Commit 2) consommera ces helpers pour faire le
// matching ouvrage.corps → corps_competences. Volontairement non livré
// dans ce module au Commit 1 pour respecter le découpage.
// ═══════════════════════════════════════════════════════════════════════════

import { normalizeCorpsId, VALID_CORPS_IDS } from "./importParser";

// ─── Labels FR + icônes pour l'UI checkbox ────────────────────────────────
// L'ordre choisi suit la convention BTP (Gros œuvre → Second œuvre →
// finitions → support) plutôt que l'ordre alphabétique brut, pour que
// la grille de checkboxes soit visuellement organisée par "chantier type".
export const CORPS_LABELS = [
  // Gros œuvre / démolition
  { id: "demolition",    label: "Démolition",      icon: "🔨" },
  { id: "maconnerie",    label: "Maçonnerie",      icon: "🧱" },
  { id: "etancheite",    label: "Étanchéité",      icon: "💧" },
  { id: "isolation",     label: "Isolation",       icon: "🧊" },
  // Second œuvre
  { id: "plomberie",     label: "Plomberie",       icon: "🚿" },
  { id: "electricite",   label: "Électricité",     icon: "⚡" },
  { id: "menuiserie",    label: "Menuiserie",      icon: "🚪" },
  // Finitions
  { id: "carrelage",     label: "Carrelage",       icon: "🟫" },
  { id: "peinture",      label: "Peinture",        icon: "🎨" },
  { id: "enduit_facade", label: "Enduit façade",   icon: "🏠" },
  // Support / autres
  { id: "main_oeuvre",   label: "Main d'œuvre",    icon: "👷" },
  { id: "divers",        label: "Divers",          icon: "📦" },
];

// Sanity check (dev) : la liste UI doit couvrir exactement les 12 slugs
// validés côté DB. Logger un warn si désaccord (= référentiel à mettre à jour).
if (typeof window !== "undefined") {
  const idsInLabels = new Set(CORPS_LABELS.map((c) => c.id));
  for (const v of VALID_CORPS_IDS) {
    if (!idsInLabels.has(v)) console.warn(`[affectation] corps_id "${v}" présent dans VALID_CORPS_IDS mais absent de CORPS_LABELS`);
  }
  for (const c of CORPS_LABELS) {
    if (!VALID_CORPS_IDS.has(c.id)) console.warn(`[affectation] corps_id "${c.id}" dans CORPS_LABELS mais absent de VALID_CORPS_IDS — vérifier la migration corps_metier`);
  }
}

// ─── Normalisation du champ `corps` (BIBLIOTHEQUE_BTP) → slug ─────────────
// Les 461 ouvrages hardcodés et les ouvrages persos utilisent le champ
// `corps` en string capitalisé FR ("Plomberie", "Maçonnerie", "Électricité"…).
// On les mappe vers les slugs officiels pour comparer aux corps_competences.
// Retourne null si le corps n'est pas reconnu (= ouvrage sans corps mappable,
// pas d'auto-affectation possible).
export function normalizeCorpsBibliotheque(corps) {
  return normalizeCorpsId(corps);
}

// ─── Helper UI : 1 corps maîtrisé donné, on récupère le label affichable ─
export function libelleCorps(id) {
  const c = CORPS_LABELS.find((x) => x.id === id);
  return c ? `${c.icon} ${c.label}` : id;
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-AFFECTATION IA (Sprint Commit 2)
// ═══════════════════════════════════════════════════════════════════════════

// affecterOuvrierAuto(corpsId, ouvriers) → id du meilleur ouvrier candidat
//
// Règle de priorité (décision Marco) :
//   1. Filtrer les candidats : polyvalent OU corps_competences contient corpsId
//   2. Parmi eux : les SPÉCIALISTES (corps_competences contient le slug)
//      passent AVANT les polyvalents → un Karim plombier prend toujours
//      le pas sur un Manœuvre polyvalent sur une ligne de plomberie.
//   3. Si plusieurs spécialistes → tri alpha sur nom, retourne le 1ᵉʳ.
//   4. Pas de candidat → retourne null (ligne orpheline, l'utilisateur
//      l'affecte manuellement après).
// L'équilibrage de charge (load balancing entre ouvriers) viendra en Phase 2.
export function affecterOuvrierAuto(corpsId, ouvriers) {
  if (!corpsId) return null;
  if (!Array.isArray(ouvriers) || ouvriers.length === 0) return null;
  const candidats = ouvriers.filter((o) => {
    if (o?.disponible === false) return false; // exclu si marqué indispo
    const poly = !!o.polyvalent;
    const corps = Array.isArray(o.corps_competences) ? o.corps_competences : [];
    return poly || corps.includes(corpsId);
  });
  if (candidats.length === 0) return null;
  const specialistes = candidats.filter((o) =>
    Array.isArray(o.corps_competences) && o.corps_competences.includes(corpsId)
  );
  const pool = specialistes.length > 0 ? specialistes : candidats;
  const sorted = [...pool].sort((a, b) =>
    String(a.nom || "").localeCompare(String(b.nom || ""), "fr", { sensitivity: "base" })
  );
  return sorted[0].id;
}

// extractCorpsFromLigne(ligne, bibliotheque) → slug corps déduit
//
// 2 sources, dans l'ordre :
//   1. Lookup par code via ligne._biblio dans la bibliothèque (461 ouvrages
//      hardcodés + extensions + persos) → ouvrage.corps (string capitalisé FR)
//      → normalizeCorpsBibliotheque → slug.
//   2. Heuristique sur le libellé : on cherche dans le texte normalisé une
//      occurrence d'un libellé FR ou d'un slug de corps (ex "plomberie" dans
//      "Fourniture et pose plomberie chauffage"). Match sur la PREMIÈRE
//      occurrence (l'ordre de CORPS_LABELS = BTP standard).
//
// Retourne null si aucun corps reconnu (= ligne IA générique, pas d'auto-
// affectation possible — orpheline tant que l'utilisateur ne corrige pas).
export function extractCorpsFromLigne(ligne, bibliotheque = []) {
  if (!ligne) return null;
  // 1) lookup par code biblio
  if (ligne._biblio) {
    const ouvr = bibliotheque.find((o) => o.code === ligne._biblio);
    if (ouvr?.corps) {
      const slug = normalizeCorpsBibliotheque(ouvr.corps);
      if (slug) return slug;
    }
  }
  // 2) heuristique libellé
  const lib = String(ligne.libelle || "").toLowerCase();
  if (!lib) return null;
  // On parcourt CORPS_LABELS dans l'ordre BTP (gros œuvre → finitions →
  // support) pour que les corps spécifiques l'emportent sur "main_oeuvre" /
  // "divers" en cas d'ambiguïté.
  for (const c of CORPS_LABELS) {
    if (c.id === "divers" || c.id === "main_oeuvre") continue; // skip catch-all
    // Normalisation du label sans accents pour matcher "électricité",
    // "Électricité", "elec…" indifféremment.
    const norm = c.label.toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "");
    const slug = c.id;
    const libNorm = lib.normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (libNorm.includes(norm) || libNorm.includes(slug)) return c.id;
  }
  return null;
}

// autoAffecterLignes(lignes, ouvriers, bibliotheque) → nouveau tableau
//
// Pour chaque ligne (type === "ligne") qui n'a PAS déjà un ouvrier affecté
// manuellement (= salariesAssignes non vide est respecté), on déduit le
// corps via extractCorpsFromLigne puis on appelle affecterOuvrierAuto.
// Les lignes affectées portent salariesAssignes: [id] + affectationAuto:
// true (le flag est utilisé en Commit 3 pour le badge "🤖 IA").
//
// Log console récap (en dev) : "15 lignes affectées (12 spécialistes,
// 3 polyvalents), 2 orphelines (corps : couverture, …)".
// Désactivable via window.__cp_debug_affectation__ = false.
export function autoAffecterLignes(lignes, ouvriers, bibliotheque = []) {
  if (!Array.isArray(lignes)) return lignes;
  let nbAffectees = 0, nbSpecialistes = 0, nbPolyvalents = 0;
  const libellesOrphelins = [];
  const result = lignes.map((l) => {
    if (!l || l.type !== "ligne") return l;
    // Respect du choix utilisateur : ne pas écraser une affectation manuelle
    if (Array.isArray(l.salariesAssignes) && l.salariesAssignes.length > 0) return l;
    const corpsId = extractCorpsFromLigne(l, bibliotheque);
    if (!corpsId) {
      libellesOrphelins.push(l.libelle || "(sans libellé)");
      return l;
    }
    const ouvrId = affecterOuvrierAuto(corpsId, ouvriers);
    if (!ouvrId) {
      libellesOrphelins.push(l.libelle || "(sans libellé)");
      return l;
    }
    nbAffectees++;
    const ouvr = ouvriers.find((o) => o.id === ouvrId);
    const isSpec = Array.isArray(ouvr?.corps_competences) && ouvr.corps_competences.includes(corpsId);
    if (isSpec) nbSpecialistes++; else nbPolyvalents++;
    return { ...l, salariesAssignes: [ouvrId], affectationAuto: true };
  });
  if (typeof window !== "undefined" && window.__cp_debug_affectation__ !== false) {
    const orphMsg = libellesOrphelins.length
      ? ` · ${libellesOrphelins.length} orpheline${libellesOrphelins.length > 1 ? "s" : ""}`
      : "";
    console.info(`[affectation IA] ${nbAffectees} ligne${nbAffectees > 1 ? "s" : ""} affectée${nbAffectees > 1 ? "s" : ""} (${nbSpecialistes} spécialiste${nbSpecialistes > 1 ? "s" : ""}, ${nbPolyvalents} polyvalent${nbPolyvalents > 1 ? "s" : ""})${orphMsg}`,
      libellesOrphelins.length ? libellesOrphelins.slice(0, 5) : "");
  }
  return result;
}
