// ═══════════════════════════════════════════════════════════════════════════
// Étape 3 — Aperçu mappé + détection doublons (multi-types)
// ═══════════════════════════════════════════════════════════════════════════

import React, { useMemo, useState } from "react";
import {
  getSchema, applyMapping,
  validateClientRow, validateDevisFactureRow,
  detectDuplicates, detectDuplicatesByNumero,
  buildDocsFromRows,
  IMPORT_TYPES,
} from "../../lib/importParser";

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

export default function PreviewStep({
  rows, mapping, importType = "clients",
  existingClients = [], existingDocs = [],
  onBack, onNext,
}) {
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [skipInvalid, setSkipInvalid] = useState(true);
  const [autoCreateClients, setAutoCreateClients] = useState(true);

  const isDocsType = importType === "devis" || importType === "factures";
  const schema = useMemo(() => getSchema(importType), [importType]);

  // Pour clients : on travaille ligne par ligne. Pour devis/factures : on
  // applique le mapping puis on groupe par numero.
  const enriched = useMemo(() => {
    const mapped = applyMapping(rows, mapping);
    if (importType === "clients") {
      const withDup = detectDuplicates(mapped, existingClients);
      return withDup.map((r, idx) => ({
        ...r, _index: idx, _validation: validateClientRow(r),
      }));
    }
    // Devis / factures : groupement
    const docs = buildDocsFromRows(mapped, importType);
    const withDup = detectDuplicatesByNumero(
      docs, existingDocs,
      importType === "factures" ? "facture" : "devis"
    );
    // Valide chaque doc : numero + client_nom + au moins 1 ligne
    return withDup.map((d, idx) => {
      const errors = [];
      if (!d.numero) errors.push({ field: "numero", msg: "N° manquant" });
      if (!d.client_nom) errors.push({ field: "client_nom", msg: "Client manquant" });
      if (d.lignes.length === 0) errors.push({ field: "lignes", msg: "Aucune ligne" });
      // Date invalide → captured before parseDateFR ; ici on a un fallback today
      // Valide chaque ligne brièvement
      for (const l of d.lignes) {
        if (l.qte <= 0) { errors.push({ field: "qte", msg: "Qté invalide" }); break; }
      }
      return { ...d, _index: idx, _validation: { valid: errors.length === 0, errors } };
    });
  }, [rows, mapping, existingClients, existingDocs, importType]);

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
          3. Aperçu et validation
        </div>
        <div style={{ fontSize: 12, color: C.textSm, marginTop: 2 }}>
          {isDocsType
            ? `${enriched.length} ${IMPORT_TYPES[importType].label.toLowerCase()} regroupé${enriched.length > 1 ? "s" : ""} depuis ${rows.length} lignes CSV`
            : "Vérifie les données avant l'import"}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {[
          { l: isDocsType ? "Documents lus" : "Lignes lues", v: stats.total, c: C.navy },
          { l: "Doublons détectés", v: stats.dup, c: C.orange },
          { l: "Invalides", v: stats.invalid, c: C.red },
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
          Ignorer les doublons {isDocsType ? "(par numéro)" : "(nom + email)"}
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: C.textMd, fontWeight: 600 }}>
          <input type="checkbox" checked={skipInvalid} onChange={e => setSkipInvalid(e.target.checked)} />
          Ignorer les invalides
        </label>
        {isDocsType && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: C.textMd, fontWeight: 600 }}>
            <input type="checkbox" checked={autoCreateClients} onChange={e => setAutoCreateClients(e.target.checked)} />
            Créer les clients manquants automatiquement
          </label>
        )}
      </div>

      {/* Tableau */}
      {isDocsType
        ? <DocsPreviewTable docs={enriched} skipDuplicates={skipDuplicates} skipInvalid={skipInvalid} importType={importType} existingClients={existingClients}/>
        : <ClientsPreviewTable rows={enriched} schema={schema} mapping={mapping} skipDuplicates={skipDuplicates} skipInvalid={skipInvalid}/>
      }

      <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
        <button onClick={onBack} style={{ padding: "10px 18px", background: C.surface, border: `1px solid ${C.border}`, color: C.textMd, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          ← Retour
        </button>
        <button
          onClick={() => onNext({ enriched, skipDuplicates, skipInvalid, autoCreateClients })}
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
          Importer {stats.toImport} {isDocsType ? IMPORT_TYPES[importType].label.toLowerCase() : "client"}{stats.toImport > 1 ? "s" : ""} →
        </button>
      </div>
    </div>
  );
}

// ─── Tableau preview clients ────────────────────────────────────────────
function ClientsPreviewTable({ rows, schema, mapping, skipDuplicates, skipInvalid }) {
  const displayedColumns = schema.filter(s => Object.values(mapping).includes(s.key));
  return (
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
          {rows.slice(0, 200).map((r, i) => {
            const willSkip = (skipDuplicates && r._isDuplicate) || (skipInvalid && !r._validation.valid);
            const bg = willSkip ? C.bg : (i % 2 === 0 ? C.surface : C.bg);
            const errorFields = new Set((r._validation.errors || []).map(e => e.field));
            return (
              <tr key={r._index} style={{ background: bg, opacity: willSkip ? 0.55 : 1, borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: "6px 10px", verticalAlign: "top" }}>
                  {r._isDuplicate && (<span style={{ display: "inline-block", padding: "2px 6px", background: C.orangeBg, color: C.orange, borderRadius: 4, fontSize: 9, fontWeight: 700, marginRight: 4 }}>DOUBLON</span>)}
                  {!r._validation.valid && (<span title={r._validation.errors.map(e => e.msg).join(", ")} style={{ display: "inline-block", padding: "2px 6px", background: C.redBg, color: C.red, borderRadius: 4, fontSize: 9, fontWeight: 700 }}>INVALIDE</span>)}
                  {r._validation.valid && !r._isDuplicate && (<span style={{ color: C.green, fontSize: 14 }}>✓</span>)}
                </td>
                {displayedColumns.map(col => (
                  <td key={col.key} style={{ padding: "6px 10px", verticalAlign: "top", color: errorFields.has(col.key) ? C.red : C.text, background: errorFields.has(col.key) ? C.redBg : "transparent" }}>
                    {r[col.key] || <span style={{ color: C.textXs, fontStyle: "italic" }}>—</span>}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tableau preview devis/factures (groupés avec lignes étendues) ──────
function DocsPreviewTable({ docs, skipDuplicates, skipInvalid, importType, existingClients }) {
  const [expanded, setExpanded] = useState(null);
  function clientFound(nom) {
    return existingClients.some(c => (c.nom || "").trim().toLowerCase() === (nom || "").trim().toLowerCase());
  }
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "auto", maxHeight: 460, background: C.surface }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead style={{ position: "sticky", top: 0, background: C.bg, zIndex: 1 }}>
          <tr>
            <th style={th()}>Statut</th>
            <th style={th()}>N°</th>
            <th style={th()}>Date</th>
            <th style={th()}>Client</th>
            {importType === "factures" && <th style={th()}>Devis lié</th>}
            <th style={th()}>Lignes</th>
            <th style={{ ...th(), textAlign: "right" }}>Montant HT</th>
          </tr>
        </thead>
        <tbody>
          {docs.slice(0, 200).map((d, i) => {
            const willSkip = (skipDuplicates && d._isDuplicate) || (skipInvalid && !d._validation.valid);
            const bg = willSkip ? C.bg : (i % 2 === 0 ? C.surface : C.bg);
            const isExpanded = expanded === d._index;
            const cFound = clientFound(d.client_nom);
            return (
              <React.Fragment key={d._index}>
                <tr onClick={() => setExpanded(isExpanded ? null : d._index)} style={{ background: bg, opacity: willSkip ? 0.6 : 1, borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}>
                  <td style={{ padding: "8px 10px" }}>
                    {d._isDuplicate && <span style={badge(C.orangeBg, C.orange)}>DOUBLON</span>}
                    {!d._validation.valid && <span style={badge(C.redBg, C.red)} title={d._validation.errors.map(e => e.msg).join(", ")}>INVALIDE</span>}
                    {d._validation.valid && !d._isDuplicate && <span style={{ color: C.green, fontSize: 14 }}>✓</span>}
                  </td>
                  <td style={{ padding: "8px 10px", fontWeight: 700, fontFamily: "monospace" }}>
                    <span style={{ marginRight: 6, color: C.textXs }}>{isExpanded ? "▾" : "▸"}</span>
                    {d.numero}
                  </td>
                  <td style={{ padding: "8px 10px", color: C.textSm }}>{d.date}</td>
                  <td style={{ padding: "8px 10px" }}>
                    {d.client_nom}
                    {!cFound && <span style={{ ...badge(C.blueBg, C.blue), marginLeft: 6 }}>NOUVEAU</span>}
                  </td>
                  {importType === "factures" && (
                    <td style={{ padding: "8px 10px", color: C.textSm, fontFamily: "monospace" }}>{d.devis_numero || <span style={{ color: C.textXs }}>—</span>}</td>
                  )}
                  <td style={{ padding: "8px 10px", color: C.textSm }}>{d.lignes.length}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: C.navy, fontFamily: "monospace" }}>
                    {d.montant_ht_total.toFixed(2)} €
                  </td>
                </tr>
                {isExpanded && d.lignes.length > 0 && (
                  <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                    <td colSpan={importType === "factures" ? 7 : 6} style={{ padding: "8px 14px 12px 28px" }}>
                      <table style={{ width: "100%", fontSize: 10, borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            <th style={{ ...th(), background: "transparent", textAlign: "left", padding: "4px 8px" }}>Désignation</th>
                            <th style={{ ...th(), background: "transparent", textAlign: "right", padding: "4px 8px" }}>Qté</th>
                            <th style={{ ...th(), background: "transparent", padding: "4px 8px" }}>Unité</th>
                            <th style={{ ...th(), background: "transparent", textAlign: "right", padding: "4px 8px" }}>PU HT</th>
                            <th style={{ ...th(), background: "transparent", textAlign: "right", padding: "4px 8px" }}>TVA</th>
                            <th style={{ ...th(), background: "transparent", textAlign: "right", padding: "4px 8px" }}>Total HT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {d.lignes.map((l, j) => (
                            <tr key={j} style={{ borderTop: `1px solid ${C.border}` }}>
                              <td style={{ padding: "4px 8px" }}>{l.designation}</td>
                              <td style={{ padding: "4px 8px", textAlign: "right", fontFamily: "monospace" }}>{l.qte}</td>
                              <td style={{ padding: "4px 8px", color: C.textSm }}>{l.unite}</td>
                              <td style={{ padding: "4px 8px", textAlign: "right", fontFamily: "monospace" }}>{l.prix_unitaire_ht.toFixed(2)} €</td>
                              <td style={{ padding: "4px 8px", textAlign: "right", color: C.textSm }}>{l.tva}%</td>
                              <td style={{ padding: "4px 8px", textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>
                                {(l.qte * l.prix_unitaire_ht).toFixed(2)} €
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const th = () => ({
  padding: "8px 10px", textAlign: "left", fontWeight: 700, color: C.textSm,
  textTransform: "uppercase", fontSize: 9, borderBottom: `1px solid ${C.border}`,
  whiteSpace: "nowrap", background: C.bg,
});
const badge = (bg, fg) => ({
  display: "inline-block", padding: "2px 6px", background: bg, color: fg,
  borderRadius: 4, fontSize: 9, fontWeight: 700,
});
