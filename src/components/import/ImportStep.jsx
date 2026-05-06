// ═══════════════════════════════════════════════════════════════════════════
// Étape 4 — Import bulk dans Supabase + récap (multi-types)
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from "react";
import { prepareClientsForInsert, prepareDocsForInsert, IMPORT_TYPES } from "../../lib/importParser";
import { supabase } from "../../lib/supabase";

const C = {
  text: "#0F172A", textMd: "#334155", textSm: "#64748B", textXs: "#94A3B8",
  border: "#E2E8F0", borderMd: "#CBD5E1",
  surface: "#FFFFFF", bg: "#F8FAFC",
  navy: "#1B3A5C",
  blue: "#2563EB",
  accent: "#E8620A",
  green: "#059669", greenBg: "#ECFDF5",
  red: "#DC2626", redBg: "#FEF2F2",
};

const BATCH_SIZE = 100;

export default function ImportStep({
  enriched, skipDuplicates, skipInvalid, autoCreateClients,
  importType = "clients",
  userId, existingClients = [], existingDocs = [],
  onClose, onImported,
}) {
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(false);
  const [errMsg, setErrMsg] = useState(null);
  const [stats, setStats] = useState({
    inserted: 0, ignoredDup: 0, ignoredInvalid: 0,
    newClientsInserted: 0, warningsClient: 0, warningsDevisLink: 0,
    errors: [],
  });
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    runImport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runImport() {
    if (!supabase) { setErrMsg("Supabase non configuré"); setDone(true); return; }
    if (!userId) { setErrMsg("Utilisateur non connecté"); setDone(true); return; }
    try {
      if (importType === "clients") {
        await runImportClients();
      } else {
        await runImportDocs();
      }
      setDone(true);
    } catch (e) {
      console.error("[ImportStep]", e);
      setErrMsg(e.message || "Erreur inconnue");
      setDone(true);
    }
  }

  async function runImportClients() {
    const { rows, ignoredInvalid, ignoredDup } = prepareClientsForInsert(enriched, {
      skipInvalid, skipDuplicates, userId,
    });
    setTotal(rows.length);
    if (rows.length === 0) {
      setStats(s => ({ ...s, ignoredDup, ignoredInvalid }));
      return;
    }
    let inserted = 0;
    const errors = [];
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("clients").insert(batch);
      if (error) errors.push({ batch: i / BATCH_SIZE + 1, msg: error.message });
      else inserted += batch.length;
      setProgress(i + batch.length);
    }
    setStats({ inserted, ignoredDup, ignoredInvalid, newClientsInserted: 0, warningsClient: 0, warningsDevisLink: 0, errors });
    if (inserted > 0) onImported?.({ type: "clients", count: inserted, rows: rows.slice(0, inserted) });
  }

  async function runImportDocs() {
    const { rows, newClients, ignoredDup, ignoredInvalid, warningsClient, warningsDevisLink } = prepareDocsForInsert(enriched, {
      type: importType,
      userId, existingClients, existingDocs,
      autoCreateClients, skipDuplicates, skipInvalid,
    });
    setTotal(rows.length);
    let newClientsInserted = 0;
    // 1. Insère les nouveaux clients d'abord (pour respecter l'ordre logique)
    if (autoCreateClients && newClients.length > 0) {
      for (let i = 0; i < newClients.length; i += BATCH_SIZE) {
        const batch = newClients.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from("clients").insert(batch);
        if (!error) newClientsInserted += batch.length;
        else console.warn("[ImportStep] new clients batch error:", error);
      }
    }
    if (rows.length === 0) {
      setStats({ inserted: 0, ignoredDup, ignoredInvalid, newClientsInserted, warningsClient, warningsDevisLink, errors: [] });
      if (newClientsInserted > 0) onImported?.({ type: "clients-side", count: newClientsInserted, rows: newClients });
      return;
    }
    // 2. Insert documents (table devis avec data jsonb)
    let inserted = 0;
    const errors = [];
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("devis").insert(batch);
      if (error) errors.push({ batch: i / BATCH_SIZE + 1, msg: error.message });
      else inserted += batch.length;
      setProgress(i + batch.length);
    }
    setStats({ inserted, ignoredDup, ignoredInvalid, newClientsInserted, warningsClient, warningsDevisLink, errors });
    // Remonte 2 callbacks : 1 pour les docs, 1 pour les nouveaux clients (pour
    // que le parent puisse mettre à jour state local sans refetch)
    if (newClientsInserted > 0) onImported?.({ type: "clients-side", count: newClientsInserted, rows: newClients });
    if (inserted > 0) onImported?.({ type: importType, count: inserted, rows: rows.slice(0, inserted).map(r => r.data) });
  }

  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;
  const typeLabel = IMPORT_TYPES[importType]?.label?.toLowerCase() || "élément";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>4. Import en cours…</div>
        <div style={{ fontSize: 12, color: C.textSm, marginTop: 2 }}>
          Insertion bulk dans Supabase, par lots de {BATCH_SIZE}
        </div>
      </div>

      {!done && (
        <div style={{ padding: 24, textAlign: "center", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>⏳</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>
            {progress} / {total} {typeLabel}{total > 1 ? "s" : ""} insérés
          </div>
          <div style={{ height: 12, background: C.bg, borderRadius: 6, overflow: "hidden", border: `1px solid ${C.border}` }}>
            <div style={{ width: `${pct}%`, height: "100%", background: C.accent, transition: "width 0.2s" }} />
          </div>
          <div style={{ fontSize: 11, color: C.textSm, marginTop: 8 }}>{pct}%</div>
        </div>
      )}

      {done && (
        <div style={{ padding: 24, background: errMsg ? C.redBg : C.greenBg, border: `1px solid ${errMsg ? C.red : C.green}33`, borderRadius: 8 }}>
          <div style={{ fontSize: 36, marginBottom: 10, textAlign: "center" }}>{errMsg ? "❌" : "✅"}</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: errMsg ? C.red : C.green, marginBottom: 14, textAlign: "center" }}>
            {errMsg ? "Erreur d'import" : "Import terminé"}
          </div>
          {errMsg ? (
            <div style={{ fontSize: 12, color: C.red, textAlign: "center" }}>{errMsg}</div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
                <Stat label={`✓ ${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)}s`} value={stats.inserted} color={C.green} />
                {stats.newClientsInserted > 0 && (
                  <Stat label="+ Clients créés" value={stats.newClientsInserted} color={C.blue} />
                )}
                <Stat label="↩ Doublons ignorés" value={stats.ignoredDup} color={C.textSm} />
                <Stat label="⚠ Invalides ignorées" value={stats.ignoredInvalid} color={C.textSm} />
              </div>
              {(stats.warningsClient > 0 || stats.warningsDevisLink > 0) && (
                <div style={{ marginTop: 14, padding: "10px 14px", background: C.surface, borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 11, color: C.textMd }}>
                  {stats.warningsClient > 0 && <div>⚠ {stats.warningsClient} client{stats.warningsClient > 1 ? "s" : ""} non trouvé{stats.warningsClient > 1 ? "s" : ""} (création auto désactivée).</div>}
                  {stats.warningsDevisLink > 0 && <div>⚠ {stats.warningsDevisLink} référence{stats.warningsDevisLink > 1 ? "s" : ""} de devis non trouvée{stats.warningsDevisLink > 1 ? "s" : ""}.</div>}
                </div>
              )}
            </>
          )}
          {stats.errors && stats.errors.length > 0 && (
            <div style={{ marginTop: 14, padding: "10px 14px", background: C.redBg, borderRadius: 6, border: `1px solid ${C.red}33` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.red, marginBottom: 6 }}>⚠ {stats.errors.length} erreur{stats.errors.length > 1 ? "s" : ""} batch</div>
              {stats.errors.slice(0, 3).map((e, i) => (
                <div key={i} style={{ fontSize: 10, color: C.red, marginBottom: 3 }}>Batch {e.batch} : {e.msg}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {done && (
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 18px", background: C.accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            ✓ Fermer
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 14px", textAlign: "center" }}>
      <div style={{ fontSize: 24, fontWeight: 800, color, fontFamily: "monospace" }}>{value}</div>
      <div style={{ fontSize: 10, color: C.textSm, fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  );
}
