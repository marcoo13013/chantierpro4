// ═══════════════════════════════════════════════════════════════════════════
// TrancheCard — Composant d'affichage d'une tranche de devis (Sprint 1)
// ═══════════════════════════════════════════════════════════════════════════
// Affiche une tranche avec :
// - Bandeau coloré (titre + numéro de tranche + sous-total)
// - Liste des lignes avec sous-numérotation (1.1, 1.2, ...)
// - Couleur différenciée par corps de métier
//
// Usage dans App.jsx :
//   import TrancheCard from "./components/TrancheCard";
//   {devis.tranches.map((tranche, i) => (
//     <TrancheCard key={tranche.id} tranche={tranche} numero={i+1} />
//   ))}
//
// Props :
// - tranche : { id, titre, lignes: [...], sousTotalHT }
// - numero : numéro de la tranche (1, 2, 3...)
// ═══════════════════════════════════════════════════════════════════════════

import React from "react";

// ─── Couleurs par corps de métier ─────────────────────────────────────────
const COULEURS_CORPS = {
  "Maçonnerie":  { bg: "#FEE2E2", border: "#DC2626", text: "#991B1B", icon: "🧱" }, // rouge brique
  "Plomberie":   { bg: "#DBEAFE", border: "#2563EB", text: "#1E40AF", icon: "🚿" }, // bleu
  "Électricité": { bg: "#FEF3C7", border: "#D97706", text: "#92400E", icon: "🔌" }, // jaune
  "Carrelage":   { bg: "#F3E8FF", border: "#9333EA", text: "#6B21A8", icon: "🟫" }, // violet
  "Peinture":    { bg: "#FCE7F3", border: "#DB2777", text: "#9F1239", icon: "🎨" }, // rose
  "Menuiserie":  { bg: "#D1FAE5", border: "#059669", text: "#065F46", icon: "🪟" }, // vert
  "Isolation":   { bg: "#E0E7FF", border: "#4F46E5", text: "#3730A3", icon: "🧶" }, // indigo
  "Démolition":  { bg: "#F3F4F6", border: "#6B7280", text: "#374151", icon: "🔨" }, // gris
};

const COULEUR_DEFAUT = { bg: "#F3F4F6", border: "#9CA3AF", text: "#374151", icon: "🔧" };

function getCouleurCorps(corps) {
  return COULEURS_CORPS[corps] || COULEUR_DEFAUT;
}

// ─── Style du bandeau de tranche ──────────────────────────────────────────
function getStyleBandeau(tranche) {
  // Si toutes les lignes sont du même corps, on prend la couleur de ce corps
  // Sinon on prend une couleur "tranche neutre" (orange clair, comme Mediabat)
  const corpsUniques = [...new Set((tranche.lignes || []).map(l => l.corps))];
  if (corpsUniques.length === 1 && corpsUniques[0]) {
    return getCouleurCorps(corpsUniques[0]);
  }
  // Multi-corps → couleur neutre rose/saumon (style Mediabat)
  return { bg: "#FFE4E6", border: "#FB7185", text: "#9F1239", icon: "📋" };
}

// ─── Formatage des nombres ────────────────────────────────────────────────
function formatEuro(n) {
  if (n === null || n === undefined || isNaN(n)) return "0 €";
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " €";
}

function formatQte(n) {
  if (n === null || n === undefined || isNaN(n)) return "0";
  // Si entier, pas de décimales ; sinon max 2 décimales
  return Number.isInteger(n) ? String(n) : n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

// ─── Composant principal ──────────────────────────────────────────────────
export default function TrancheCard({ tranche, numero }) {
  if (!tranche) return null;

  const couleur = getStyleBandeau(tranche);
  const lignes = tranche.lignes || [];

  return (
    <div style={{
      marginBottom: 16,
      borderRadius: 8,
      overflow: "hidden",
      border: `1px solid ${couleur.border}`,
      backgroundColor: "#FFFFFF",
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    }}>
      {/* Bandeau de tranche */}
      <div style={{
        backgroundColor: couleur.bg,
        borderBottom: `2px solid ${couleur.border}`,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
          {/* Numero de tranche */}
          <div style={{
            backgroundColor: couleur.border,
            color: "#FFFFFF",
            width: 32,
            height: 32,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 15,
            flexShrink: 0,
          }}>
            {numero}
          </div>
          {/* Icone + titre */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 11, color: couleur.text, opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Tranche {numero}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: couleur.text, lineHeight: 1.3, marginTop: 2 }}>
              <span style={{ marginRight: 6 }}>{couleur.icon}</span>
              {tranche.titre}
            </div>
          </div>
        </div>
        {/* Sous-total */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: couleur.text, opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Sous-total HT
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: couleur.text, marginTop: 2 }}>
            {formatEuro(tranche.sousTotalHT)}
          </div>
        </div>
      </div>

      {/* Liste des lignes */}
      <div>
        {lignes.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "#9CA3AF", fontSize: 13, fontStyle: "italic" }}>
            Aucune ligne dans cette tranche
          </div>
        ) : (
          lignes.map((ligne, idx) => (
            <LigneRow
              key={`${tranche.id}-${idx}`}
              ligne={ligne}
              numero={`${numero}.${idx + 1}`}
              isLast={idx === lignes.length - 1}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Composant Ligne ──────────────────────────────────────────────────────
function LigneRow({ ligne, numero, isLast }) {
  const couleurCorps = getCouleurCorps(ligne.corps);

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "60px 90px 1fr 110px 110px 110px",
      gap: 10,
      padding: "10px 16px",
      borderBottom: isLast ? "none" : "1px solid #F3F4F6",
      alignItems: "center",
      fontSize: 13,
    }}>
      {/* Numero ligne (1.1, 1.2...) */}
      <div style={{
        fontWeight: 700,
        color: "#6B7280",
        fontSize: 12,
      }}>
        {numero}
      </div>

      {/* Code ouvrage */}
      <div style={{
        backgroundColor: couleurCorps.bg,
        color: couleurCorps.text,
        padding: "3px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 700,
        textAlign: "center",
        fontFamily: "monospace",
      }}>
        {ligne.code || "—"}
      </div>

      {/* Libelle */}
      <div style={{ color: "#1F2937", lineHeight: 1.4 }}>
        {ligne.libelle}
        {ligne.corps && (
          <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>
            {ligne.corps}
          </div>
        )}
      </div>

      {/* Quantite x Unite */}
      <div style={{ textAlign: "right", color: "#374151" }}>
        {formatQte(ligne.qte)} {ligne.unite || ""}
      </div>

      {/* PU HT */}
      <div style={{ textAlign: "right", color: "#374151" }}>
        {formatEuro(ligne.puHT)}
      </div>

      {/* Total HT */}
      <div style={{ textAlign: "right", fontWeight: 700, color: "#1F2937" }}>
        {formatEuro(ligne.totalHT)}
      </div>
    </div>
  );
}
