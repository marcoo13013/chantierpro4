// ═══════════════════════════════════════════════════════════════════════════
// Étape 1 — Upload fichier CSV/XLSX
// ═══════════════════════════════════════════════════════════════════════════

import React, { useRef, useState } from "react";
import { parseFile, IMPORT_TYPES } from "../../lib/importParser";

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

export default function UploadStep({ onNext, onBack, importType = "clients" }) {
  const typeInfo = IMPORT_TYPES[importType] || IMPORT_TYPES.clients;
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Pour les factures, on accepte aussi le PDF Factur-X (extraction du XML
  // embarqué côté client, jamais uploadé serveur — cf extractFromPdf.js).
  const acceptsPdf = importType === "factures";

  async function handleFile(file) {
    setError(null);
    setLoading(true);
    try {
      const isPdf = file && (file.type === "application/pdf" || /\.pdf$/i.test(file.name || ""));
      if (isPdf && acceptsPdf) {
        // Branche Factur-X : extraction XML + parsing CII + facture
        // structurée. Lazy-load du module (chunk dédié 518 KB gzip déjà tiré
        // par la génération Factur-X — coût bundle 0 si déjà downloadé).
        const { extractFacturXFromPdf } = await import("../../lib/facturx/extractFromPdf");
        const result = await extractFacturXFromPdf(file);
        // On signale au parent (ImportPage) qu'on bypass l'étape Mapping.
        onNext({
          file,
          fileType: "pdf",
          facturx: result, // { facture, profile, rawXml, sourceFilename }
        });
        return;
      }
      if (isPdf && !acceptsPdf) {
        throw new Error("Les PDFs ne sont acceptés que pour l'import de factures (Factur-X).");
      }
      const { headers, rows } = await parseFile(file);
      if (headers.length === 0 || rows.length === 0) {
        throw new Error("Fichier vide ou non lisible");
      }
      onNext({ file, headers, rows });
    } catch (err) {
      console.error("[UploadStep]", err);
      setError(err.message || "Erreur de lecture");
    } finally {
      setLoading(false);
    }
  }

  function onChange(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) handleFile(f);
  }
  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>1. Importer un fichier — {typeInfo.icon} {typeInfo.label}</div>
      <div style={{ fontSize: 12, color: C.textSm }}>
        Formats acceptés : CSV, XLSX, XLS{acceptsPdf ? ", PDF Factur-X" : ""} · Taille max {acceptsPdf ? "20 MB" : "10 MB"}
        {acceptsPdf && <span style={{ display: "block", marginTop: 2, color: C.green, fontWeight: 600 }}>📄 Drop un PDF Factur-X généré par ChantierPro ou un éditeur tiers — extraction automatique des données.</span>}
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? C.accent : C.borderMd}`,
          borderRadius: 12,
          background: dragOver ? C.accentBg : C.bg,
          padding: "60px 24px",
          textAlign: "center",
          cursor: "pointer",
          transition: "all 0.15s",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>📤</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>
          Glisse-dépose ton fichier ici
        </div>
        <div style={{ fontSize: 12, color: C.textSm, marginBottom: 14 }}>
          ou clique pour parcourir
        </div>
        <button
          type="button"
          disabled={loading}
          style={{
            padding: "10px 20px",
            background: C.accent,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {loading ? "⏳ Lecture..." : "📁 Choisir un fichier"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={acceptsPdf
            ? ".csv,.xlsx,.xls,.txt,.pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf"
            : ".csv,.xlsx,.xls,.txt,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
          onChange={onChange}
          style={{ display: "none" }}
        />
      </div>

      {error && (
        <div style={{
          padding: "10px 14px",
          background: C.redBg,
          border: `1px solid ${C.red}33`,
          borderRadius: 8,
          color: C.red,
          fontSize: 12,
          fontWeight: 600,
        }}>
          ❌ {error}
        </div>
      )}

      <div style={{ fontSize: 11, color: C.textSm, lineHeight: 1.6, padding: "10px 14px", background: C.navyBg, borderRadius: 8 }}>
        💡 <strong>Astuce</strong> : la première ligne du fichier doit contenir les en-têtes des colonnes
        (Nom, Email, Téléphone…). Le système détectera automatiquement les colonnes connues.
        <br />
        <a
          href={typeInfo.sampleFile}
          download
          onClick={(e) => e.stopPropagation()}
          style={{ display: "inline-block", marginTop: 6, color: C.blue, fontWeight: 700, textDecoration: "none" }}
        >
          ⬇ Télécharger un fichier exemple ({typeInfo.label.toLowerCase()})
        </a>
      </div>
      {onBack && (
        <button onClick={onBack} style={{ alignSelf: "flex-start", padding: "8px 14px", background: C.surface, border: `1px solid ${C.border}`, color: C.textMd, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          ← Changer le type d'import
        </button>
      )}
    </div>
  );
}
