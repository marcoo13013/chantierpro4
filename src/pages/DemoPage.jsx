// ═══════════════════════════════════════════════════════════════════════════
// /demo — page publique d'inscription prospect
// ═══════════════════════════════════════════════════════════════════════════
// Aucun login requis. Form → POST /api/prospect-submit.
// Affichée pour la route /demo ou /inscription via main.jsx.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";

const C = {
  text: "#0F172A", textMd: "#334155", textSm: "#64748B", textXs: "#94A3B8",
  border: "#E2E8F0", borderMd: "#CBD5E1",
  surface: "#FFFFFF", bg: "#F8FAFC",
  navy: "#1B3A5C", navyBg: "#E8EEF5",
  accent: "#E8620A", accentBg: "#FFF3EA",
  green: "#059669", greenBg: "#ECFDF5",
  red: "#DC2626", redBg: "#FEF2F2",
};

const LOGICIELS = ["Mediabat", "Batappli", "EBP", "Obat", "Excel", "Aucun pour l'instant", "Autre"];
const VOLUMES = ["Moins de 50 clients", "Entre 50 et 200 clients", "Plus de 200 clients"];

export default function DemoPage() {
  const [form, setForm] = useState({
    nom_entreprise: "",
    email: "",
    telephone: "",
    logiciel_actuel: "",
    volume_clients: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  function upd(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e?.preventDefault();
    setError(null);
    if (!form.nom_entreprise.trim()) return setError("Nom de l'entreprise requis");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError("Email valide requis");
    setSubmitting(true);
    try {
      const r = await fetch("/api/prospect-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setDone(true);
    } catch (err) {
      setError(err.message || "Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div style={pageBg()}>
        <div style={card()}>
          <div style={{ fontSize: 56, marginBottom: 16, textAlign: "center" }}>✅</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.green, textAlign: "center", margin: "0 0 12px" }}>
            Demande bien reçue !
          </h1>
          <p style={{ fontSize: 14, color: C.textMd, lineHeight: 1.6, textAlign: "center", margin: "0 0 24px" }}>
            <strong>Marco te recontacte sous 24h</strong> pour planifier ta démo personnalisée.
            <br />En attendant, tu peux jeter un œil à la roadmap et aux dernières nouveautés.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <a href="/" style={btnSecondary()}>← Accueil</a>
            <a href="/support" style={btnPrimary()}>Voir la roadmap →</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageBg()}>
      <div style={card()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <span style={{ fontSize: 32 }}>🏗</span>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy, margin: 0 }}>ChantierPro</h1>
            <div style={{ fontSize: 11, color: C.textSm }}>Logiciel de gestion BTP</div>
          </div>
        </div>

        <h2 style={{ fontSize: 28, fontWeight: 800, color: C.text, margin: "0 0 8px", lineHeight: 1.2 }}>
          Demander une démo
        </h2>
        <p style={{ fontSize: 14, color: C.textMd, margin: "0 0 24px", lineHeight: 1.5 }}>
          Découvre ChantierPro adapté à ton entreprise. <strong>Marco te recontacte sous 24h</strong> pour
          répondre à tes questions et te montrer comment migrer depuis ton logiciel actuel.
        </p>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Nom de l'entreprise" required>
            <input type="text" required value={form.nom_entreprise} onChange={e => upd("nom_entreprise", e.target.value)} placeholder="SARL Bâtiment Sud" style={inp()}/>
          </Field>

          <Field label="Email professionnel" required>
            <input type="email" required value={form.email} onChange={e => upd("email", e.target.value)} placeholder="contact@entreprise.fr" style={inp()}/>
          </Field>

          <Field label="Téléphone" hint="optionnel">
            <input type="tel" value={form.telephone} onChange={e => upd("telephone", e.target.value)} placeholder="06 12 34 56 78" style={inp()}/>
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Logiciel actuel" hint="optionnel">
              <select value={form.logiciel_actuel} onChange={e => upd("logiciel_actuel", e.target.value)} style={inp()}>
                <option value="">— Choisir —</option>
                {LOGICIELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
            <Field label="Volume clients" hint="optionnel">
              <select value={form.volume_clients} onChange={e => upd("volume_clients", e.target.value)} style={inp()}>
                <option value="">— Choisir —</option>
                {VOLUMES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
          </div>

          {error && (
            <div style={{ padding: "10px 14px", background: C.redBg, border: `1px solid ${C.red}33`, borderRadius: 8, fontSize: 12, color: C.red, fontWeight: 600 }}>
              ❌ {error}
            </div>
          )}

          <button type="submit" disabled={submitting} style={btnPrimary({ wide: true, disabled: submitting })}>
            {submitting ? "⏳ Envoi en cours..." : "🚀 Demander une démo"}
          </button>
        </form>

        <div style={{ marginTop: 28, padding: "14px 18px", background: C.bg, borderRadius: 10, fontSize: 12, color: C.textSm, lineHeight: 1.6 }}>
          <strong style={{ color: C.text }}>Ce que tu obtiens :</strong>
          <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
            <li>Démo personnalisée 30 min en visio</li>
            <li>Migration accompagnée depuis ton logiciel actuel</li>
            <li>Import de tes clients/devis existants</li>
            <li>Réponse à toutes tes questions techniques</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, required, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.textMd, marginBottom: 6 }}>
        {label}
        {required && <span style={{ color: C.red, marginLeft: 4 }}>*</span>}
        {hint && <span style={{ marginLeft: 6, fontWeight: 400, color: C.textXs, fontSize: 11 }}>({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function pageBg() {
  return {
    minHeight: "100vh",
    background: `linear-gradient(135deg, ${C.navy} 0%, ${C.accent} 100%)`,
    padding: "32px 16px",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  };
}
function card() {
  return {
    background: C.surface,
    borderRadius: 16,
    padding: "32px 36px",
    width: "100%",
    maxWidth: 540,
    boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
  };
}
function inp() {
  return {
    width: "100%",
    padding: "11px 14px",
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    background: C.surface,
    color: C.text,
    boxSizing: "border-box",
  };
}
function btnPrimary({ wide = false, disabled = false } = {}) {
  return {
    padding: "12px 20px",
    background: disabled ? C.borderMd : C.accent,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
    cursor: disabled ? "wait" : "pointer",
    fontFamily: "inherit",
    width: wide ? "100%" : "auto",
    textDecoration: "none",
    display: "inline-block",
    textAlign: "center",
  };
}
function btnSecondary() {
  return {
    padding: "12px 20px",
    background: C.surface,
    color: C.textMd,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    textDecoration: "none",
    display: "inline-block",
  };
}
