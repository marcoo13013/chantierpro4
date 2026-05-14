// ═══════════════════════════════════════════════════════════════════════════
// format.js — helpers de formatage numérique centralisés (FR)
// ═══════════════════════════════════════════════════════════════════════════
// Tous les helpers utilisent un arrondi explicite (Math.round(x*10^d)/10^d)
// AVANT toLocaleString, pour éviter les surprises liées aux flottants type
// 1.005 (qui s'affiche "1,00 €" sans arrondi explicite à cause de IEEE 754).
//
// Sortie en locale "fr-FR" → séparateur décimal virgule, séparateur milliers
// NARROW NO-BREAK SPACE (U+202F). Pour usage PDF/CSV, sanitize en aval via
// sanitizeForPDF si nécessaire (sinon pdf-lib WinAnsi throw sur U+202F).
// ═══════════════════════════════════════════════════════════════════════════

// ─── Arrondi décimal stable ────────────────────────────────────────────────
// Math.round(x * 100) / 100 souffre de l'imprécision flottante : par exemple
// roundN(1.005, 2) donnerait 1 au lieu de 1.01 (car 1.005 est stocké comme
// 1.00499...). On passe par une exponentielle/notation décimale pour forcer
// l'arrondi sur la représentation textuelle.
function roundN(x, decimales) {
  if (!Number.isFinite(x)) return 0;
  const n = Number(x);
  if (n === 0) return 0;
  const factor = Math.pow(10, decimales);
  // Astuce : passer par Number(x.toFixed(d)) puis re-multiplier évite la
  // perte de précision intermédiaire de Math.round(x * factor).
  return Math.round(Number((n * factor).toFixed(decimales))) / factor;
}

// ─── Format euro : "1 234,56 €" ────────────────────────────────────────────
export function formatEuro(n, { decimales = 2 } = {}) {
  const v = roundN(Number(n) || 0, decimales);
  return v.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

// ─── Format heures : "12,5 h" / "12 h" si entier ───────────────────────────
export function formatHeures(h, { decimales = 1, suffix = " h" } = {}) {
  const v = roundN(Number(h) || 0, decimales);
  const opts = Number.isInteger(v)
    ? { maximumFractionDigits: 0 }
    : { minimumFractionDigits: 1, maximumFractionDigits: decimales };
  return v.toLocaleString("fr-FR", opts) + suffix;
}

// ─── Format jours : "3 j" / "3,5 j" ────────────────────────────────────────
export function formatJours(j, { decimales = 1, suffix = " j" } = {}) {
  const v = roundN(Number(j) || 0, decimales);
  const opts = Number.isInteger(v)
    ? { maximumFractionDigits: 0 }
    : { minimumFractionDigits: 1, maximumFractionDigits: decimales };
  return v.toLocaleString("fr-FR", opts) + suffix;
}

// ─── Format pourcent : "42 %" (entier par défaut) ──────────────────────────
// Accepte soit un ratio (0.42) soit un pourcentage déjà multiplié (42).
// Si |p| <= 1 on suppose ratio, sinon pourcentage déjà appliqué.
export function formatPourcent(p, { decimales = 0, fromRatio = null } = {}) {
  let v = Number(p) || 0;
  const isRatio = fromRatio === null ? Math.abs(v) <= 1 : fromRatio;
  if (isRatio) v = v * 100;
  v = roundN(v, decimales);
  return v.toLocaleString("fr-FR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }) + " %";
}

// ─── Format coefficient : "1,5" / "1" si entier ────────────────────────────
// Pour multiplicateurs de marge, coefficient de vente, etc.
export function formatCoefficient(c, { decimales = 2, suffix = "" } = {}) {
  const v = roundN(Number(c) || 0, decimales);
  const opts = Number.isInteger(v)
    ? { maximumFractionDigits: 0 }
    : { minimumFractionDigits: 1, maximumFractionDigits: decimales };
  return v.toLocaleString("fr-FR", opts) + suffix;
}

// ─── Aliases courts (préférence Marco) ─────────────────────────────────────
// Sortie sans espace avant le suffixe : "251,6h" / "42%" / "1234,56 €".
// roundN exposé pour usage direct.
export function formatH(h, decimals = 1) {
  if (h == null || !Number.isFinite(+h)) return "0h";
  const v = roundN(+h, decimals);
  const opts = Number.isInteger(v)
    ? { maximumFractionDigits: 0 }
    : { minimumFractionDigits: 1, maximumFractionDigits: decimals };
  return v.toLocaleString("fr-FR", opts) + "h";
}
export function formatEur(n) {
  if (n == null || !Number.isFinite(+n)) return "0,00 €";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(+n);
}
export function formatPct(n, decimals = 0) {
  if (n == null || !Number.isFinite(+n)) return "0%";
  return roundN(+n, decimals).toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }) + "%";
}

// ─── Export interne (utile pour tests / debug) ─────────────────────────────
export { roundN };
