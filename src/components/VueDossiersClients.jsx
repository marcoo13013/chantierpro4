// ═══════════════════════════════════════════════════════════════════════════
// VueDossiersClients.jsx — vue Dossiers Clients (Sprint 3B)
// ═══════════════════════════════════════════════════════════════════════════
// 1 dossier = 1 chantier, avec son devis (root), ses acomptes (devis_id) et
// sa facture finale (factureSourceDevisId).
//
// Vues :
//   - Liste des dossiers (filtres statut + client)
//   - Détail d'un dossier (hiérarchie devis → acomptes → facture)
//   - Export PDF complet / ZIP / mail
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from "react";
import { acompteEstCouvertParFactureFinale } from "../lib/kpi";

// Palette (compatible L global d'App.jsx — répliqué minimal pour autonomie)
const C = {
  text: "#0F172A", textMd: "#334155", textSm: "#64748B", textXs: "#94A3B8",
  border: "#E2E8F0", borderMd: "#CBD5E1",
  surface: "#FFFFFF", bg: "#F8FAFC",
  navy: "#1B3A5C", navyBg: "#E8EEF5",
  blue: "#2563EB", blueBg: "#DBEAFE",
  green: "#059669", greenBg: "#D1FAE5",
  orange: "#D97706", orangeBg: "#FEF3C7",
  purple: "#7C3AED", purpleBg: "#F5F3FF",
  red: "#DC2626", redBg: "#FEE2E2",
  teal: "#0F766E",
};

function euro(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── Helper : agrège les dossiers par chantier ─────────────────────────────
// Retourne pour chaque chantier : devis liés, acomptes liés, factures liées,
// + totaux et reste à percevoir. Inclut un pseudo-dossier "sans chantier"
// pour les devis brouillon/en attente non encore convertis en chantier.
function buildDossiers(chantiers, docs, calcDocTotal, acomptesLiesAuDevis) {
  const dossiers = [];
  for (const ch of chantiers || []) {
    // Devis directement liés au chantier
    const devisChantier = (docs || []).filter(d => d.type === "devis" && d.chantierId === ch.id);
    if (devisChantier.length === 0) continue; // chantier sans devis → ignoré
    const devisIds = new Set(devisChantier.map(d => d.id));
    // Acomptes liés à n'importe lequel des devis du chantier
    const acomptes = (docs || []).filter(d =>
      d.estAcompte && [...devisIds].some(did => acomptesLiesAuDevis(did, [d]).length > 0)
    );
    // Factures (non-acomptes) issues d'un de ces devis
    const factures = (docs || []).filter(d =>
      d.type === "facture" && !d.estAcompte && d.factureSourceDevisId && devisIds.has(d.factureSourceDevisId)
    );
    const totalDevis = devisChantier.reduce((a, d) => a + (calcDocTotal(d).ttc || 0), 0);
    const totalFact = factures.reduce((a, f) => a + (calcDocTotal(f).ttc || 0), 0);
    // Total encaissé = factures payées TTC + acomptes payés SANS facture
    // finale liée payée (cf. acompteEstCouvertParFactureFinale).
    // Bug Petit Isabelle : devis 1100 + acompte 330 payé + facture finale 1100
    // payée → client a versé 1100, pas 1430.
    const totalEnc = [...acomptes, ...factures]
      .filter(d => d.statut === "payé" || d.statut === "encaissé")
      .filter(d => !(d.estAcompte && acompteEstCouvertParFactureFinale(d, docs || [])))
      .reduce((a, d) => a + (calcDocTotal(d).ttc || 0), 0);
    // Reste à percevoir : si facture finale émise, on utilise son TTC ;
    // sinon le TTC du devis (potentiel à facturer).
    const refTotal = totalFact > 0 ? totalFact : totalDevis;
    const reste = Math.max(0, refTotal - totalEnc);
    // Statut global du dossier
    let statutGlobal = "en cours";
    if (factures.some(f => f.statut === "payé") && reste <= 0.01) statutGlobal = "terminé";
    else if (ch.statut === "annulé") statutGlobal = "annulé";
    else if (ch.statut === "terminé") statutGlobal = "terminé";
    dossiers.push({
      id: `ch-${ch.id}`,
      chantier: ch,
      devis: devisChantier,
      acomptes,
      factures,
      totalDevis,
      totalFact,
      totalEnc,
      reste,
      statutGlobal,
      nbDocs: devisChantier.length + acomptes.length + factures.length,
    });
  }
  return dossiers;
}

// ═══════════════════════════════════════════════════════════════════════════
// Composant principal
// ═══════════════════════════════════════════════════════════════════════════
export default function VueDossiersClients({
  chantiers = [], docs = [], clients = [], entreprise, calcDocTotal,
  acomptesLiesAuDevis,
  onOpenDevis, onOpenFacture, onOpenChantier, onDemanderAcompte,
}) {
  const [detailDossierId, setDetailDossierId] = useState(null);
  const [filtreStatut, setFiltreStatut] = useState("tous");
  const [filtreClient, setFiltreClient] = useState("");
  const [exportLoading, setExportLoading] = useState(false);

  const dossiers = useMemo(
    () => buildDossiers(chantiers, docs, calcDocTotal, acomptesLiesAuDevis),
    [chantiers, docs, calcDocTotal, acomptesLiesAuDevis]
  );

  const dossiersFiltres = useMemo(() => {
    return dossiers.filter(d => {
      if (filtreStatut !== "tous" && d.statutGlobal !== filtreStatut) return false;
      if (filtreClient) {
        const client = (d.chantier?.client || "").toLowerCase();
        if (!client.includes(filtreClient.toLowerCase())) return false;
      }
      return true;
    });
  }, [dossiers, filtreStatut, filtreClient]);

  const clientsList = useMemo(() => {
    return [...new Set(dossiers.map(d => d.chantier?.client).filter(Boolean))].sort();
  }, [dossiers]);

  const detail = detailDossierId ? dossiers.find(d => d.id === detailDossierId) : null;

  if (detail) {
    return <DetailDossier
      dossier={detail}
      entreprise={entreprise}
      clients={clients}
      onBack={() => setDetailDossierId(null)}
      onOpenDevis={onOpenDevis}
      onOpenFacture={onOpenFacture}
      onOpenChantier={onOpenChantier}
      onDemanderAcompte={onDemanderAcompte}
      calcDocTotal={calcDocTotal}
      exportLoading={exportLoading}
      setExportLoading={setExportLoading}
    />;
  }

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>📂 Dossiers Clients</h1>
        <div style={{ fontSize: 12, color: C.textSm, marginTop: 4 }}>
          Vue consolidée par chantier — devis, acomptes, factures et règlements regroupés.
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: 12, marginBottom: 18 }}>
        <KPI label="Dossiers" value={dossiers.length} color={C.navy} />
        <KPI label="En cours" value={dossiers.filter(d => d.statutGlobal === "en cours").length} color={C.blue} />
        <KPI label="Terminés" value={dossiers.filter(d => d.statutGlobal === "terminé").length} color={C.green} />
        <KPI label="Reste à percevoir"
          value={euro(dossiers.reduce((a, d) => a + d.reste, 0))}
          color={C.orange} />
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: C.textSm, textTransform: "uppercase", letterSpacing: 0.4 }}>Statut</label>
          <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)}
            style={{ padding: "7px 10px", border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 12, fontFamily: "inherit", background: C.surface, minWidth: 140 }}>
            <option value="tous">Tous</option>
            <option value="en cours">En cours</option>
            <option value="terminé">Terminés</option>
            <option value="annulé">Annulés</option>
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 160 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: C.textSm, textTransform: "uppercase", letterSpacing: 0.4 }}>Client</label>
          <input list="dossiers-clients" value={filtreClient} onChange={e => setFiltreClient(e.target.value)}
            placeholder="Rechercher un client…"
            style={{ padding: "7px 10px", border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 12, fontFamily: "inherit", background: C.surface }} />
          <datalist id="dossiers-clients">
            {clientsList.map(c => <option key={c} value={c} />)}
          </datalist>
        </div>
      </div>

      {/* Liste */}
      {dossiersFiltres.length === 0 ? (
        <div style={{ padding: 30, textAlign: "center", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, color: C.textSm }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>📂</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 6 }}>
            {dossiers.length === 0 ? "Aucun dossier" : "Aucun dossier ne correspond aux filtres"}
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.6 }}>
            Un dossier est créé automatiquement quand un devis est associé à un chantier.
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 14 }}>
          {dossiersFiltres.map(d => (
            <DossierCard key={d.id} dossier={d} onOpen={() => setDetailDossierId(d.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Card pour la liste ────────────────────────────────────────────────────
function DossierCard({ dossier, onOpen }) {
  const { chantier, devis, acomptes, factures, totalFact, totalEnc, reste, statutGlobal, nbDocs } = dossier;
  const statutColors = {
    "en cours": { bg: C.blueBg, fg: C.blue, label: "EN COURS" },
    "terminé": { bg: C.greenBg, fg: C.green, label: "TERMINÉ" },
    "annulé": { bg: C.redBg, fg: C.red, label: "ANNULÉ" },
  };
  const s = statutColors[statutGlobal] || statutColors["en cours"];
  return (
    <div onClick={onOpen} style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16,
      cursor: "pointer", transition: "all 0.15s", display: "flex", flexDirection: "column", gap: 10,
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = C.navy; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none"; }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text, lineHeight: 1.2 }}>
            {chantier?.client || "Client inconnu"}
          </div>
          <div style={{ fontSize: 11, color: C.textSm, marginTop: 2, lineHeight: 1.3 }}>
            {chantier?.nom || `Chantier #${chantier?.id}`}
          </div>
        </div>
        <span style={{ background: s.bg, color: s.fg, padding: "3px 8px", borderRadius: 5, fontSize: 10, fontWeight: 800, letterSpacing: 0.4 }}>
          {s.label}
        </span>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11, padding: "8px 0", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div>
          <div style={{ color: C.textSm }}>Facturé</div>
          <div style={{ fontWeight: 700, color: C.text, fontFamily: "monospace" }}>{euro(totalFact)}</div>
        </div>
        <div>
          <div style={{ color: C.textSm }}>Encaissé</div>
          <div style={{ fontWeight: 700, color: C.green, fontFamily: "monospace" }}>{euro(totalEnc)}</div>
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <div style={{ color: C.textSm }}>Reste à percevoir</div>
          <div style={{ fontWeight: 800, color: reste > 0 ? C.orange : C.green, fontFamily: "monospace", fontSize: 14 }}>{euro(reste)}</div>
        </div>
      </div>

      {/* Compteurs docs */}
      <div style={{ display: "flex", gap: 12, fontSize: 11, color: C.textMd }}>
        <span>📋 {devis.length} devis</span>
        <span>💰 {acomptes.length} acompte{acomptes.length > 1 ? "s" : ""}</span>
        <span>🧾 {factures.length} facture{factures.length > 1 ? "s" : ""}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Vue détail d'un dossier
// ═══════════════════════════════════════════════════════════════════════════
function DetailDossier({ dossier, entreprise, clients, onBack, onOpenDevis, onOpenFacture, onOpenChantier, onDemanderAcompte, calcDocTotal, exportLoading, setExportLoading }) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const { chantier, devis, acomptes, factures, totalDevis, totalFact, totalEnc, reste } = dossier;
  const clientObj = clients?.find(c => (c.nom || "").trim().toLowerCase() === (chantier?.client || "").trim().toLowerCase());

  async function exporter(format) {
    if (exportLoading) return;
    setShowExportMenu(false);
    setExportLoading(true);
    try {
      const { exportDossier } = await import("../lib/dossierExport.js");
      await exportDossier({ format, dossier, entreprise, client: clientObj, calcDocTotal });
    } catch (err) {
      console.error("[export dossier]", err);
      alert("Erreur export : " + (err?.message || String(err)));
    } finally {
      setExportLoading(false);
    }
  }

  return (
    <div>
      {/* Bouton retour + actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <button onClick={onBack} style={{ padding: "8px 14px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: C.textMd, cursor: "pointer", fontFamily: "inherit" }}>
          ← Retour aux dossiers
        </button>
        <div style={{ position: "relative" }}>
          <button onClick={() => setShowExportMenu(s => !s)} disabled={exportLoading}
            style={{ padding: "8px 14px", background: C.navy, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: exportLoading ? "wait" : "pointer", fontFamily: "inherit" }}>
            {exportLoading ? "⏳ Génération…" : "📤 Exporter le dossier ▼"}
          </button>
          {showExportMenu && (
            <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", minWidth: 240, zIndex: 100 }}>
              <button onClick={() => exporter("pdf")} style={menuItemStyle()}>
                <span style={{ fontSize: 18 }}>📄</span>
                <span><strong>PDF complet</strong><br /><span style={{ fontSize: 11, color: C.textSm }}>Tous les documents concaténés</span></span>
              </button>
              <button onClick={() => exporter("zip")} style={menuItemStyle()}>
                <span style={{ fontSize: 18 }}>📦</span>
                <span><strong>ZIP</strong><br /><span style={{ fontSize: 11, color: C.textSm }}>PDFs séparés + récapitulatif</span></span>
              </button>
              <button onClick={() => exporter("mail")} style={menuItemStyle(true)}>
                <span style={{ fontSize: 18 }}>📧</span>
                <span><strong>Envoyer par mail</strong><br /><span style={{ fontSize: 11, color: C.textSm }}>Mailto pré-rempli pour le client</span></span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Header dossier */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{chantier?.client || "—"}</div>
            {chantier?.adresse && <div style={{ fontSize: 12, color: C.textMd, marginTop: 4 }}>{chantier.adresse}</div>}
            <div style={{ fontSize: 13, fontWeight: 600, color: C.navy, marginTop: 8 }}>{chantier?.nom || `Chantier #${chantier?.id}`}</div>
            {chantier?.id && (
              <button onClick={() => onOpenChantier?.(chantier.id)} style={{ marginTop: 8, padding: "4px 10px", background: C.navyBg, color: C.navy, border: `1px solid ${C.navy}33`, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                → Voir le chantier
              </button>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "6px 16px", fontSize: 12 }}>
            <span style={{ color: C.textSm }}>Total devis</span>
            <span style={{ fontFamily: "monospace", fontWeight: 700, textAlign: "right", color: C.text }}>{euro(totalDevis)}</span>
            <span style={{ color: C.textSm }}>Total facturé</span>
            <span style={{ fontFamily: "monospace", fontWeight: 700, textAlign: "right", color: C.text }}>{euro(totalFact)}</span>
            <span style={{ color: C.textSm }}>Total encaissé</span>
            <span style={{ fontFamily: "monospace", fontWeight: 700, textAlign: "right", color: C.green }}>{euro(totalEnc)}</span>
            <span style={{ color: C.textSm, fontWeight: 700, borderTop: `1px solid ${C.border}`, paddingTop: 6 }}>Reste à percevoir</span>
            <span style={{ fontFamily: "monospace", fontWeight: 800, textAlign: "right", color: reste > 0 ? C.orange : C.green, fontSize: 15, borderTop: `1px solid ${C.border}`, paddingTop: 6 }}>{euro(reste)}</span>
          </div>
        </div>
      </div>

      {/* Hiérarchie devis */}
      <Section icon="📋" titre="Devis" count={devis.length}>
        {devis.length === 0 ? <EmptyRow label="Aucun devis" /> : devis.map(d => (
          <DocRow key={d.id} doc={d} statut={d.statut} montant={calcDocTotal(d).ttc}
            onOpen={() => onOpenDevis?.(d)} typeLabel="DEVIS" typeColor={C.blue} />
        ))}
      </Section>

      {/* Hiérarchie acomptes */}
      <Section icon="💰" titre="Acomptes" count={acomptes.length}>
        {acomptes.map(a => (
          <DocRow key={a.id} doc={a} statut={a.statut} montant={calcDocTotal(a).ttc}
            onOpen={() => onOpenFacture?.(a)} typeLabel="ACOMPTE" typeColor={C.purple} />
        ))}
        {onDemanderAcompte && devis.length > 0 && (
          <button onClick={() => onDemanderAcompte(devis[0])}
            style={{ width: "100%", padding: "10px 14px", background: C.purpleBg, color: C.purple, border: `1px dashed ${C.purple}`, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 6 }}>
            + Demander un nouvel acompte
          </button>
        )}
      </Section>

      {/* Hiérarchie factures finales */}
      <Section icon="🧾" titre="Factures finales" count={factures.length}>
        {factures.length === 0 ? <EmptyRow label="Aucune facture finale émise" /> : factures.map(f => (
          <DocRow key={f.id} doc={f} statut={f.statut} montant={calcDocTotal(f).ttc}
            onOpen={() => onOpenFacture?.(f)} typeLabel="FACTURE" typeColor={C.teal} netAPayer={f.montantPaye || 0} />
        ))}
      </Section>
    </div>
  );
}

// ─── Helpers UI ────────────────────────────────────────────────────────────
function KPI({ label, value, color }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.textSm, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function Section({ icon, titre, count, children }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <span>{icon} {titre}</span>
        <span style={{ background: C.bg, color: C.textSm, padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{count}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

function EmptyRow({ label }) {
  return <div style={{ padding: "10px 12px", color: C.textXs, fontSize: 12, fontStyle: "italic" }}>{label}</div>;
}

function DocRow({ doc, statut, montant, onOpen, typeLabel, typeColor }) {
  const statutColors = {
    "brouillon": { bg: C.bg, fg: C.textSm },
    "envoyé": { bg: C.blueBg, fg: C.blue },
    "en attente": { bg: C.orangeBg, fg: C.orange },
    "en attente signature": { bg: C.orangeBg, fg: C.orange },
    "signé": { bg: C.greenBg, fg: C.green },
    "accepté": { bg: C.greenBg, fg: C.green },
    "facturé": { bg: "#F0FDFA", fg: C.teal },
    "payé": { bg: C.greenBg, fg: C.green },
    "partiellement payé": { bg: C.purpleBg, fg: C.purple },
    "refusé": { bg: C.redBg, fg: C.red },
    "annulé": { bg: C.redBg, fg: C.red },
  };
  const s = statutColors[statut] || { bg: C.bg, fg: C.textSm };
  return (
    <div onClick={onOpen} style={{ padding: "10px 12px", background: C.bg, borderRadius: 7, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", flexWrap: "wrap" }}>
      <span style={{ background: typeColor + "22", color: typeColor, padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 800, letterSpacing: 0.5 }}>{typeLabel}</span>
      <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: C.text }}>{doc.numero || "—"}</span>
      <span style={{ fontSize: 11, color: C.textSm }}>{fmtDate(doc.date)}</span>
      <span style={{ flex: 1 }} />
      <span style={{ fontFamily: "monospace", fontWeight: 700, color: C.text }}>{euro(montant)}</span>
      <span style={{ background: s.bg, color: s.fg, padding: "2px 7px", borderRadius: 4, fontSize: 9, fontWeight: 800, letterSpacing: 0.4 }}>{(statut || "—").toUpperCase()}</span>
    </div>
  );
}

function menuItemStyle(last = false) {
  return {
    display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "transparent",
    border: "none", borderBottom: last ? "none" : `1px solid ${C.border}`, width: "100%", textAlign: "left",
    cursor: "pointer", fontSize: 12, color: C.text, fontFamily: "inherit",
  };
}
