// ═══════════════════════════════════════════════════════════════════════════
// ArticleAutocomplete — input avec dropdown suggestions du catalogue articles
// ═══════════════════════════════════════════════════════════════════════════
// Composant léger réutilisable. À utiliser partout où l'utilisateur tape une
// désignation de fourniture (CreateurDevis composants, formulaire courses
// chantier, modale CreateOuvrageInline, etc).
//
// Props :
//   - value : string actuel (controlled)
//   - onChange(string) : appelé quand l'utilisateur tape sans choisir
//   - onSelect(article) : appelé quand un article est choisi dans la liste
//                         → l'appelant peut pré-remplir libellé, prix, unité,
//                           fournisseur, TVA, conditionnement.
//   - articles : tableau d'articles du catalogue (passé par useArticlesCatalogue)
//   - placeholder, style, disabled
//
// Usage typique :
//   const { articles } = useArticlesCatalogue(authUser?.id);
//   <ArticleAutocomplete
//     articles={articles}
//     value={f.designation}
//     onChange={v=>up("designation", v)}
//     onSelect={a=>up({designation:a.libelle, unite:a.unite,
//                      prixAchat:a.prix_achat_ht, fournisseur:a.fournisseur_default})}
//   />
// ═══════════════════════════════════════════════════════════════════════════

import React, { useMemo, useRef, useState } from "react";
import { searchArticles } from "../../hooks/useArticlesCatalogue";

const C = {
  border: "#E2E8F0", surface: "#FFFFFF",
  navy: "#1B3A5C", navyBg: "#EEF3F8",
  accent: "#E8620A", text: "#0F172A", textSm: "#64748B",
};

export default function ArticleAutocomplete({
  articles = [],
  value = "",
  onChange,
  onSelect,
  placeholder = "Désignation fourniture…",
  style,
  disabled,
  inputStyle,
  minChars = 2,
  maxResults = 8,
}) {
  const [focused, setFocused] = useState(false);
  const [hoverIdx, setHoverIdx] = useState(-1);
  const blurTimer = useRef(null);

  const suggestions = useMemo(() => {
    if (!focused || (value || "").trim().length < minChars) return [];
    return searchArticles(articles, value, maxResults);
  }, [articles, value, focused, minChars, maxResults]);

  const showDropdown = focused && suggestions.length > 0;

  function handleSelect(article) {
    onSelect?.(article);
    setFocused(false);
  }

  function handleKey(e) {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHoverIdx((i) => Math.min(suggestions.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHoverIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && hoverIdx >= 0) {
      e.preventDefault();
      handleSelect(suggestions[hoverIdx]);
    } else if (e.key === "Escape") {
      setFocused(false);
    }
  }

  return (
    <div style={{ position: "relative", ...style }}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={() => { clearTimeout(blurTimer.current); setFocused(true); setHoverIdx(-1); }}
        onBlur={() => { blurTimer.current = setTimeout(() => setFocused(false), 150); }}
        onKeyDown={handleKey}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: "100%",
          padding: "8px 11px",
          border: `1px solid ${C.border}`,
          borderRadius: 6,
          fontSize: 13,
          fontFamily: "inherit",
          outline: "none",
          background: C.surface,
          boxSizing: "border-box",
          ...inputStyle,
        }}
      />
      {showDropdown && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 2px)",
            left: 0,
            right: 0,
            background: "#fff",
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 50,
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          {suggestions.map((a, i) => (
            <button
              key={a.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(a); }}
              onMouseEnter={() => setHoverIdx(i)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "8px 11px",
                background: i === hoverIdx ? C.navyBg : "transparent",
                border: "none",
                borderBottom: i === suggestions.length - 1 ? "none" : `1px solid ${C.border}`,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 12,
                display: "block",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                <div style={{ fontWeight: 600, color: C.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                  {a.libelle}
                </div>
                <div style={{ fontWeight: 700, color: C.accent, fontFamily: "monospace", whiteSpace: "nowrap" }}>
                  {Number(a.prix_achat_ht).toFixed(2)} € / {a.unite}
                </div>
              </div>
              <div style={{ fontSize: 10, color: C.textSm, marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span>{a.categorie}{a.sous_categorie ? " · " + a.sous_categorie : ""}</span>
                {a.fournisseur_default && <span>· {a.fournisseur_default}</span>}
                {a.user_id && <span style={{ color: C.accent, fontWeight: 700 }}>· perso</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
