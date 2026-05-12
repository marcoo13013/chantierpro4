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
