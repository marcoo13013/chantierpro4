// ═══════════════════════════════════════════════════════════════════════════
// ImpersonationBanner — bandeau "Mode admin actif" + bouton Quitter
// ═══════════════════════════════════════════════════════════════════════════
// Affiché en haut de l'app quand localStorage contient cp_admin_original_session.
// Bouton "Quitter" :
//   1. Restaure la session admin originale via supabase.auth.setSession()
//   2. Insert audit_log impersonate.end (best effort via fetch)
//   3. Reload pour réinitialiser l'app avec la session admin
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function ImpersonationBanner({ authUser }) {
  const [original, setOriginal] = useState(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("cp_admin_original_session");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      // Affiche le bandeau seulement si la session courante est bien celle du target
      if (parsed?.target_id && authUser?.id === parsed.target_id) {
        setOriginal(parsed);
      }
    } catch {}
  }, [authUser?.id]);

  if (!original) return null;

  async function exitImpersonation() {
    if (restoring) return;
    setRestoring(true);
    try {
      // 1. Restaure la session admin
      const { error } = await supabase.auth.setSession({
        access_token: original.access_token,
        refresh_token: original.refresh_token,
      });
      if (error) {
        console.error("[exit impersonate] setSession failed:", error);
        // Force un signOut propre + reload
        await supabase.auth.signOut().catch(() => {});
        localStorage.removeItem("cp_admin_original_session");
        window.location.href = "/";
        return;
      }
      // 2. Audit (non bloquant) — endpoint consolidé impersonate avec action=end
      try {
        await fetch("/api/admin/impersonate", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${original.access_token}` },
          body: JSON.stringify({ action: "end", target_user_id: original.target_id }),
        });
      } catch {}
      // 3. Cleanup + reload
      localStorage.removeItem("cp_admin_original_session");
      window.location.href = "/";
    } catch (e) {
      console.error("[exit impersonate]", e);
      alert("Erreur restauration session : " + (e?.message || e));
      setRestoring(false);
    }
  }

  return (
    <div
      className="no-print"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        background: "linear-gradient(90deg, #EA580C 0%, #DC2626 100%)",
        color: "#fff",
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        fontSize: 13,
        fontWeight: 600,
        zIndex: 10000,
        boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
        fontFamily: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 18 }}>🔒</span>
        <div style={{ minWidth: 0 }}>
          <strong>Mode admin :</strong> connecté en tant que{" "}
          <span style={{ background: "rgba(255,255,255,0.18)", padding: "2px 8px", borderRadius: 4, fontFamily: "monospace" }}>
            {original.target_email || "?"}
          </span>
          <span style={{ marginLeft: 8, opacity: 0.85, fontSize: 11, fontWeight: 400 }}>
            (admin : {original.admin_email || "?"})
          </span>
        </div>
      </div>
      <button
        onClick={exitImpersonation}
        disabled={restoring}
        style={{
          padding: "6px 14px",
          background: "#fff",
          color: "#DC2626",
          border: "none",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 800,
          cursor: restoring ? "wait" : "pointer",
          fontFamily: "inherit",
          whiteSpace: "nowrap",
        }}
      >
        {restoring ? "⏳ Restauration..." : "✕ Quitter le mode admin"}
      </button>
    </div>
  );
}
