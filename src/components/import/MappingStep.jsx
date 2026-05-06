// ═══════════════════════════════════════════════════════════════════════════
// Étape 2 — Mapping des colonnes du fichier vers le schéma ChantierPro
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from "react";
import { CLIENT_SCHEMA, autoMapColumns } from "../../lib/importParser";

const C = {
  text: "#0F172A", textMd: "#334155", textSm: "#64748B", textXs: "#94A3B8",
  border: "#E2E8F0", borderMd: "#CBD5E1",
  surface: "#FFFFFF", bg: "#F8FAFC",
  navy: "#1B3A5C", navyBg: "#E8EEF5",
  blue: "#2563EB", blueBg: "#EFF6FF",
  accent: "#E8620A", accentBg: "#FFF3EA",
  green: "#059669", greenBg: "#ECFDF5",
  red: "#DC2626", redBg: "#FEF2F2",
};

export default function MappingStep({ headers = [], rows = [], onBack, onNext }) {
  // mapping : { [headerOriginal]: schemaKey | null }
  const [mapping, setMapping] = useState(() => autoMapColumns(headers, CLIENT_SCHEMA));

  // schemaKey → headerOriginal (inverse, pour savoir ce qui est mappé)
  const reverseMap = useMemo(() => {
    const r = {};
    for (const [h, k] of Object.entries(mapping)) if (k) r[k] = h;
    return r;
  }, [mapping]);

  function setMap(header, schemaKey) {
    setMapping(m => {
      const next = { ...m };
      // Si schemaKey déjà utilisé ailleurs, on l'enlève (1 schemaKey ↔ 1 header)
      if (schemaKey) {
        for (const [h, k] of Object.entries(next)) {
          if (k === schemaKey && h !== header) next[h] = null;
        }
      }
      next[header] = schemaKey || null;
      return next;
    });
  }

  // Échantillon de valeurs (3 premières) par header — pour aider à mapper
  const samplesByHeader = useMemo(() => {
    const s = {};
    for (const h of headers) {
      s[h] = rows.slice(0, 3).map(r => String(r[h] ?? "").trim()).filter(Boolean).slice(0, 2).join(" · ") || "—";
    }
    return s;
  }, [headers, rows]);

  // Vérification : nom (required) doit être mappé
  const nomMapped = !!reverseMap.nom;
  const mappedCount = Object.values(mapping).filter(Boolean).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>2. Associer les colonnes</div>
          <div style={{ fontSize: 12, color: C.textSm, marginTop: 2 }}>
            {headers.length} colonnes détectées · {mappedCount} associées
          </div>
        </div>
        <div style={{ fontSize: 11, color: C.textSm }}>{rows.length} ligne{rows.length > 1 ? "s" : ""} dans le fichier</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 0, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", background: C.surface }}>
        <div style={{ padding: "10px 14px", background: C.bg, borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.textSm, textTransform: "uppercase" }}>
          Colonne du fichier
        </div>
        <div style={{ padding: "10px 14px", background: C.bg, borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.textSm, textTransform: "uppercase", textAlign: "center" }}>
          →
        </div>
        <div style={{ padding: "10px 14px", background: C.bg, borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.textSm, textTransform: "uppercase" }}>
          Champ ChantierPro
        </div>

        {headers.map(h => {
          const mapped = mapping[h];
          const sch = CLIENT_SCHEMA.find(s => s.key === mapped);
          return (
            <React.Fragment key={h}>
              <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{h}</div>
                <div style={{ fontSize: 10, color: C.textXs, marginTop: 2 }}>{samplesByHeader[h]}</div>
              </div>
              <div style={{ padding: "10px 8px", borderBottom: `1px solid ${C.border}`, color: mapped ? C.green : C.textXs, textAlign: "center", fontSize: 16 }}>
                {mapped ? "✓" : "—"}
              </div>
              <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}` }}>
                <select
                  value={mapping[h] || ""}
                  onChange={e => setMap(h, e.target.value || null)}
                  style={{
                    width: "100%",
                    padding: "6px 9px",
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    fontSize: 12,
                    background: C.surface,
                    color: C.text,
                    fontFamily: "inherit",
                  }}
                >
                  <option value="">— Ignorer cette colonne —</option>
                  {CLIENT_SCHEMA.map(s => (
                    <option key={s.key} value={s.key} disabled={!!reverseMap[s.key] && reverseMap[s.key] !== h}>
                      {s.label}{s.required ? " *" : ""}
                    </option>
                  ))}
                </select>
                {sch?.help && <div style={{ fontSize: 10, color: C.textXs, marginTop: 3, fontStyle: "italic" }}>{sch.help}</div>}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {!nomMapped && (
        <div style={{ padding: "10px 14px", background: C.redBg, border: `1px solid ${C.red}33`, borderRadius: 8, fontSize: 12, color: C.red, fontWeight: 600 }}>
          ⚠ Le champ <strong>Nom complet</strong> est obligatoire. Mappe-le avant de continuer.
        </div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
        <button onClick={onBack} style={{ padding: "10px 18px", background: C.surface, border: `1px solid ${C.border}`, color: C.textMd, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          ← Retour
        </button>
        <button
          onClick={() => nomMapped && onNext({ mapping })}
          disabled={!nomMapped}
          style={{
            padding: "10px 18px",
            background: nomMapped ? C.accent : C.borderMd,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: nomMapped ? "pointer" : "not-allowed",
            fontFamily: "inherit",
          }}
        >
          Aperçu →
        </button>
      </div>
    </div>
  );
}
