// ═══════════════════════════════════════════════════════════════════════════
// BibliothequeAutocomplete — input libellé avec suggestions biblio
// ═══════════════════════════════════════════════════════════════════════════
// Réutilisé dans CreateurDevis (saisie ligne) et DevisRapideIAModal preview.
// Comportement :
//   - Tape 3+ caractères → dropdown avec ouvrages match (libellé/code/détail)
//   - Click suggestion → onPickOuvrage(o) (le parent applique le mapping)
//   - 0 match → option "+ Ajouter à la biblio" → onCreateRequest(libelle)
//   - Keyboard : ↑↓ navigation, Enter pick, Esc close
//   - Click outside → close
//
// Props :
//   value, onChange, placeholder, style, rows
//   onPickOuvrage(o)    : suggestion choisie (reçoit l'ouvrage complet)
//   onCreateRequest(s)  : déclenche modal de création biblio (reçoit le texte tapé)
//   prixClientFn(o)     : optional, retourne le prix client à afficher dans la suggestion
//   ouvrages            : optional override, sinon lit window.__BIBLIOTHEQUE_BTP__
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useMemo } from "react";

const C = {
  text: "#0F172A", textMd: "#334155", textSm: "#64748B", textXs: "#94A3B8",
  border: "#E2E8F0", borderMd: "#CBD5E1",
  surface: "#FFFFFF", bg: "#F8FAFC",
  navy: "#1B3A5C", navyBg: "#E8EEF5",
  accent: "#E8620A", accentBg: "#FFF3EA",
  green: "#059669",
};

function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export default function BibliothequeAutocomplete({
  value, onChange,
  placeholder, style, rows = 1,
  onPickOuvrage, onCreateRequest,
  prixClientFn, ouvrages,
}) {
  const list = useMemo(() => ouvrages || (typeof window !== "undefined" ? (window.__BIBLIOTHEQUE_BTP__ || []) : []), [ouvrages]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);
  const taRef = useRef(null);

  const q = norm((value || "").trim());
  const suggestions = useMemo(() => {
    if (q.length < 3) return [];
    return list.filter(o =>
      norm(o.libelle).includes(q) || norm(o.code).includes(q) || norm(o.detail || "").includes(q)
    ).slice(0, 8);
  }, [q, list]);

  // Click outside → close
  useEffect(() => {
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Reset highlight quand suggestions changent
  useEffect(() => { setHighlight(0); }, [suggestions.length, q]);

  // Auto-resize basique du textarea
  useEffect(() => {
    if (!taRef.current) return;
    taRef.current.style.height = "auto";
    taRef.current.style.height = Math.min(taRef.current.scrollHeight, 80) + "px";
  }, [value]);

  function handleChange(e) {
    onChange?.(e);
    setOpen(true);
  }
  function handleFocus() {
    if (q.length >= 3) setOpen(true);
  }
  function handleKey(e) {
    if (!open) {
      if (e.key === "ArrowDown" && q.length >= 3) { setOpen(true); e.preventDefault(); }
      return;
    }
    if (e.key === "Escape") { setOpen(false); e.preventDefault(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight(i => Math.min(i + 1, Math.max(0, suggestions.length - 1))); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setHighlight(i => Math.max(i - 1, 0)); return; }
    if (e.key === "Enter" && !e.shiftKey) {
      if (suggestions[highlight]) {
        e.preventDefault();
        pick(suggestions[highlight]);
      }
    }
  }
  function pick(o) {
    onPickOuvrage?.(o);
    setOpen(false);
  }
  function requestCreate() {
    onCreateRequest?.(value);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <textarea
        ref={taRef}
        value={value || ""}
        onChange={handleChange}
        onFocus={handleFocus}
        onKeyDown={handleKey}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: "100%",
          padding: "5px 9px",
          border: `1px solid ${C.border}`,
          borderRadius: 6,
          fontSize: 12,
          outline: "none",
          fontFamily: "inherit",
          resize: "none",
          minHeight: 32,
          lineHeight: 1.4,
          ...style,
        }}
      />
      {open && q.length >= 3 && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          marginTop: 2,
          background: C.surface,
          border: `1px solid ${C.borderMd}`,
          borderRadius: 6,
          boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
          zIndex: 200,
          maxHeight: 320,
          overflowY: "auto",
          minWidth: 320,
        }}>
          {suggestions.length === 0 ? (
            <div>
              <div style={{ padding: "10px 12px", fontSize: 11, color: C.textSm, fontStyle: "italic" }}>
                Aucun ouvrage trouvé pour « {value.slice(0, 40)}{value.length > 40 ? "…" : ""} »
              </div>
              {onCreateRequest && (
                <button onClick={requestCreate} style={{
                  width: "100%", padding: "10px 12px", textAlign: "left",
                  background: C.accentBg, border: "none", borderTop: `1px solid ${C.border}`,
                  cursor: "pointer", fontFamily: "inherit",
                  fontSize: 12, fontWeight: 700, color: C.accent,
                }}>
                  ➕ Ajouter cet ouvrage à ma bibliothèque
                </button>
              )}
            </div>
          ) : (
            <>
              {suggestions.map((o, i) => {
                const prixC = prixClientFn ? prixClientFn(o) : null;
                const isHi = i === highlight;
                return (
                  <div key={o.code}
                    onClick={() => pick(o)}
                    onMouseEnter={() => setHighlight(i)}
                    style={{
                      padding: "8px 10px",
                      cursor: "pointer",
                      background: isHi ? C.bg : "transparent",
                      borderBottom: i < suggestions.length - 1 ? `1px solid ${C.border}` : "none",
                      fontSize: 11, lineHeight: 1.4,
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ background: C.navyBg, color: C.navy, borderRadius: 3, padding: "1px 5px", fontSize: 9, fontWeight: 700, fontFamily: "monospace", flexShrink: 0 }}>{o.code}</span>
                      <span style={{ flex: 1, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                        {o.libelle}
                      </span>
                      {prixC != null && (
                        <span style={{ color: C.green, fontWeight: 700, fontFamily: "monospace", whiteSpace: "nowrap", fontSize: 11 }}>
                          {prixC}€/{o.unite}
                        </span>
                      )}
                    </div>
                    {o.detail && (
                      <div style={{ fontSize: 10, color: C.textXs, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {o.detail}
                      </div>
                    )}
                  </div>
                );
              })}
              {onCreateRequest && (
                <button onClick={requestCreate} style={{
                  width: "100%", padding: "8px 10px", textAlign: "left",
                  background: "transparent", border: "none", borderTop: `1px solid ${C.border}`,
                  cursor: "pointer", fontFamily: "inherit",
                  fontSize: 11, fontWeight: 600, color: C.accent,
                }}>
                  ➕ Pas dans la liste ? Ajouter cet ouvrage à ma biblio
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
