// ═══════════════════════════════════════════════════════════════════════════
// CreateOuvrageInline — mini-modal pour ajouter rapidement un ouvrage à la biblio
// ═══════════════════════════════════════════════════════════════════════════
// Déclenché depuis BibliothequeAutocomplete (option "+ Ajouter à la biblio")
// quand l'utilisateur tape un libellé inexistant.
//
// Pré-remplit les valeurs depuis la ligne courante (libellé, unité, PU, TVA).
// L'utilisateur confirme corps_etat (select des packs métier) et marge_pct.
// onSave(ouvrage) → propage à App.jsx qui appelle addOuvrage du hook biblio.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import { PACKS_META, PACKS_ORDER } from "../../lib/bibliotheque-packs";

const C = {
  text: "#0F172A", textMd: "#334155", textSm: "#64748B", textXs: "#94A3B8",
  border: "#E2E8F0", borderMd: "#CBD5E1",
  surface: "#FFFFFF", bg: "#F8FAFC",
  navy: "#1B3A5C",
  accent: "#E8620A",
  green: "#059669", greenBg: "#ECFDF5",
};

export default function CreateOuvrageInline({
  open, onClose, onSave,
  defaultLibelle = "", defaultUnite = "U",
  defaultPrix = 0, defaultTva = 10,
  defaultCorps,
}) {
  const [libelle, setLibelle] = useState(defaultLibelle);
  const [corpsMetier, setCorpsMetier] = useState(defaultCorps || "maconnerie");
  const [unite, setUnite] = useState(defaultUnite);
  const [prix, setPrix] = useState(defaultPrix);
  const [tva, setTva] = useState(defaultTva);
  const [margePct, setMargePct] = useState(0);
  const [detail, setDetail] = useState("");

  // Reset quand props changent (réouverture)
  React.useEffect(() => {
    if (open) {
      setLibelle(defaultLibelle);
      setCorpsMetier(defaultCorps || "maconnerie");
      setUnite(defaultUnite);
      setPrix(defaultPrix);
      setTva(defaultTva);
      setMargePct(0);
      setDetail("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultLibelle]);

  if (!open) return null;

  function valid() {
    return libelle.trim().length >= 3 && +prix > 0;
  }
  function submit() {
    if (!valid()) return;
    // Construit un ouvrage compatible BIBLIOTHEQUE_BTP. On stocke le prix en
    // moMoy uniquement (c'est la part MO, on ne split pas fournitures côté
    // création rapide). fournMoy = 0 → le fourni-posé = moMoy.
    const code = `PERSO-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const ouvrage = {
      code,
      corps: PACKS_META[corpsMetier]?.label || "Maçonnerie",
      corps_metier: corpsMetier,
      libelle: libelle.trim(),
      unite,
      moMin: +prix * 0.85,
      moMoy: +prix,
      moMax: +prix * 1.15,
      fournMin: 0, fournMoy: 0, fournMax: 0,
      tempsMO: 0,
      detail: detail.trim() || `Ouvrage personnalisé créé depuis le devis le ${new Date().toLocaleDateString("fr-FR")}`,
      source: "ChantierPro (perso)",
      composants: [],
      affectations: [],
      _perso: true,
      _margePct: +margePct || 0,
    };
    onSave?.(ouvrage);
    onClose?.();
  }

  const inp = { width: "100%", padding: "8px 11px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.surface, boxSizing: "border-box" };
  const lbl = { display: "block", fontSize: 11, fontWeight: 600, color: C.textMd, marginBottom: 4 };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, borderRadius: 12, padding: 22, width: "100%", maxWidth: 520, boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 4 }}>➕ Ajouter à ma bibliothèque</div>
        <div style={{ fontSize: 11, color: C.textSm, marginBottom: 18 }}>
          Cet ouvrage sera disponible immédiatement pour les lignes suivantes et tes prochains devis.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={lbl}>Libellé</label>
            <input value={libelle} onChange={e => setLibelle(e.target.value)} placeholder="Ex: Carrelage 60×60 grès cérame" style={inp} autoFocus />
          </div>

          <div>
            <label style={lbl}>Corps de métier</label>
            <select value={corpsMetier} onChange={e => setCorpsMetier(e.target.value)} style={inp}>
              {PACKS_ORDER.map(p => (
                <option key={p} value={p}>{PACKS_META[p].icon} {PACKS_META[p].label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 100px", gap: 10 }}>
            <div>
              <label style={lbl}>Unité</label>
              <input value={unite} onChange={e => setUnite(e.target.value)} placeholder="m², U, ml…" style={{ ...inp, textAlign: "center" }} />
            </div>
            <div>
              <label style={lbl}>Prix unitaire HT</label>
              <input type="number" step="0.01" min={0} value={prix} onChange={e => setPrix(e.target.value)} style={{ ...inp, textAlign: "right", fontFamily: "monospace" }} />
            </div>
            <div>
              <label style={lbl}>TVA (%)</label>
              <select value={tva} onChange={e => setTva(+e.target.value)} style={inp}>
                <option value={20}>20%</option>
                <option value={10}>10%</option>
                <option value={5.5}>5,5%</option>
                <option value={0}>0%</option>
              </select>
            </div>
          </div>

          <div>
            <label style={lbl}>Marge spécifique (optionnel)</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="number" step="0.5" min={0} max={100} value={margePct} onChange={e => setMargePct(e.target.value)} style={{ ...inp, width: 100, textAlign: "right" }} />
              <span style={{ fontSize: 12, color: C.textSm }}>%</span>
              <span style={{ fontSize: 11, color: C.textXs, fontStyle: "italic" }}>0 = utilise la marge globale entreprise</span>
            </div>
          </div>

          <div>
            <label style={lbl}>Détail technique (optionnel)</label>
            <textarea value={detail} onChange={e => setDetail(e.target.value)} rows={2} placeholder="Description courte des prestations incluses…" style={{ ...inp, resize: "vertical", lineHeight: 1.4 }} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
          <button onClick={onClose} style={{ padding: "9px 16px", background: C.surface, border: `1px solid ${C.border}`, color: C.textMd, borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Annuler
          </button>
          <button onClick={submit} disabled={!valid()} style={{ padding: "9px 16px", background: valid() ? C.green : C.borderMd, color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: valid() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
            ✓ Ajouter à la biblio
          </button>
        </div>
      </div>
    </div>
  );
}
