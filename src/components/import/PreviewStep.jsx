// ═══════════════════════════════════════════════════════════════════════════
// Étape 3 — Aperçu mappé + détection doublons (multi-types)
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from "react";
import {
  getSchema, applyMapping,
  validateClientRow, validateDevisFactureRow, validateArticleRow, validateOuvrageRow,
  detectDuplicates, detectDuplicatesByNumero, detectArticleDuplicates, detectOuvrageDuplicates,
  buildDocsFromRows, resolveClient,
  IMPORT_TYPES,
} from "../../lib/importParser";
import { supabase } from "../../lib/supabase";

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
  fileType, facturx,
  existingClients = [], existingDocs = [],
  userId,
  onBack, onNext,
}) {
  // Branche PDF Factur-X : rendu dédié (pas de mapping, données structurées).
  if (fileType === "pdf" && facturx?.facture) {
    return (
      <PdfFacturXPreview
        facture={facturx.facture}
        profile={facturx.profile}
        sourceFilename={facturx.sourceFilename}
        existingClients={existingClients}
        existingDocs={existingDocs}
        onBack={onBack}
        onNext={onNext}
      />
    );
  }
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [skipInvalid, setSkipInvalid] = useState(true);
  const [autoCreateClients, setAutoCreateClients] = useState(true);
  // Articles : references déjà en DB côté utilisateur (pour dédup client-side).
  // Ouvrages : codes déjà en DB côté utilisateur (idem).
  // Set rempli au mount via SELECT, vide tant que la requête n'a pas répondu.
  const [existingArticleRefs, setExistingArticleRefs] = useState(new Set());
  const [existingOuvrageCodes, setExistingOuvrageCodes] = useState(new Set());
  const [loadingRefs, setLoadingRefs] = useState(false);

  useEffect(() => {
    if (importType !== "articles" || !userId || !supabase) return;
    let cancelled = false;
    setLoadingRefs(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("articles_catalogue")
          .select("reference")
          .eq("user_id", userId);
        if (cancelled) return;
        if (error) {
          console.warn("[PreviewStep] échec fetch existing refs:", error.message);
          setExistingArticleRefs(new Set());
        } else {
          const set = new Set();
          for (const r of (data || [])) {
            if (r.reference) set.add(String(r.reference).trim().toLowerCase());
          }
          setExistingArticleRefs(set);
        }
      } catch (e) {
        if (!cancelled) console.warn("[PreviewStep] fetch refs error:", e);
      } finally {
        if (!cancelled) setLoadingRefs(false);
      }
    })();
    return () => { cancelled = true; };
  }, [importType, userId]);

  // Fetch séparé pour ouvrages : SELECT code WHERE user_id = uid.
  // On ne fetch QUE les ouvrages persos pour la dédup (les ouvrages globaux
  // user_id IS NULL ne posent pas de problème de doublon : leur code peut
  // coexister avec un code utilisateur identique car la dédup est scopée).
  useEffect(() => {
    if (importType !== "ouvrages" || !userId || !supabase) return;
    let cancelled = false;
    setLoadingRefs(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("ouvrages_catalogue")
          .select("code")
          .eq("user_id", userId);
        if (cancelled) return;
        if (error) {
          console.warn("[PreviewStep] échec fetch existing codes:", error.message);
          setExistingOuvrageCodes(new Set());
        } else {
          const set = new Set();
          for (const r of (data || [])) {
            if (r.code) set.add(String(r.code).trim().toLowerCase());
          }
          setExistingOuvrageCodes(set);
        }
      } catch (e) {
        if (!cancelled) console.warn("[PreviewStep] fetch codes error:", e);
      } finally {
        if (!cancelled) setLoadingRefs(false);
      }
    })();
    return () => { cancelled = true; };
  }, [importType, userId]);

  const isDocsType = importType === "devis" || importType === "factures";
  const isArticlesType = importType === "articles";
  const isOuvragesType = importType === "ouvrages";
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
    if (importType === "articles") {
      // 1 ligne CSV = 1 article. Dédup par reference contre le Set chargé en DB.
      const withDup = detectArticleDuplicates(mapped, existingArticleRefs);
      return withDup.map((r, idx) => ({
        ...r, _index: idx, _validation: validateArticleRow(r),
      }));
    }
    if (importType === "ouvrages") {
      // 1 ligne CSV = 1 ouvrage. Dédup par code. Validation rejette les corps
      // / unités inconnus (skip à l'import, badge spécifique au preview).
      const withDup = detectOuvrageDuplicates(mapped, existingOuvrageCodes);
      return withDup.map((r, idx) => ({
        ...r, _index: idx, _validation: validateOuvrageRow(r),
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
  }, [rows, mapping, existingClients, existingDocs, importType, existingArticleRefs, existingOuvrageCodes]);

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
            : (isArticlesType || isOuvragesType) && loadingRefs
            ? "Chargement des références existantes…"
            : isArticlesType
            ? `${enriched.length} article${enriched.length > 1 ? "s" : ""} à importer · ${existingArticleRefs.size} référence${existingArticleRefs.size > 1 ? "s" : ""} déjà en base pour la dédup`
            : isOuvragesType
            ? `${enriched.length} ouvrage${enriched.length > 1 ? "s" : ""} à importer · ${existingOuvrageCodes.size} code${existingOuvrageCodes.size > 1 ? "s" : ""} déjà en base pour la dédup`
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
          Ignorer les doublons {isDocsType ? "(par numéro)" : isArticlesType ? "(par référence)" : isOuvragesType ? "(par code)" : "(nom + email)"}
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
          Importer {stats.toImport} {isDocsType ? IMPORT_TYPES[importType].label.toLowerCase() : isArticlesType ? "article" : isOuvragesType ? "ouvrage" : "client"}{stats.toImport > 1 ? "s" : ""} →
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
  // Pour factures : utilise resolveClient (statut + email tiebreaker). Pour
  // devis : simple bool "trouvé / pas trouvé" (rétrocompat avec l'ancien UI).
  function clientStatus(d) {
    if (importType === "factures") {
      return resolveClient(d.client_nom, d.client_email, existingClients).status;
    }
    return existingClients.some(c => (c.nom || "").trim().toLowerCase() === (d.client_nom || "").trim().toLowerCase())
      ? "resolved" : "not_found";
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
            const cStatus = clientStatus(d);
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
                    {cStatus === "not_found" && <span style={{ ...badge(C.blueBg, C.blue), marginLeft: 6 }} title="Aucun client existant ne porte ce nom — sera créé si la case 'Créer les clients manquants' est cochée.">NOUVEAU</span>}
                    {cStatus === "ambiguous" && <span style={{ ...badge(C.orangeBg, C.orange), marginLeft: 6 }} title="Plusieurs clients existent avec ce nom et aucun email pour trancher. Le 1ᵉʳ match sera utilisé — édite la facture après import si besoin.">AMBIGU</span>}
                    {d.client_email && <div style={{ fontSize: 9, color: C.textXs, fontFamily: "monospace", marginTop: 1 }}>{d.client_email}</div>}
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

// ─── Aperçu spécifique facture Factur-X extraite d'un PDF ──────────────────
// Affiche les données déjà structurées par parseCIIXml (numero, date, client,
// lignes, totaux, factureMeta). Détection doublon sur le numéro (BT-1) contre
// les factures existantes en base. Bouton "Importer" propage la facture seule
// à l'étape Import.
function PdfFacturXPreview({ facture, profile, sourceFilename, existingClients, existingDocs, onBack, onNext }) {
  // Dédup sur le numéro extrait du XML (BT-1).
  const existingNumeros = new Set(
    (existingDocs || [])
      .filter(d => (d.type === "facture") || (d.data?.type === "facture"))
      .map(d => (d.numero || d.data?.numero || "").trim().toLowerCase())
  );
  const isDoublon = existingNumeros.has((facture.numero || "").trim().toLowerCase());

  // Lookup client (silencieux — cohérence Commit 2bis)
  const clientNomNorm = (facture.client || "").trim().toLowerCase();
  const clientMatches = (existingClients || []).filter(c => (c.nom || "").trim().toLowerCase() === clientNomNorm);
  let clientStatus = "not_found";
  if (clientMatches.length === 1) clientStatus = "resolved";
  else if (clientMatches.length > 1) {
    const email = (facture.factureMeta?.clientEmail || "").trim().toLowerCase();
    clientStatus = email && clientMatches.some(c => (c.email || "").trim().toLowerCase() === email)
      ? "resolved" : "ambiguous";
  }

  const profileLabel = profile === "MINIMUM" || profile === "BASIC_WL" || facture.factureMeta?.isMinimalProfile
    ? `${profile || "MINIMAL"} (lignes non détaillées — récap par taux TVA)`
    : profile || "EN16931";

  const ttc = facture.totaux?.ttc || facture.lignes.reduce((a, l) => a + (l.qte * l.prixUnitHT) * (1 + (l.tva || 0) / 100), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>3. Aperçu Factur-X extrait</div>
        <div style={{ fontSize: 12, color: C.textSm, marginTop: 2 }}>
          📄 {sourceFilename || facture.factureMeta?.filename || "facture.pdf"} · profil <strong>{profileLabel}</strong>
        </div>
      </div>

      {/* Badge profil + dédup */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span style={{ padding: "6px 12px", background: C.greenBg, color: C.green, borderRadius: 6, fontSize: 12, fontWeight: 700, border: `1px solid ${C.green}55` }}>
          ✓ Factur-X conforme EN 16931
        </span>
        {facture.factureMeta?.isMinimalProfile && (
          <span style={{ padding: "6px 12px", background: C.orangeBg, color: C.orange, borderRadius: 6, fontSize: 11, fontWeight: 700, border: `1px solid ${C.orange}55` }}>
            ⚠ Profil minimal : lignes synthétiques par taux TVA
          </span>
        )}
        {isDoublon && (
          <span style={{ padding: "6px 12px", background: C.orangeBg, color: C.orange, borderRadius: 6, fontSize: 11, fontWeight: 700, border: `1px solid ${C.orange}55` }}>
            ↩ DOUBLON — facture {facture.numero} déjà en base
          </span>
        )}
      </div>

      {/* En-tête facture */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <Stat label="N° facture" value={facture.numero} mono />
        <Stat label="Date émission" value={facture.date} mono />
        <Stat label="Date échéance" value={facture.factureMeta?.dateEcheance || "—"} mono />
        <Stat label="Type" value={facture.typeFact === "avoir" ? "Avoir (384)" : "Facture (380)"} />
      </div>

      {/* Client */}
      <div style={{ padding: "12px 14px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.textSm, textTransform: "uppercase", marginBottom: 6 }}>Client (acheteur)</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{facture.client}</div>
            {facture.factureMeta?.clientEmail && (
              <div style={{ fontSize: 11, color: C.textSm, fontFamily: "monospace", marginTop: 2 }}>{facture.factureMeta.clientEmail}</div>
            )}
            {facture.factureMeta?.clientAddress?.line1 && (
              <div style={{ fontSize: 11, color: C.textMd, marginTop: 4 }}>
                {facture.factureMeta.clientAddress.line1}<br/>
                {facture.factureMeta.clientAddress.postalCode} {facture.factureMeta.clientAddress.city} · {facture.factureMeta.clientAddress.country}
              </div>
            )}
          </div>
          <div>
            {clientStatus === "resolved" && <span style={badge(C.greenBg, C.green)}>✓ TROUVÉ</span>}
            {clientStatus === "not_found" && <span style={badge(C.blueBg, C.blue)}>NOUVEAU — sera créé si toggle activé</span>}
            {clientStatus === "ambiguous" && <span style={badge(C.orangeBg, C.orange)}>AMBIGU — 1ᵉʳ match utilisé</span>}
          </div>
        </div>
      </div>

      {/* Lignes */}
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "auto", maxHeight: 360, background: C.surface }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead style={{ position: "sticky", top: 0, background: C.bg }}>
            <tr>
              <th style={{ ...th(), width: "55%" }}>Désignation</th>
              <th style={{ ...th(), textAlign: "right" }}>Qté</th>
              <th style={th()}>Unité</th>
              <th style={{ ...th(), textAlign: "right" }}>PU HT</th>
              <th style={{ ...th(), textAlign: "right" }}>TVA</th>
              <th style={{ ...th(), textAlign: "right" }}>Total HT</th>
            </tr>
          </thead>
          <tbody>
            {facture.lignes.map((l, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={{ padding: "8px 10px" }}>{l.libelle}</td>
                <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace" }}>{l.qte}</td>
                <td style={{ padding: "8px 10px", color: C.textSm }}>{l.unite}</td>
                <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace" }}>{(+l.prixUnitHT).toFixed(2)} €</td>
                <td style={{ padding: "8px 10px", textAlign: "right", color: C.textSm }}>{l.tva}%</td>
                <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{(l.qte * l.prixUnitHT).toFixed(2)} €</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totaux */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        <Stat label="Total HT" value={`${(facture.totaux?.ht || 0).toFixed(2)} €`} color={C.navy} mono />
        <Stat label="Total TVA" value={`${(facture.totaux?.tva || 0).toFixed(2)} €`} color={C.orange} mono />
        <Stat label="Total TTC" value={`${ttc.toFixed(2)} €`} color={C.green} mono />
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
        <button onClick={onBack} style={{ padding: "10px 18px", background: C.surface, border: `1px solid ${C.border}`, color: C.textMd, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          ← Retour
        </button>
        <button
          onClick={() => onNext({ enriched: [facture], skipDuplicates: true, skipInvalid: true, autoCreateClients: true })}
          disabled={isDoublon}
          style={{
            padding: "10px 18px",
            background: isDoublon ? C.borderMd : C.accent,
            color: "#fff", border: "none", borderRadius: 8,
            fontSize: 13, fontWeight: 700,
            cursor: isDoublon ? "not-allowed" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {isDoublon ? "Doublon — import bloqué" : "Importer cette facture →"}
        </button>
      </div>
    </div>
  );
}

// Mini stat-card réutilisable (en-tête PDF Factur-X preview)
function Stat({ label, value, color, mono }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ fontSize: 10, color: C.textSm, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: color || C.text, fontFamily: mono ? "monospace" : "inherit" }}>{value || "—"}</div>
    </div>
  );
}
