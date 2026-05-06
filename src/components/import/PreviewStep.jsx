// ═══════════════════════════════════════════════════════════════════════════
// Étape 3 — Aperçu 5 premières lignes mappées + détection doublons
// ═══════════════════════════════════════════════════════════════════════════

import React, { useMemo, useState } from "react";
import { CLIENT_SCHEMA, applyMapping, validateClientRow, detectDuplicates } from "../../lib/importParser";

const C = {
  text: "#0F172A", textMd: "#334155", textSm: "#64748B", textXs: "#94A3B8",
  border: "#E2E8F0", borderMd: "#CBD5E1",
  surface: "#FFFFFF", bg: "#F8FAFC",
  navy: "#1B3A5C", navyBg: "#E8EEF5",
  blue: "#2563EB", blueBg: "#EFF6FF",
  accent: "#E8620A", accentBg: "#FFF3EA",
  green: "#059669", greenBg: "#ECFDF5",
  red: "#DC2626", redBg: "#FEF2F2",
  orange: "#EA580C", orangeBg: "#FFF7ED",
};

export default function PreviewStep({ rows, mapping, existingClients = [], onBack, onNext }) {
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [skipInvalid, setSkipInvalid] = useState(true);

  // Mappe + valide + détecte doublons
  const enriched = useMemo(() => {
    const mapped = applyMapping(rows, mapping);
    const withDup = detectDuplicates(mapped, existingClients);
    return withDup.map((r, idx) => ({
      ...r,
      _index: idx,
      _validation: validateClientRow(r),
    }));
  }, [rows, mapping, existingClients]);

  const stats = useMemo(() => {
    const total = enriched.length;
    const dup = enriched.filter(r => r._isDuplicate).length;
    const invalid = enriched.filter(r => !r._validation.valid).length;
    let toImport = 0;
    for (const r of enriched) {
      if (skipDuplicates && r._isDuplicate) continue;
      if (skipInvalid && !r._validation.valid) continue;
      toImport++;
    }
    return { total, dup, invalid, toImport };
  }, [enriched, skipDuplicates, skipInvalid]);

  // Affiche TOUTES les lignes mais avec scroll. Tableau virtualisé léger
  // (sans lib externe — affichage natif suffit pour <1000 lignes).
  const displayedColumns = CLIENT_SCHEMA.filter(s => Object.values(mapping).includes(s.key));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>3. Aperçu et validation</div>
        <div style={{ fontSize: 12, color: C.textSm, marginTop: 2 }}>
          Vérifie les données avant l'import
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {[
          { l: "Lignes lues", v: stats.total, c: C.navy },
          { l: "Doublons détectés", v: stats.dup, c: C.orange },
          { l: "Lignes invalides", v: stats.invalid, c: C.red },
          { l: "À importer", v: stats.toImport, c: C.green },
        ].map(it => (
          <div key={it.l} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ fontSize: 10, color: C.textSm, fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>{it.l}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: it.c, fontFamily: "monospace" }}>{it.v}</div>
          </div>
        ))}
      </div>

      {/* Toggles */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "10px 14px", background: C.bg, borderRadius: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: C.textMd, fontWeight: 600 }}>
          <input type="checkbox" checked={skipDuplicates} onChange={e => setSkipDuplicates(e.target.checked)} />
          Ignorer les doublons (nom + email déjà en base)
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: C.textMd, fontWeight: 600 }}>
          <input type="checkbox" checked={skipInvalid} onChange={e => setSkipInvalid(e.target.checked)} />
          Ignorer les lignes invalides
        </label>
      </div>

      {/* Tableau */}
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "auto", maxHeight: 400, background: C.surface }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead style={{ position: "sticky", top: 0, background: C.bg, zIndex: 1 }}>
            <tr>
              <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: C.textSm, textTransform: "uppercase", fontSize: 9, borderBottom: `1px solid ${C.border}`, width: 60 }}>Statut</th>
              {displayedColumns.map(col => (
                <th key={col.key} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: C.textSm, textTransform: "uppercase", fontSize: 9, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {enriched.slice(0, 200).map((r, i) => {
              const willSkip = (skipDuplicates && r._isDuplicate) || (skipInvalid && !r._validation.valid);
              const bg = willSkip ? C.bg : (i % 2 === 0 ? C.surface : C.bg);
              const errorFields = new Set((r._validation.errors || []).map(e => e.field));
              return (
                <tr key={r._index} style={{ background: bg, opacity: willSkip ? 0.55 : 1, borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "6px 10px", verticalAlign: "top" }}>
                    {r._isDuplicate && (
                      <span title="Déjà présent en base" style={{ display: "inline-block", padding: "2px 6px", background: C.orangeBg, color: C.orange, borderRadius: 4, fontSize: 9, fontWeight: 700, marginRight: 4 }}>DOUBLON</span>
                    )}
                    {!r._validation.valid && (
                      <span title={r._validation.errors.map(e => e.msg).join(", ")} style={{ display: "inline-block", padding: "2px 6px", background: C.redBg, color: C.red, borderRadius: 4, fontSize: 9, fontWeight: 700 }}>INVALIDE</span>
                    )}
                    {r._validation.valid && !r._isDuplicate && (
                      <span style={{ color: C.green, fontSize: 14 }}>✓</span>
                    )}
                  </td>
                  {displayedColumns.map(col => (
                    <td key={col.key} style={{
                      padding: "6px 10px",
                      verticalAlign: "top",
                      color: errorFields.has(col.key) ? C.red : C.text,
                      background: errorFields.has(col.key) ? C.redBg : "transparent",
                    }}>
                      {r[col.key] || <span style={{ color: C.textXs, fontStyle: "italic" }}>—</span>}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {enriched.length > 200 && (
          <div style={{ padding: 10, textAlign: "center", fontSize: 10, color: C.textSm, background: C.bg }}>
            Affichage limité à 200 lignes · {enriched.length - 200} lignes supplémentaires seront aussi traitées
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
        <button onClick={onBack} style={{ padding: "10px 18px", background: C.surface, border: `1px solid ${C.border}`, color: C.textMd, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          ← Retour
        </button>
        <button
          onClick={() => onNext({ enriched, skipDuplicates, skipInvalid })}
          disabled={stats.toImport === 0}
          style={{
            padding: "10px 18px",
            background: stats.toImport === 0 ? C.borderMd : C.accent,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: stats.toImport === 0 ? "not-allowed" : "pointer",
            fontFamily: "inherit",
          }}
        >
          Importer {stats.toImport} client{stats.toImport > 1 ? "s" : ""} →
        </button>
      </div>
    </div>
  );
}
