// ═══════════════════════════════════════════════════════════════════════════
// Étape 4 — Import bulk dans Supabase + récap
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from "react";
import { prepareForInsert } from "../../lib/importParser";
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
};

const BATCH_SIZE = 100;

export default function ImportStep({ enriched, skipDuplicates, skipInvalid, userId, onClose, onImported }) {
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(false);
  const [errMsg, setErrMsg] = useState(null);
  const [stats, setStats] = useState({ inserted: 0, ignoredDup: 0, ignoredInvalid: 0, errors: [] });
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    runImport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runImport() {
    if (!supabase) {
      setErrMsg("Supabase non configuré — import impossible");
      setDone(true);
      return;
    }
    if (!userId) {
      setErrMsg("Utilisateur non connecté");
      setDone(true);
      return;
    }
    try {
      const { rows, ignoredInvalid, ignoredDup } = prepareForInsert(enriched, {
        skipInvalid,
        skipDuplicates,
        userId,
      });
      setTotal(rows.length);
      if (rows.length === 0) {
        setStats(s => ({ ...s, ignoredDup, ignoredInvalid }));
        setDone(true);
        return;
      }

      let inserted = 0;
      const errors = [];
      // Insert batché pour ne pas saturer
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from("clients").insert(batch);
        if (error) {
          console.error("[ImportStep] batch error:", error);
          errors.push({ batch: i / BATCH_SIZE + 1, msg: error.message });
        } else {
          inserted += batch.length;
        }
        setProgress(i + batch.length);
      }
      setStats({ inserted, ignoredDup, ignoredInvalid, errors });
      setDone(true);
      // Remonte au parent les clients réellement insérés (best effort : si
      // un batch a échoué on ne sait pas exactement lesquels, on remonte tout
      // dans la limite de inserted).
      if (inserted > 0) onImported?.({ count: inserted, rows: rows.slice(0, inserted) });
    } catch (e) {
      console.error("[ImportStep]", e);
      setErrMsg(e.message || "Erreur inconnue");
      setDone(true);
    }
  }

  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;

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
            {progress} / {total} clients insérés
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              <Stat label="✓ Importés" value={stats.inserted} color={C.green} />
              <Stat label="↩ Doublons ignorés" value={stats.ignoredDup} color={C.textSm} />
              <Stat label="⚠ Invalides ignorées" value={stats.ignoredInvalid} color={C.textSm} />
            </div>
          )}
          {stats.errors && stats.errors.length > 0 && (
            <div style={{ marginTop: 14, padding: "10px 14px", background: C.redBg, borderRadius: 6, border: `1px solid ${C.red}33` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.red, marginBottom: 6 }}>
                ⚠ {stats.errors.length} erreur{stats.errors.length > 1 ? "s" : ""} batch
              </div>
              {stats.errors.slice(0, 3).map((e, i) => (
                <div key={i} style={{ fontSize: 10, color: C.red, marginBottom: 3 }}>
                  Batch {e.batch} : {e.msg}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {done && (
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 18px",
              background: C.accent,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
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
