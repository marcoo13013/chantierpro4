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
          <div
            style={{
              fontSize: 11,
              color: C.textMd,
              lineHeight: 1.5,
              marginBottom: 10,
            }}
          >
            Acces sur invitation uniquement.<br />
            Pas encore de compte ?
          </div>
          <a
            href="mailto:francehabitat.immo@gmail.com?subject=Demande%20d%27acces%20ChantierPro&body=Bonjour%2C%0A%0AJe%20souhaite%20obtenir%20un%20acces%20a%20ChantierPro.%0A%0ANom%20entreprise%20%3A%20%0ASIRET%20%3A%20%0AActivite%20%3A%20%0A%0AMerci."
            style={{
              display: "inline-block",
              padding: "8px 16px",
              background: C.surface,
              color: C.orange,
              border: `1px solid ${C.orange}`,
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
              fontFamily: "inherit",
            }}
          >
            ✉ Demander un acces
          </a>
          <div
            style={{
              fontSize: 10,
              color: C.textXs,
              marginTop: 12,
              lineHeight: 1.5,
            }}
          >
            Donnees chiffrees, hebergees en Europe (Supabase).
          </div>
        </div>
      </div>
    </div>
  );
}
