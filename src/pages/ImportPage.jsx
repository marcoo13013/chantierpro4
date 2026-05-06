// ═══════════════════════════════════════════════════════════════════════════
// Page Import — wizard 5 étapes (Type → Upload → Mapping → Preview → Import)
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import TypeSelectionStep from "../components/import/TypeSelectionStep";
import UploadStep from "../components/import/UploadStep";
import MappingStep from "../components/import/MappingStep";
import PreviewStep from "../components/import/PreviewStep";
import ImportStep from "../components/import/ImportStep";
import { IMPORT_TYPES } from "../lib/importParser";

const C = {
  text: "#0F172A", textMd: "#334155", textSm: "#64748B", textXs: "#94A3B8",
  border: "#E2E8F0", borderMd: "#CBD5E1",
  surface: "#FFFFFF", bg: "#F8FAFC",
  navy: "#1B3A5C", navyBg: "#E8EEF5",
  blue: "#2563EB",
  accent: "#E8620A",
  green: "#059669",
};

const STEPS = [
  { id: 0, label: "Type",     icon: "📂" },
  { id: 1, label: "Fichier",  icon: "📤" },
  { id: 2, label: "Colonnes", icon: "🔗" },
  { id: 3, label: "Aperçu",   icon: "👁" },
  { id: 4, label: "Import",   icon: "✅" },
];

export default function ImportPage({ userId, existingClients = [], existingDocs = [], onImported }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    importType: null,
    file: null,
    headers: [],
    rows: [],
    mapping: {},
    enriched: [],
    skipDuplicates: true,
    skipInvalid: true,
    autoCreateClients: true,
  });

  function reset() {
    setStep(0);
    setData({
      importType: null, file: null, headers: [], rows: [], mapping: {},
      enriched: [], skipDuplicates: true, skipInvalid: true, autoCreateClients: true,
    });
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>
          📥 Importer des données
        </h1>
        <div style={{ fontSize: 13, color: C.textSm }}>
          Importer clients, devis ou factures depuis un fichier CSV ou Excel — détection automatique des colonnes, validation et déduplication.
        </div>
      </div>

      {/* Stepper */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 28, padding: "14px 18px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10 }}>
        {STEPS.map((s, i) => {
          const active = step === s.id;
          const done = step > s.id;
          return (
            <React.Fragment key={s.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: active ? C.accent : done ? C.green : C.bg,
                  color: active || done ? "#fff" : C.textSm,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 800,
                  border: `2px solid ${active ? C.accent : done ? C.green : C.border}`,
                  transition: "all 0.2s",
                }}>
                  {done ? "✓" : s.id + 1}
                </div>
                <div style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? C.accent : done ? C.green : C.textSm }}>
                  {s.icon} {s.label}
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: done ? C.green : C.border, margin: "0 12px", transition: "all 0.2s" }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Indicateur type sélectionné (étapes 1+) */}
      {step > 0 && data.importType && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "10px 14px", background: C.navyBg, borderRadius: 8 }}>
          <span style={{ fontSize: 18 }}>{IMPORT_TYPES[data.importType].icon}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>
            Import de <strong>{IMPORT_TYPES[data.importType].label}</strong>
          </span>
          {step === 1 && (
            <button onClick={reset} style={{ marginLeft: "auto", background: "transparent", border: "none", color: C.blue, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Changer
            </button>
          )}
        </div>
      )}

      {/* Contenu de l'étape */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24 }}>
        {step === 0 && (
          <TypeSelectionStep
            onNext={({ importType }) => {
              setData(d => ({ ...d, importType }));
              setStep(1);
            }}
          />
        )}
        {step === 1 && (
          <UploadStep
            importType={data.importType}
            onBack={() => setStep(0)}
            onNext={({ file, headers, rows }) => {
              setData(d => ({ ...d, file, headers, rows }));
              setStep(2);
            }}
          />
        )}
        {step === 2 && (
          <MappingStep
            headers={data.headers}
            rows={data.rows}
            importType={data.importType}
            onBack={() => setStep(1)}
            onNext={({ mapping }) => {
              setData(d => ({ ...d, mapping }));
              setStep(3);
            }}
          />
        )}
        {step === 3 && (
          <PreviewStep
            rows={data.rows}
            mapping={data.mapping}
            importType={data.importType}
            existingClients={existingClients}
            existingDocs={existingDocs}
            onBack={() => setStep(2)}
            onNext={({ enriched, skipDuplicates, skipInvalid, autoCreateClients }) => {
              setData(d => ({ ...d, enriched, skipDuplicates, skipInvalid, autoCreateClients: autoCreateClients ?? d.autoCreateClients }));
              setStep(4);
            }}
          />
        )}
        {step === 4 && (
          <ImportStep
            enriched={data.enriched}
            skipDuplicates={data.skipDuplicates}
            skipInvalid={data.skipInvalid}
            autoCreateClients={data.autoCreateClients}
            importType={data.importType}
            userId={userId}
            existingClients={existingClients}
            existingDocs={existingDocs}
            onClose={reset}
            onImported={(payload) => onImported?.(payload)}
          />
        )}
      </div>
    </div>
  );
}
