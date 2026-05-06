// ═══════════════════════════════════════════════════════════════════════════
// Étape 0 — Choix du type d'import (clients / devis / factures)
// ═══════════════════════════════════════════════════════════════════════════

import React from "react";
import { IMPORT_TYPES } from "../../lib/importParser";

const C = {
  text: "#0F172A", textMd: "#334155", textSm: "#64748B", textXs: "#94A3B8",
  border: "#E2E8F0", borderMd: "#CBD5E1",
  surface: "#FFFFFF", bg: "#F8FAFC",
  navy: "#1B3A5C",
  blue: "#2563EB", blueBg: "#EFF6FF",
};

export default function TypeSelectionStep({ onNext }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Que souhaites-tu importer ?</div>
        <div style={{ fontSize: 12, color: C.textSm, marginTop: 4 }}>
          Choisis le type de données à importer depuis un fichier CSV ou Excel.
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
        {Object.entries(IMPORT_TYPES).map(([id, info]) => (
          <button
            key={id}
            onClick={() => onNext({ importType: id })}
            style={{
              padding: 22,
              background: C.surface,
              border: `2px solid ${C.border}`,
              borderRadius: 12,
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "left",
              transition: "all 0.15s",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = info.color;
              e.currentTarget.style.boxShadow = `0 4px 12px ${info.color}33`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = C.border;
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div style={{ fontSize: 36 }}>{info.icon}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: info.color }}>{info.label}</div>
            <div style={{ fontSize: 12, color: C.textSm, lineHeight: 1.5 }}>{info.description}</div>
            <a
              href={info.sampleFile}
              download
              onClick={(e) => e.stopPropagation()}
              style={{
                marginTop: 4,
                fontSize: 11,
                color: C.blue,
                fontWeight: 700,
                textDecoration: "none",
                alignSelf: "flex-start",
                padding: "4px 8px",
                background: C.blueBg,
                borderRadius: 5,
              }}
            >
              ⬇ Fichier exemple
            </a>
          </button>
        ))}
      </div>
    </div>
  );
}
