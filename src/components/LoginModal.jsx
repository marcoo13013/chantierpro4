// ═══════════════════════════════════════════════════════════════════════════
// LoginModal - Modal de connexion Supabase pour ChantierPro V14
// ═══════════════════════════════════════════════════════════════════════════
// Affiché en overlay au-dessus de l'app quand l'utilisateur clique "Se connecter"
// dans la sidebar. Utilise les memes couleurs que le design system V13 (L.*)
//
// Usage dans App.jsx :
//   import LoginModal from "./components/LoginModal";
//   const [showLogin, setShowLogin] = useState(false);
//   {showLogin && <LoginModal onClose={()=>setShowLogin(false)} onLogin={(user)=>...} />}
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import { supabase } from "../lib/supabase";

// Palette light identique a V13 (objet L)
const C = {
  bg: "#FAFBFC",
  surface: "#FFFFFF",
  border: "#E5E7EB",
  text: "#0F172A",
  textMd: "#334155",
  textSm: "#64748B",
  textXs: "#94A3B8",
  navy: "#1E40AF",
  navyBg: "#EFF6FF",
  blue: "#2563EB",
  green: "#059669",
  greenBg: "#ECFDF5",
  red: "#DC2626",
  redBg: "#FEF2F2",
  orange: "#E8620A",
};

export default function LoginModal({ onClose, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showRequest, setShowRequest] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!supabase) {
      setError("Connexion Supabase non configuree. Variables d'environnement manquantes.");
      return;
    }

    if (!email || !password) {
      setError("Email et mot de passe requis.");
      return;
    }

    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        // Messages d'erreur en francais
        if (authError.message.includes("Invalid login credentials")) {
          setError("Identifiants incorrects, ou compte non invite. L'acces a ChantierPro se fait sur invitation uniquement — contactez francehabitat.immo@gmail.com.");
        } else if (authError.message.includes("Email not confirmed")) {
          setError("Email non confirme. Verifiez votre boite mail (lien d'invitation Supabase).");
        } else if (authError.message.toLowerCase().includes("signup")) {
          setError("Inscriptions desactivees. Acces sur invitation uniquement — contactez francehabitat.immo@gmail.com.");
        } else {
          setError(authError.message);
        }
        setLoading(false);
        return;
      }

      // Succes
      if (onLogin) onLogin(data.user);
      if (onClose) onClose();
    } catch (err) {
      setError("Erreur de connexion : " + (err.message || err));
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(15, 23, 42, 0.55)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.surface,
          borderRadius: 14,
          padding: 32,
          maxWidth: 420,
          width: "100%",
          boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
          border: `1px solid ${C.border}`,
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔐</div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text }}>
            Connexion ChantierPro
          </h2>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: C.textSm }}>
            Connecte-toi pour synchroniser tes devis et chantiers
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: C.textMd,
                marginBottom: 6,
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="francehabitat.immo@gmail.com"
              autoComplete="email"
              autoFocus
              disabled={loading}
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 14,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                background: C.surface,
                color: C.text,
                fontFamily: "inherit",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 18 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: C.textMd,
                marginBottom: 6,
              }}
            >
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={loading}
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 14,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                background: C.surface,
                color: C.text,
                fontFamily: "inherit",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          {/* Erreur */}
          {error && (
            <div
              style={{
                background: C.redBg,
                color: C.red,
                padding: "10px 12px",
                borderRadius: 8,
                fontSize: 12,
                marginBottom: 14,
                border: `1px solid ${C.red}33`,
              }}
            >
              ⚠ {error}
            </div>
          )}

          {/* Boutons */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                flex: 1,
                padding: "11px 14px",
                fontSize: 14,
                fontWeight: 600,
                border: `1px solid ${C.border}`,
                background: C.surface,
                color: C.textMd,
                borderRadius: 8,
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 2,
                padding: "11px 14px",
                fontSize: 14,
                fontWeight: 700,
                border: "none",
                background: loading ? C.textXs : C.orange,
                color: "white",
                borderRadius: 8,
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </div>
        </form>

        {/* Footer : accès sur invitation uniquement */}
        <div
          style={{
            marginTop: 22,
            paddingTop: 16,
            borderTop: `1px solid ${C.border}`,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 11, color: C.textMd, lineHeight: 1.5, marginBottom: 10 }}>
            <strong style={{ color: C.text }}>ChantierPro est actuellement en accès sur invitation.</strong><br />
            Demandez votre accès gratuit pour la période de test.
          </div>
          <button
            type="button"
            onClick={() => setShowRequest(true)}
            style={{
              display: "inline-block",
              padding: "8px 16px",
              background: C.surface,
              color: C.orange,
              border: `1px solid ${C.orange}`,
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ✉ Demander un accès
          </button>
          <div style={{ fontSize: 10, color: C.textXs, marginTop: 12, lineHeight: 1.5 }}>
            Donnees chiffrees, hebergees en Europe (Supabase).
          </div>
        </div>
      </div>
      {showRequest && <RequestAccessModal onClose={() => setShowRequest(false)} />}
    </div>
  );
}

// ─── Modale de demande d'accès : formulaire structuré qui génère un mailto: ──
function RequestAccessModal({ onClose }) {
  const [form, setForm] = useState({
    nom: "",
    email: "",
    tel: "",
    typeEntreprise: "Artisan",
    metier: "Maçonnerie",
    message: "",
  });
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState(null);
  function upd(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function envoyer() {
    setErr(null);
    if (!form.nom.trim() || !form.email.trim() || !form.tel.trim()) {
      setErr("Prénom + Nom, email et téléphone sont obligatoires.");
      return;
    }
    const subject = `Demande d'accès ChantierPro — ${form.nom}`;
    const bodyLines = [
      "Bonjour,",
      "",
      "Je souhaite obtenir un accès à ChantierPro pour la période de test.",
      "",
      `Prénom Nom : ${form.nom}`,
      `Email : ${form.email}`,
      `Téléphone : ${form.tel}`,
      `Type d'entreprise : ${form.typeEntreprise}`,
      `Métier / spécialité : ${form.metier}`,
    ];
    if (form.message.trim()) {
      bodyLines.push("", "Message :", form.message.trim());
    }
    bodyLines.push("", "Merci.");
    const url = `mailto:francehabitat.immo@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join("\n"))}`;
    window.location.href = url;
    setSent(true);
  }
  const inp = {
    width: "100%", padding: "9px 11px", fontSize: 13,
    border: `1px solid ${C.border}`, borderRadius: 7,
    background: C.surface, color: C.text, fontFamily: "inherit",
    boxSizing: "border-box", outline: "none",
  };
  const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: C.textMd, marginBottom: 4 };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, borderRadius: 14, padding: 26, maxWidth: 460, width: "100%", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.22)", border: `1px solid ${C.border}` }}>
        {sent ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 38, marginBottom: 10 }}>✉</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, color: C.green, fontWeight: 800 }}>Votre demande a été envoyée !</h3>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: C.textMd, lineHeight: 1.6 }}>
              Vous recevrez votre invitation sous <strong>24h</strong> à l'adresse <strong>{form.email}</strong>.
            </p>
            <button onClick={onClose} style={{ padding: "10px 20px", background: C.orange, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Fermer</button>
          </div>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>✉</div>
              <h3 style={{ margin: 0, fontSize: 17, color: C.text, fontWeight: 700 }}>Demander un accès ChantierPro</h3>
              <p style={{ margin: "6px 0 0", fontSize: 11, color: C.textSm }}>Tous les champs sauf le message sont obligatoires.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              <div>
                <label style={lbl}>Prénom & Nom *</label>
                <input value={form.nom} onChange={e => upd("nom", e.target.value)} placeholder="Marc Dupont" autoFocus style={inp} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={lbl}>Email *</label>
                  <input type="email" value={form.email} onChange={e => upd("email", e.target.value)} placeholder="contact@entreprise.fr" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Téléphone *</label>
                  <input value={form.tel} onChange={e => upd("tel", e.target.value)} placeholder="06 12 34 56 78" style={inp} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={lbl}>Type d'entreprise</label>
                  <select value={form.typeEntreprise} onChange={e => upd("typeEntreprise", e.target.value)} style={inp}>
                    {["Artisan", "Auto-entrepreneur", "SARL", "SAS / SASU", "EURL", "Autre"].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Métier / spécialité</label>
                  <select value={form.metier} onChange={e => upd("metier", e.target.value)} style={inp}>
                    {["Maçonnerie", "Peinture", "Plomberie", "Électricité", "Carrelage", "Charpente / couverture", "Menuiserie", "Multi-corps", "Autre"].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={lbl}>Message (optionnel)</label>
                <textarea value={form.message} onChange={e => upd("message", e.target.value)} rows={3} placeholder="Précisions sur votre activité, vos besoins…" style={{ ...inp, resize: "vertical", lineHeight: 1.4 }} />
              </div>
              {err && (
                <div style={{ background: C.redBg, color: C.red, padding: "9px 11px", borderRadius: 7, fontSize: 12, border: `1px solid ${C.red}33` }}>⚠ {err}</div>
              )}
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button type="button" onClick={onClose} style={{ flex: 1, padding: "11px 14px", fontSize: 13, fontWeight: 600, border: `1px solid ${C.border}`, background: C.surface, color: C.textMd, borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>Annuler</button>
                <button type="button" onClick={envoyer} style={{ flex: 2, padding: "11px 14px", fontSize: 13, fontWeight: 700, border: "none", background: C.orange, color: "#fff", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>Envoyer la demande</button>
              </div>
              <div style={{ fontSize: 10, color: C.textXs, textAlign: "center", lineHeight: 1.5 }}>
                Le formulaire ouvre votre application mail avec les infos pré-remplies. Vous n'avez plus qu'à cliquer sur Envoyer.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
