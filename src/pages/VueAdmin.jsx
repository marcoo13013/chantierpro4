// ═══════════════════════════════════════════════════════════════════════════
// VueAdmin — page admin (Marco only)
// ═══════════════════════════════════════════════════════════════════════════
// 2 onglets :
//   1. Comptes : table profiles + métriques (clients/devis/chantiers count)
//      Bouton "Se connecter en tant que" → impersonation via /api/admin/impersonate
//   2. Prospects : table prospects (leads /demo) + statut + bouton Convertir
//
// Sécurité côté UI : check role=admin dans entreprise/profile au mount, sinon
// 403. Le vrai contrôle d'accès est côté Supabase RLS sur les tables.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const C = {
  text: "#0F172A", textMd: "#334155", textSm: "#64748B", textXs: "#94A3B8",
  border: "#E2E8F0", borderMd: "#CBD5E1",
  surface: "#FFFFFF", bg: "#F8FAFC",
  navy: "#1B3A5C", navyBg: "#E8EEF5",
  blue: "#2563EB", blueBg: "#EFF6FF",
  accent: "#E8620A", accentBg: "#FFF3EA",
  green: "#059669", greenBg: "#ECFDF5",
  red: "#DC2626", redBg: "#FEF2F2",
  orange: "#EA580C", orangeBg: "#FFF7ED",
  purple: "#7C3AED", purpleBg: "#F5F3FF",
};

const STATUTS_PROSPECT = [
  { v: "nouveau",  l: "Nouveau",   color: C.blue,   bg: C.blueBg },
  { v: "contacte", l: "Contacté",  color: C.orange, bg: C.orangeBg },
  { v: "converti", l: "Converti",  color: C.green,  bg: C.greenBg },
  { v: "perdu",    l: "Perdu",     color: C.textSm, bg: C.bg },
];

export default function VueAdmin({ authUser, isAdmin }) {
  const [tab, setTab] = useState("comptes");
  const [search, setSearch] = useState("");
  const [comptes, setComptes] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [impersonating, setImpersonating] = useState(null);

  // Charge comptes + prospects (admins seulement via RLS)
  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        // 1. Profiles : tous les comptes
        const { data: profiles, error: pErr } = await supabase
          .from("profiles")
          .select("id, email, role, created_at")
          .order("created_at", { ascending: false });
        if (pErr) throw new Error("profiles: " + pErr.message);

        // 2. Entreprises pour récupérer noms/sirets
        const { data: entreprises } = await supabase
          .from("entreprises")
          .select("user_id, nom, nom_court, siret");
        const entByUid = new Map((entreprises || []).map(e => [e.user_id, e]));

        // 3. Comptages côté Supabase via RPC seraient mieux, mais on fait des
        //    queries head:true count pour rester simple. Une seule query par
        //    table pour TOUS les users (pas une par user).
        const counts = { clients: {}, devis: {}, chantiers: {} };
        for (const [table, key] of [["clients", "clients"], ["devis", "devis"], ["chantiers_v2", "chantiers"]]) {
          const { data: rows, error: cErr } = await supabase
            .from(table).select("user_id");
          if (cErr) { console.warn(`[admin counts ${table}]`, cErr.message); continue; }
          for (const r of (rows || [])) {
            counts[key][r.user_id] = (counts[key][r.user_id] || 0) + 1;
          }
        }

        const enriched = (profiles || []).map(p => {
          const ent = entByUid.get(p.id);
          return {
            ...p,
            nom: ent?.nom || ent?.nom_court || "",
            siret: ent?.siret || "",
            n_clients: counts.clients[p.id] || 0,
            n_devis: counts.devis[p.id] || 0,
            n_chantiers: counts.chantiers[p.id] || 0,
          };
        });

        // 4. Prospects
        const { data: prospectsData, error: prErr } = await supabase
          .from("prospects")
          .select("*")
          .order("created_at", { ascending: false });
        if (prErr) throw new Error("prospects: " + prErr.message);

        if (!cancelled) {
          setComptes(enriched);
          setProspects(prospectsData || []);
        }
      } catch (e) {
        console.error("[VueAdmin]", e);
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAdmin]);

  const filteredComptes = useMemo(() => {
    if (!search.trim()) return comptes;
    const q = search.trim().toLowerCase();
    return comptes.filter(c =>
      (c.email || "").toLowerCase().includes(q)
      || (c.nom || "").toLowerCase().includes(q)
      || (c.siret || "").includes(q)
    );
  }, [comptes, search]);

  const filteredProspects = useMemo(() => {
    if (!search.trim()) return prospects;
    const q = search.trim().toLowerCase();
    return prospects.filter(p =>
      (p.email || "").toLowerCase().includes(q)
      || (p.nom_entreprise || "").toLowerCase().includes(q)
    );
  }, [prospects, search]);

  // ─── Impersonation ──────────────────────────────────────────────────────
  async function impersonate(target) {
    if (!window.confirm(`Se connecter en tant que ${target.nom || target.email} ?\n\nL'action sera tracée dans l'audit log.`)) return;
    setImpersonating(target.id);
    try {
      // 1. Sauvegarde la session actuelle
      const { data: { session: original } } = await supabase.auth.getSession();
      if (!original) throw new Error("Session admin introuvable");
      // 2. Demande un magic link au backend (via service_role)
      const r = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${original.access_token}` },
        body: JSON.stringify({ action: "start", target_user_id: target.id }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      const { hashed_token, target_email } = data;
      if (!hashed_token) throw new Error("Token impersonation manquant");
      // 3. Sauvegarde la session originale dans localStorage AVANT de switcher
      try {
        localStorage.setItem("cp_admin_original_session", JSON.stringify({
          access_token: original.access_token,
          refresh_token: original.refresh_token,
          admin_id: original.user.id,
          admin_email: original.user.email,
          target_id: target.id,
          target_email,
          ts: Date.now(),
        }));
      } catch {}
      // 4. Verifie le magic link → ouvre la session du target
      const { error: vErr } = await supabase.auth.verifyOtp({
        token_hash: hashed_token,
        type: "magiclink",
      });
      if (vErr) throw vErr;
      // 5. Reload pour que App.jsx prenne la nouvelle session
      window.location.href = "/";
    } catch (e) {
      console.error("[impersonate]", e);
      alert("Échec impersonation : " + (e.message || e));
      setImpersonating(null);
    }
  }

  // ─── Update statut prospect ───────────────────────────────────────────
  async function updateProspectStatut(id, statut) {
    const { error: uErr } = await supabase.from("prospects").update({ statut }).eq("id", id);
    if (uErr) { alert("Erreur : " + uErr.message); return; }
    setProspects(ps => ps.map(p => p.id === id ? { ...p, statut } : p));
  }

  if (!isAdmin) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🔒</div>
        <h2 style={{ fontSize: 22, color: C.red, fontWeight: 800, margin: 0 }}>403 — Accès refusé</h2>
        <p style={{ fontSize: 14, color: C.textSm, marginTop: 8 }}>Cette page est réservée aux administrateurs.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>
        🛡 Administration
      </h1>
      <div style={{ fontSize: 13, color: C.textSm, marginBottom: 22 }}>
        Connecté en tant que <strong>{authUser?.email}</strong> (admin)
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${C.border}`, marginBottom: 18 }}>
        {[
          { id: "comptes",   label: `🧾 Comptes clients (${comptes.length})` },
          { id: "prospects", label: `🎯 Prospects (${prospects.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: "10px 18px", border: "none",
              background: "transparent",
              borderBottom: tab === t.id ? `3px solid ${C.accent}` : "3px solid transparent",
              color: tab === t.id ? C.accent : C.textMd,
              fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 14 }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={tab === "comptes" ? "🔍 Rechercher par email, nom entreprise, SIRET..." : "🔍 Rechercher par email ou entreprise..."}
          style={{ width: "100%", padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
        />
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: C.redBg, border: `1px solid ${C.red}33`, borderRadius: 8, fontSize: 12, color: C.red, fontWeight: 600, marginBottom: 14 }}>
          ❌ {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", fontSize: 13, color: C.textSm }}>⏳ Chargement…</div>
      ) : tab === "comptes" ? (
        <ComptesTable comptes={filteredComptes} onImpersonate={impersonate} impersonating={impersonating} />
      ) : (
        <ProspectsTable prospects={filteredProspects} onUpdateStatut={updateProspectStatut} />
      )}
    </div>
  );
}

function ComptesTable({ comptes, onImpersonate, impersonating }) {
  if (comptes.length === 0) {
    return <div style={{ padding: 40, textAlign: "center", fontSize: 13, color: C.textSm }}>Aucun compte trouvé.</div>;
  }
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead style={{ background: C.bg }}>
          <tr>
            {["Entreprise", "Email", "Rôle", "Inscrit le", "Clients", "Devis", "Chantiers", "Action"].map(h => (
              <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: C.textSm, textTransform: "uppercase", fontSize: 9, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {comptes.map((c, i) => {
            const isAdmin = c.role === "admin";
            return (
              <tr key={c.id} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.surface : C.bg }}>
                <td style={{ padding: "10px 12px" }}>
                  <div style={{ fontWeight: 700, color: C.text }}>{c.nom || <span style={{ color: C.textXs, fontStyle: "italic" }}>(profil non rempli)</span>}</div>
                  {c.siret && <div style={{ fontSize: 10, color: C.textXs, fontFamily: "monospace" }}>{c.siret}</div>}
                </td>
                <td style={{ padding: "10px 12px", color: C.textMd, fontSize: 11 }}>{c.email}</td>
                <td style={{ padding: "10px 12px" }}>
                  {isAdmin ? (
                    <span style={{ background: C.purpleBg, color: C.purple, padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 800 }}>🛡 ADMIN</span>
                  ) : (
                    <span style={{ color: C.textSm, fontSize: 11 }}>user</span>
                  )}
                </td>
                <td style={{ padding: "10px 12px", color: C.textSm, fontSize: 11 }}>
                  {c.created_at ? new Date(c.created_at).toLocaleDateString("fr-FR") : "—"}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "center", fontFamily: "monospace", color: C.navy, fontWeight: 700 }}>{c.n_clients}</td>
                <td style={{ padding: "10px 12px", textAlign: "center", fontFamily: "monospace", color: C.blue, fontWeight: 700 }}>{c.n_devis}</td>
                <td style={{ padding: "10px 12px", textAlign: "center", fontFamily: "monospace", color: C.accent, fontWeight: 700 }}>{c.n_chantiers}</td>
                <td style={{ padding: "10px 12px" }}>
                  {!isAdmin && (
                    <button
                      onClick={() => onImpersonate(c)}
                      disabled={impersonating === c.id}
                      style={{
                        padding: "6px 12px",
                        background: impersonating === c.id ? C.borderMd : C.navy,
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: impersonating === c.id ? "wait" : "pointer",
                        fontFamily: "inherit",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {impersonating === c.id ? "⏳" : "🔓 Se connecter"}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProspectsTable({ prospects, onUpdateStatut }) {
  if (prospects.length === 0) {
    return (
      <div style={{ padding: 60, textAlign: "center", fontSize: 13, color: C.textSm }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🎯</div>
        Aucun prospect pour l'instant.
        <br />
        <span style={{ fontSize: 11, color: C.textXs }}>Les inscriptions via <a href="/demo" style={{ color: C.blue }}>/demo</a> apparaissent ici.</span>
      </div>
    );
  }
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead style={{ background: C.bg }}>
          <tr>
            {["Reçu le", "Entreprise", "Contact", "Logiciel actuel", "Volume", "Statut"].map(h => (
              <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: C.textSm, textTransform: "uppercase", fontSize: 9, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {prospects.map((p, i) => {
            const st = STATUTS_PROSPECT.find(s => s.v === p.statut) || STATUTS_PROSPECT[0];
            return (
              <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.surface : C.bg }}>
                <td style={{ padding: "10px 12px", color: C.textSm, fontSize: 11, whiteSpace: "nowrap" }}>
                  {new Date(p.created_at).toLocaleDateString("fr-FR")}<br />
                  <span style={{ fontSize: 9, color: C.textXs }}>{new Date(p.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <div style={{ fontWeight: 700, color: C.text }}>{p.nom_entreprise}</div>
                </td>
                <td style={{ padding: "10px 12px", fontSize: 11 }}>
                  <a href={`mailto:${p.email}`} style={{ color: C.blue, textDecoration: "none", fontWeight: 600 }}>{p.email}</a>
                  {p.telephone && <div style={{ marginTop: 2 }}><a href={`tel:${p.telephone}`} style={{ color: C.textMd, textDecoration: "none", fontSize: 10 }}>📞 {p.telephone}</a></div>}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  {p.logiciel_actuel ? <span style={{ background: C.navyBg, color: C.navy, padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700 }}>{p.logiciel_actuel}</span> : <span style={{ color: C.textXs }}>—</span>}
                </td>
                <td style={{ padding: "10px 12px", fontSize: 11, color: C.textMd }}>
                  {p.volume_clients || <span style={{ color: C.textXs }}>—</span>}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <select value={p.statut} onChange={e => onUpdateStatut(p.id, e.target.value)}
                    style={{
                      padding: "5px 9px",
                      border: `1px solid ${st.color}55`,
                      background: st.bg,
                      color: st.color,
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: "inherit",
                      cursor: "pointer",
                    }}>
                    {STATUTS_PROSPECT.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
