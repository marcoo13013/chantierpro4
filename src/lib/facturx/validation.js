// ═══════════════════════════════════════════════════════════════════════════
// validation.js — helpers de validation des champs Factur-X
// ═══════════════════════════════════════════════════════════════════════════
// Utilisés à 2 endroits :
//   1. UI Paramètres > Conformité (checklist visuelle des champs manquants)
//   2. generator.js (avant la génération XML, pour avertir si profil invalide)
//
// On fait des validations FORMAT uniquement (longueur + caractères) — pas de
// validation business (numéro réel valide en base INSEE etc.). Le but est de
// catcher 99% des erreurs de saisie, pas de dédoublonner avec une API tierce.
// ═══════════════════════════════════════════════════════════════════════════

// SIRET : 14 chiffres exactement
export function isValidSiret(s) {
  if (!s) return false;
  const v = String(s).replace(/\s/g, "");
  return /^\d{14}$/.test(v);
}

// TVA intra FR : "FR" + 2 chiffres clé + 9 chiffres SIREN. Plus largement,
// on accepte FR + 11 chars (chiffres ou lettres O/X pour clés calculées).
// Standard EU : 2 lettres pays + 2-12 caractères.
export function isValidTvaIntra(s) {
  if (!s) return false;
  const v = String(s).replace(/\s/g, "").toUpperCase();
  // FR strict : 2 chiffres ou lettres + 9 chiffres
  if (v.startsWith("FR")) return /^FR[0-9A-HJ-NP-Z]{2}\d{9}$/.test(v);
  // Autre pays UE : 2 lettres + 2 à 12 alphanumériques
  return /^[A-Z]{2}[0-9A-Z]{2,12}$/.test(v);
}

// IBAN : 2 lettres pays + 2 chiffres + 11 à 30 alphanumériques.
// FR = 27 caractères. On accepte tous les pays UE (longueurs variables).
export function isValidIban(s) {
  if (!s) return false;
  const v = String(s).replace(/\s/g, "").toUpperCase();
  return /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(v);
}

// BIC/SWIFT : 8 ou 11 caractères alphanumériques.
// 4 lettres banque + 2 lettres pays + 2 alphanumériques agence (+ 3 succursale)
export function isValidBic(s) {
  if (!s) return false;
  const v = String(s).replace(/\s/g, "").toUpperCase();
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(v);
}

// Adresse complète : on demande au minimum rue + code postal + ville
export function isValidAdresse(entreprise) {
  if (!entreprise) return false;
  const rue = (entreprise.adresse || "").trim();
  const cp = (entreprise.code_postal || "").trim();
  const ville = (entreprise.ville || "").trim();
  return rue.length >= 4 && cp.length >= 4 && ville.length >= 2;
}

// Code postal FR : 5 chiffres
export function isValidCodePostalFR(s) {
  if (!s) return false;
  return /^\d{5}$/.test(String(s).replace(/\s/g, ""));
}

// ─── Audit complet d'une entreprise (pour Conformité Paramètres) ───────────
// Retourne { ok: boolean, items: [{key, label, ok, hint?}], score: 0..100 }
export function auditConformiteFacturX(entreprise) {
  const items = [
    { key: "nom",          label: "Raison sociale",            ok: !!(entreprise?.nom || "").trim() },
    { key: "siret",        label: "SIRET (14 chiffres)",       ok: isValidSiret(entreprise?.siret),
      hint: !isValidSiret(entreprise?.siret) ? "Format attendu : 14 chiffres consécutifs (ex 12345678901234)" : undefined },
    { key: "tva_intra",    label: "N° TVA intracommunautaire", ok: isValidTvaIntra(entreprise?.tva_intra),
      hint: !isValidTvaIntra(entreprise?.tva_intra) ? 'Format FR : "FR" + 2 chars + 9 chiffres (ex FR12345678901)' : undefined },
    { key: "iban",         label: "IBAN du compte bancaire",   ok: isValidIban(entreprise?.iban),
      hint: !isValidIban(entreprise?.iban) ? "Format IBAN normalisé (ex FR76 1234 5678 9012 3456 7890 123)" : undefined },
    { key: "bic",          label: "BIC / SWIFT",               ok: isValidBic(entreprise?.bic),
      hint: !isValidBic(entreprise?.bic) ? "8 ou 11 caractères (ex BNPAFRPPXXX)" : undefined },
    { key: "adresse",      label: "Adresse complète",          ok: isValidAdresse(entreprise),
      hint: !isValidAdresse(entreprise) ? "Rue + code postal + ville requis" : undefined },
  ];
  const okCount = items.filter((i) => i.ok).length;
  return {
    items,
    ok: okCount === items.length,
    score: Math.round((okCount / items.length) * 100),
  };
}
