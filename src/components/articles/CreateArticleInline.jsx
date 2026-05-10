// ═══════════════════════════════════════════════════════════════════════════
// CreateArticleInline — mini-modal pour ajouter rapidement un article perso
// ═══════════════════════════════════════════════════════════════════════════
// Déclenché depuis Estimation IA / CreateurDevis quand l'utilisateur tape un
// libellé fourniture inexistant dans le catalogue. Pré-remplit avec ce qui est
// déjà saisi (libellé, unité, prix achat, fournisseur).
//
// onSave({...payload}) → l'appelant doit appeler addArticle du hook puis
// récupérer l'article créé pour ré-attacher _articleId à la ligne fourniture.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";

const C = {
  text: "#0F172A", textMd: "#334155", textSm: "#64748B",
  border: "#E2E8F0", surface: "#FFFFFF",
  navy: "#1B3A5C", accent: "#E8620A",
  green: "#059669", greenBg: "#ECFDF5",
  red: "#DC2626",
};

const CATEGORIES = ["Plomberie", "Sanitaire", "Électricité", "Carrelage", "Peinture", "Plâtrerie", "Isolation", "Menuiserie", "Couverture", "Maçonnerie", "Étanchéité", "Outillage", "Divers"];
const FOURNISSEURS = ["Point P", "Gedimat", "Brico Dépôt", "Leroy Merlin", "Castorama", "Kiloutou", "Autre"];
const UNITES = ["U", "ml", "m2", "m3", "kg", "sac", "plaque", "boîte", "lot", "paire", "jeu", "rouleau", "coffret", "carton", "palette"];

export default function CreateArticleInline({ open, onClose, onSave, defaults = {} }) {
  const [f, setF] = useState({
    libelle: defaults.libelle || "",
    categorie: defaults.categorie || "Divers",
    unite: defaults.unite || "U",
    prix_achat_ht: defaults.prix_achat_ht ?? 0,
    fournisseur_default: defaults.fournisseur_default || "Point P",
    tva_pct: 20,
  });

  // Reset à chaque ouverture
  React.useEffect(() => {
    if (open) {
      setF({
        libelle: defaults.libelle || "",
        categorie: defaults.categorie || "Divers",
        unite: defaults.unite || "U",
        prix_achat_ht: defaults.prix_achat_ht ?? 0,
        fournisseur_default: defaults.fournisseur_default || "Point P",
        tva_pct: 20,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaults.libelle]);

  if (!open) return null;

  const valid = f.libelle.trim().length >= 2 && +f.prix_achat_ht > 0;

  function submit() {
    if (!valid) return;
    onSave({
      libelle: f.libelle.trim(),
      categorie: f.categorie,
      unite: f.unite,
      prix_achat_ht: +f.prix_achat_ht,
      fournisseur_default: f.fournisseur_default,
      tva_pct: +f.tva_pct,
    });
  }

  const inp = { width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
  const lbl = { display: "block", fontSize: 11, fontWeight: 600, color: C.textMd, marginBottom: 4 };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, paddingTop: "calc(var(--safe-top, 0px) + 16px)", paddingBottom: "calc(var(--safe-bottom, 0px) + 16px)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.surface, borderRadius: 12, padding: 22, width: "100%", maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 4 }}>📦 Ajouter au catalogue</div>
        <div style={{ fontSize: 11, color: C.textSm, marginBottom: 16 }}>
          L'article sera ajouté à <strong>tes articles personnels</strong> et disponible pour les prochaines lignes.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <div>
            <label style={lbl}>Libellé</label>
            <input value={f.libelle} onChange={(e) => setF((p) => ({ ...p, libelle: e.target.value }))} placeholder="Ex: Receveur douche 120/80 résine" style={inp} autoFocus />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={lbl}>Catégorie</label>
              <select value={f.categorie} onChange={(e) => setF((p) => ({ ...p, categorie: e.target.value }))} style={inp}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Unité</label>
              <select value={f.unite} onChange={(e) => setF((p) => ({ ...p, unite: e.target.value }))} style={inp}>
                {UNITES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={lbl}>Prix achat HT (€)</label>
              <input type="number" step="0.01" min="0" value={f.prix_achat_ht} onChange={(e) => setF((p) => ({ ...p, prix_achat_ht: e.target.value }))} style={{ ...inp, textAlign: "right", fontFamily: "monospace" }} />
            </div>
            <div>
              <label style={lbl}>Fournisseur</label>
              <select value={f.fournisseur_default} onChange={(e) => setF((p) => ({ ...p, fournisseur_default: e.target.value }))} style={inp}>
                {FOURNISSEURS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
          <button onClick={onClose} style={{ padding: "9px 16px", background: C.surface, border: `1px solid ${C.border}`, color: C.textMd, borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Annuler
          </button>
          <button onClick={submit} disabled={!valid} style={{ padding: "9px 16px", background: valid ? C.green : "#9CA3AF", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: valid ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
            ✓ Ajouter au catalogue
          </button>
        </div>
      </div>
    </div>
  );
}
