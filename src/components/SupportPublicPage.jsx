// ═══════════════════════════════════════════════════════════════════════════
// Page publique /support — Phase 1 du module Support & Tickets
// ═══════════════════════════════════════════════════════════════════════════
// Accédée via /support (rewrite Vercel → index.html, routing dans main.jsx).
// Pas d'authentification — formulaire de ticket ouvert à tous + roadmap
// publique avec votes.
//
// RLS Supabase :
//   - tickets : INSERT autorisé pour anon → on insère directement
//   - roadmap : SELECT public, vote via RPC vote_item('roadmap', id, email)
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";

const NAVY = "#1B3A5C";
const ACCENT = "#FF6B2C";
const GREEN = "#16A34A";
const ORANGE = "#D97706";
const RED = "#DC2626";
const BORDER = "#E2E8F0";
const BG = "#F8FAFC";
const TEXT = "#1E293B";
const TEXT_SM = "#64748B";

const TYPES = [
  { v: "bug", l: "🐛 Bug", c: RED },
  { v: "feature", l: "✨ Fonctionnalité", c: ACCENT },
  { v: "recommandation", l: "💡 Recommandation", c: GREEN },
  { v: "autre", l: "💬 Autre", c: TEXT_SM },
];
const PRIORITES = ["basse", "normale", "haute", "urgente"];

const ROADMAP_STATUTS = {
  planifie:  { label: "Planifié",  color: TEXT_SM, bg: "#F1F5F9" },
  en_cours:  { label: "En cours",  color: ORANGE,  bg: "#FEF3C7" },
  livre:     { label: "Livré",     color: GREEN,   bg: "#D1FAE5" },
  annule:    { label: "Annulé",    color: RED,     bg: "#FEE2E2" },
};
const ROADMAP_TYPES = {
  feature:     { label: "Nouvelle fonctionnalité", icon: "✨" },
  bug_fix:     { label: "Correction",              icon: "🔧" },
  improvement: { label: "Amélioration",            icon: "⚡" },
};

// ─── Form ticket ────────────────────────────────────────────────────────────
function TicketForm({ onSubmitted }) {
  const [type, setType] = useState("bug");
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [priorite, setPriorite] = useState("normale");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!titre.trim() || !description.trim() || !email.trim()) {
      setError("Tous les champs sont obligatoires.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Email invalide.");
      return;
    }
    if (!supabase) {
      setError("Service indisponible (configuration Supabase manquante).");
      return;
    }
    setSubmitting(true);
    const { error: err } = await supabase.from("tickets").insert({
      email: email.trim().toLowerCase(),
      type,
      titre: titre.trim(),
      description: description.trim(),
      priorite,
    });
    setSubmitting(false);
    if (err) {
      setError(`Erreur : ${err.message}`);
      return;
    }
    onSubmitted();
  }

  const inp = {
    width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${BORDER}`,
    borderRadius: 8, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };
  const lbl = { display: "block", fontSize: 11, fontWeight: 700, color: TEXT_SM, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 };

  return (
    <form onSubmit={submit} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 22 }}>
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Type de demande</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {TYPES.map(t => (
            <button key={t.v} type="button" onClick={() => setType(t.v)}
              style={{ padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${type === t.v ? t.c : BORDER}`,
                background: type === t.v ? t.c + "15" : "#fff", color: type === t.v ? t.c : TEXT,
                fontWeight: type === t.v ? 700 : 500, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              {t.l}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Titre court</label>
        <input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Ex : Le PDF du devis ne s'imprime pas correctement"
          style={inp} maxLength={120} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Description détaillée</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={5}
          placeholder="Décrivez le problème, la fonctionnalité souhaitée ou votre suggestion. Plus c'est précis, plus on peut aider rapidement."
          style={{ ...inp, resize: "vertical", minHeight: 100 }} maxLength={2000} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div>
          <label style={lbl}>Priorité</label>
          <select value={priorite} onChange={e => setPriorite(e.target.value)} style={inp}>
            {PRIORITES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Votre email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@exemple.fr"
            style={inp} />
        </div>
      </div>

      {error && <div style={{ background: "#FEE2E2", color: RED, padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <button type="submit" disabled={submitting}
        style={{ width: "100%", padding: "12px 18px", background: ACCENT, color: "#fff", border: "none",
          borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: submitting ? "wait" : "pointer",
          fontFamily: "inherit", opacity: submitting ? 0.6 : 1 }}>
        {submitting ? "Envoi en cours..." : "Envoyer le ticket"}
      </button>
    </form>
  );
}

// ─── Item roadmap ───────────────────────────────────────────────────────────
function RoadmapItem({ item, voterId, onVoted }) {
  const [voting, setVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [localVotes, setLocalVotes] = useState(item.votes || 0);

  useEffect(() => {
    // Détection vote local : voterId déjà dans voters[] OU localStorage
    const voted = (item.voters || []).includes(voterId)
      || localStorage.getItem(`cp_vote_roadmap_${item.id}`) === "1";
    setHasVoted(voted);
  }, [item, voterId]);

  async function vote() {
    if (!voterId || hasVoted || voting) return;
    setVoting(true);
    const { data, error } = await supabase.rpc("vote_item", {
      p_table: "roadmap",
      p_item_id: item.id,
      p_voter: voterId,
    });
    setVoting(false);
    if (!error) {
      setHasVoted(true);
      setLocalVotes(data ?? localVotes + 1);
      localStorage.setItem(`cp_vote_roadmap_${item.id}`, "1");
      onVoted?.();
    }
  }

  const st = ROADMAP_STATUTS[item.statut] || ROADMAP_STATUTS.planifie;
  const tp = ROADMAP_TYPES[item.type] || ROADMAP_TYPES.feature;

  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14, display: "flex", gap: 12, alignItems: "flex-start" }}>
      <button onClick={vote} disabled={hasVoted || voting || !voterId}
        title={!voterId ? "Saisissez votre email plus haut pour voter" : hasVoted ? "Vous avez voté" : "Voter pour cette demande"}
        style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
          padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${hasVoted ? GREEN : BORDER}`,
          background: hasVoted ? "#D1FAE5" : "#fff", color: hasVoted ? GREEN : TEXT,
          cursor: hasVoted || !voterId ? "default" : "pointer", fontFamily: "inherit", minWidth: 50 }}>
        <span style={{ fontSize: 18 }}>{hasVoted ? "✓" : "👍"}</span>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{localVotes}</span>
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{tp.icon} {item.titre}</span>
          <span style={{ background: st.bg, color: st.color, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, textTransform: "uppercase", letterSpacing: 0.4 }}>{st.label}</span>
          {item.livre_le && <span style={{ fontSize: 10, color: TEXT_SM }}>livré le {new Date(item.livre_le).toLocaleDateString("fr-FR")}</span>}
        </div>
        {item.description && <div style={{ fontSize: 12, color: TEXT_SM, lineHeight: 1.5 }}>{item.description}</div>}
      </div>
    </div>
  );
}

// ─── Page principale ────────────────────────────────────────────────────────
export default function SupportPublicPage() {
  const [submitted, setSubmitted] = useState(false);
  const [roadmap, setRoadmap] = useState([]);
  const [loading, setLoading] = useState(true);
  const [voterEmail, setVoterEmail] = useState(() => localStorage.getItem("cp_support_email") || "");

  async function loadRoadmap() {
    if (!supabase) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("roadmap")
      .select("*")
      .order("statut", { ascending: true })
      .order("votes", { ascending: false })
      .order("ordre", { ascending: true });
    if (!error) setRoadmap(data || []);
    setLoading(false);
  }

  useEffect(() => { loadRoadmap(); }, []);

  // Garde l'email saisi pour permettre de voter après soumission
  useEffect(() => {
    if (voterEmail) localStorage.setItem("cp_support_email", voterEmail);
  }, [voterEmail]);

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Plus Jakarta Sans','Segoe UI',sans-serif", color: TEXT }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;}
        input:focus,select:focus,textarea:focus{border-color:${ACCENT}!important;outline:none;box-shadow:0 0 0 3px ${ACCENT}25;}
      `}</style>
      <header style={{ background: NAVY, color: "#fff", padding: "20px 24px" }}>
        <div style={{ maxWidth: 920, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.4 }}>Chantier<span style={{ color: ACCENT }}>Pro</span> · Support</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>Une question, un bug, une idée ? On vous écoute.</div>
          </div>
          <a href="/" style={{ color: "rgba(255,255,255,0.85)", textDecoration: "none", fontSize: 13, fontWeight: 600, border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, padding: "7px 14px" }}>← Retour à l'app</a>
        </div>
      </header>

      <main style={{ maxWidth: 920, margin: "0 auto", padding: "24px" }}>
        {/* Form ou écran de confirmation */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: NAVY, marginBottom: 12, marginTop: 0 }}>Ouvrir un ticket</h2>
          {submitted ? (
            <div style={{ background: "#D1FAE5", border: `1px solid ${GREEN}55`, borderRadius: 12, padding: 22, textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: GREEN, marginBottom: 4 }}>Ticket envoyé avec succès</div>
              <div style={{ fontSize: 13, color: TEXT_SM, marginBottom: 14 }}>Vous recevrez une réponse à <strong>{voterEmail}</strong> dès qu'on l'aura traité.</div>
              <button onClick={() => setSubmitted(false)} style={{ padding: "8px 16px", border: `1px solid ${GREEN}`, borderRadius: 8, background: "#fff", color: GREEN, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Envoyer un autre ticket</button>
            </div>
          ) : (
            <TicketForm onSubmitted={() => { setSubmitted(true); /* email déjà persisté via voterEmail */ }} />
          )}
        </section>

        {/* Roadmap */}
        <section>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: NAVY, margin: 0 }}>🗺️ Roadmap & Mises à jour</h2>
            <span style={{ fontSize: 12, color: TEXT_SM }}>Votez 👍 pour les fonctionnalités qui vous intéressent</span>
          </div>

          {/* Email pour voter (réutilise celui du form si déjà saisi) */}
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_SM }}>📧 Pour voter :</span>
            <input type="email" value={voterEmail} onChange={e => setVoterEmail(e.target.value)} placeholder="votre@email.fr"
              style={{ flex: 1, minWidth: 180, padding: "6px 10px", fontSize: 13, border: `1px solid ${BORDER}`, borderRadius: 6, fontFamily: "inherit", outline: "none" }} />
          </div>

          {loading ? (
            <div style={{ padding: 30, textAlign: "center", color: TEXT_SM }}>Chargement…</div>
          ) : roadmap.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: TEXT_SM, background: "#fff", borderRadius: 10, border: `1px solid ${BORDER}` }}>Aucun item de roadmap pour le moment.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {roadmap.map(item => (
                <RoadmapItem key={item.id} item={item} voterId={voterEmail.trim().toLowerCase()} onVoted={loadRoadmap} />
              ))}
            </div>
          )}
        </section>
      </main>

      <footer style={{ borderTop: `1px solid ${BORDER}`, padding: "20px 24px", marginTop: 40, textAlign: "center", fontSize: 11, color: TEXT_SM }}>
        ChantierPro — Support technique · Phase 1
      </footer>
    </div>
  );
}
