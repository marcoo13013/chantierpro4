// ═══════════════════════════════════════════════════════════════════════════
// Page publique de signature électronique d'un devis
// ═══════════════════════════════════════════════════════════════════════════
// Accédée via /signature/:token (rewrite Vercel → index.html, routing dans
// main.jsx). Pas d'authentification — seul le token (UUID stocké sur le doc)
// permet l'accès. Le serveur (api/signature-*) bypass RLS via service_role.
//
// Flow signataire :
// 1. GET /api/signature-get?token=… → récupère le devis + entreprise
// 2. Affiche un aperçu lecture seule du devis (pas de marges/fournitures)
// 3. Saisie nom + prénom + checkbox "Lu et approuvé" + canvas signature
// 4. POST /api/signature-sign → enregistre signature + IP + timestamp
// 5. Écran de confirmation
//
// Valeur probatoire : signature électronique simple eIDAS (niveau 1) — bonne
// pour acceptance B2C de devis BTP, pas qualifiée pour litiges complexes.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from "react";

const NAVY = "#1B3A5C";
const ACCENT = "#FF6B2C";
const GREEN = "#16A34A";
const RED = "#DC2626";
const BORDER = "#E2E8F0";
const TEXT = "#1E293B";
const TEXT_MD = "#475569";
const TEXT_SM = "#64748B";

function fmt2(n) { return (Math.round((+n||0)*100)/100).toFixed(2).replace(".",","); }
function euro(n) { return `${fmt2(n)} €`; }
function isLigne(it) { return it && it.type !== "titre" && it.type !== "soustitre" && it.type !== "option"; }

// ─── Canvas signature (touch + mouse) ───────────────────────────────────────
function SignatureCanvas({ onChange }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const lastRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // Fond blanc explicite (sinon canvas est transparent → PNG avec alpha)
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  function getPos(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let cx, cy;
    if (e.touches && e.touches[0]) {
      cx = e.touches[0].clientX;
      cy = e.touches[0].clientY;
    } else {
      cx = e.clientX;
      cy = e.clientY;
    }
    return { x: (cx - rect.left) * scaleX, y: (cy - rect.top) * scaleY };
  }

  function onStart(e) {
    e.preventDefault();
    setDrawing(true);
    lastRef.current = getPos(e);
  }
  function onMove(e) {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const pos = getPos(e);
    ctx.strokeStyle = NAVY;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastRef.current = pos;
    if (!hasSignature) setHasSignature(true);
  }
  function onEnd() {
    if (!drawing) return;
    setDrawing(false);
    if (canvasRef.current && hasSignature) {
      onChange(canvasRef.current.toDataURL("image/png"));
    }
  }
  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onChange(null);
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={600}
        height={200}
        style={{ width: "100%", height: 200, border: `2px dashed ${hasSignature ? NAVY : "#CBD5E1"}`, borderRadius: 10, touchAction: "none", background: "#FAFBFC", cursor: "crosshair", display: "block" }}
        onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
        onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
        <div style={{ fontSize: 11, color: TEXT_SM }}>
          {hasSignature ? "✓ Signature en place" : "✍️ Signez avec votre doigt (ou souris)"}
        </div>
        {hasSignature && (
          <button onClick={clear} type="button" style={{ padding: "4px 10px", border: `1px solid ${BORDER}`, borderRadius: 6, background: "#fff", color: RED, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
            ↻ Effacer
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Aperçu devis lecture seule ─────────────────────────────────────────────
function DevisReadOnly({ doc, entreprise }) {
  const items = doc?.lignes || [];
  let ht = 0, tva = 0;
  for (const l of items) {
    if (!isLigne(l)) continue;
    const lh = (+l.qte || 0) * (+l.prixUnitHT || 0);
    ht += lh;
    tva += lh * ((+l.tva || 0) / 100);
  }
  const ttc = ht + tva;
  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: 20, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 13 }}>
      {/* En-tête */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, paddingBottom: 12, borderBottom: `2px solid ${NAVY}`, gap: 16, flexWrap: "wrap" }}>
        <div>
          {entreprise?.logo
            ? <img src={entreprise.logo} alt={entreprise.nom || ""} style={{ maxHeight: 60, maxWidth: 180, objectFit: "contain" }} />
            : <div style={{ fontSize: 18, fontWeight: 900, color: NAVY }}>{entreprise?.nomCourt || entreprise?.nom || "ChantierPro"}</div>}
        </div>
        <div style={{ textAlign: "right", fontSize: 11, color: TEXT_SM, lineHeight: 1.6 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>{entreprise?.nom}</div>
          {entreprise?.adresse && <>{entreprise.adresse}<br /></>}
          {(entreprise?.tel || entreprise?.email) && <>{[entreprise.tel, entreprise.email].filter(Boolean).join(" · ")}<br /></>}
          {entreprise?.siret && <>SIRET : {entreprise.siret}</>}
        </div>
      </div>

      {/* Bandeau type / N° / date */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: NAVY, textTransform: "uppercase" }}>DEVIS N° {doc.numero}</div>
        <div style={{ color: TEXT_MD, fontSize: 12 }}>{doc.date}</div>
      </div>

      {/* Client */}
      <div style={{ background: "#F8FAFC", borderRadius: 7, padding: "10px 12px", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, color: NAVY }}>{doc.client}</div>
        {doc.adresseClient && <div style={{ color: TEXT_MD, fontSize: 12, marginTop: 2 }}>{doc.adresseClient}</div>}
        {doc.titreChantier && <div style={{ color: NAVY, fontSize: 12, fontWeight: 600, marginTop: 5, fontStyle: "italic" }}>Objet : {doc.titreChantier}</div>}
      </div>

      {/* Lignes */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
        <thead><tr style={{ background: NAVY, color: "#fff" }}>
          {["Désignation", "Qté", "U", "P.U. HT", "Total HT"].map(h => <th key={h} style={{ padding: "6px 9px", fontSize: 9, textAlign: "left", fontWeight: 600, textTransform: "uppercase" }}>{h}</th>)}
        </tr></thead>
        <tbody>
          {items.map((l, i) => {
            if (l.type === "titre") return (
              <tr key={l.id || i} style={{ background: NAVY, color: "#fff" }}>
                <td colSpan={5} style={{ padding: "7px 9px", fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase" }}>{l.libelle || "Titre"}</td>
              </tr>
            );
            if (l.type === "soustitre") return (
              <tr key={l.id || i} style={{ background: "#F1F5F9", borderBottom: `1px solid ${BORDER}` }}>
                <td colSpan={5} style={{ padding: "6px 9px 6px 22px", fontSize: 11, fontWeight: 700, color: NAVY }}>{l.libelle || "Sous-titre"}</td>
              </tr>
            );
            if (!isLigne(l)) return null;
            return (
              <tr key={l.id || i} style={{ borderBottom: `1px solid ${BORDER}`, background: i % 2 === 0 ? "#fff" : "#FAFBFC" }}>
                <td style={{ padding: "6px 9px", fontSize: 11, whiteSpace: "pre-wrap" }}>{l.libelle}</td>
                <td style={{ padding: "6px 9px", textAlign: "right", color: TEXT_SM, fontSize: 11 }}>{l.qte}</td>
                <td style={{ padding: "6px 9px", color: TEXT_SM, fontSize: 11 }}>{l.unite}</td>
                <td style={{ padding: "6px 9px", textAlign: "right", fontSize: 11, fontFamily: "monospace" }}>{fmt2(l.prixUnitHT)} €</td>
                <td style={{ padding: "6px 9px", textAlign: "right", fontWeight: 600, fontSize: 11, fontFamily: "monospace" }}>{fmt2((+l.qte || 0) * (+l.prixUnitHT || 0))} €</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totaux */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ minWidth: 220, background: "#F8FAFC", border: `1px solid ${BORDER}`, borderRadius: 7, padding: "10px 14px" }}>
          {[["Montant HT", ht], ["TVA", tva], ["TOTAL TTC", ttc]].map(([l, v]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: l !== "TOTAL TTC" ? `1px solid ${BORDER}` : "none" }}>
              <span style={{ color: TEXT_MD, fontSize: 12 }}>{l}</span>
              <span style={{ fontWeight: l === "TOTAL TTC" ? 900 : 500, color: l === "TOTAL TTC" ? NAVY : "#374151", fontFamily: "monospace", fontSize: l === "TOTAL TTC" ? 14 : 12 }}>{fmt2(v)} €</span>
            </div>
          ))}
        </div>
      </div>

      {/* Conditions / notes */}
      {(doc.conditionsReglement || doc.notes) && (
        <div style={{ marginTop: 14, fontSize: 10, color: TEXT_SM, lineHeight: 1.5 }}>
          {doc.conditionsReglement} {doc.conditionsReglement && doc.notes ? " · " : ""} {doc.notes}
        </div>
      )}
    </div>
  );
}

// ─── Page publique principale ───────────────────────────────────────────────
export default function SignaturePublicPage({ token }) {
  const [state, setState] = useState("loading"); // loading | ready | already-signed | success | error
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [signatureDataURL, setSignatureDataURL] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/signature-get?token=${encodeURIComponent(token)}`)
      .then(async r => {
        const body = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) {
          setError(body.error || `Erreur ${r.status}`);
          setState("error");
          return;
        }
        setData(body);
        setState(body.signed ? "already-signed" : "ready");
        if (body.doc?.client) setSignerName(body.doc.client);
        if (body.doc?.emailClient) setSignerEmail(body.doc.emailClient);
      })
      .catch(e => {
        if (cancelled) return;
        setError(e.message || "Erreur réseau");
        setState("error");
      });
    return () => { cancelled = true; };
  }, [token]);

  async function submitSignature() {
    if (!signatureDataURL) { alert("Veuillez signer dans le cadre avant de valider."); return; }
    if (!signerName.trim()) { alert("Veuillez renseigner votre nom."); return; }
    if (!agreed) { alert("Cochez la case 'Lu et approuvé' pour valider."); return; }
    setSubmitting(true);
    try {
      const r = await fetch("/api/signature-sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          signature: signatureDataURL,
          signerName: signerName.trim(),
          signerEmail: signerEmail.trim() || null,
        }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert(`Erreur : ${body.error || r.status}`);
        setSubmitting(false);
        return;
      }
      setData(d => ({ ...d, signedAt: body.signedAt, signerName: signerName.trim() }));
      setState("success");
    } catch (e) {
      alert(`Erreur réseau : ${e.message || e}`);
      setSubmitting(false);
    }
  }

  // ─── États ─────────────────────────────────────────────────────────────
  const wrapperStyle = { minHeight: "100vh", background: "linear-gradient(135deg,#F8FAFC 0%,#E2E8F0 100%)", padding: 16, fontFamily: "'Plus Jakarta Sans','Segoe UI',Arial,sans-serif", color: TEXT };

  if (state === "loading") {
    return (
      <div style={{ ...wrapperStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: NAVY, marginBottom: 12 }}>Chantier<span style={{ color: ACCENT }}>Pro</span></div>
          <div style={{ width: 40, height: 40, border: `3px solid ${BORDER}`, borderTopColor: NAVY, borderRadius: "50%", margin: "0 auto", animation: "cpSpin .8s linear infinite" }} />
          <style>{`@keyframes cpSpin{to{transform:rotate(360deg)}}`}</style>
          <div style={{ marginTop: 12, fontSize: 12, color: TEXT_SM }}>Chargement du devis…</div>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div style={{ ...wrapperStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: 460, width: "100%", background: "#fff", borderRadius: 14, padding: 28, boxShadow: "0 12px 30px rgba(0,0,0,.1)" }}>
          <div style={{ textAlign: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 38 }}>⚠️</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: TEXT, marginTop: 6 }}>Lien invalide</div>
          </div>
          <div style={{ padding: "10px 12px", background: "#FEE2E2", color: RED, borderRadius: 7, fontSize: 12, marginBottom: 12 }}>{error}</div>
          <div style={{ fontSize: 12, color: TEXT_SM, lineHeight: 1.6 }}>
            Ce lien de signature est introuvable ou a expiré. Contactez l'entreprise qui vous a envoyé le devis pour obtenir un nouveau lien.
          </div>
        </div>
      </div>
    );
  }

  if (state === "already-signed") {
    return (
      <div style={{ ...wrapperStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: 460, width: "100%", background: "#fff", borderRadius: 14, padding: 28, boxShadow: "0 12px 30px rgba(0,0,0,.1)", textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: GREEN }}>Devis déjà signé</div>
          <div style={{ fontSize: 12, color: TEXT_SM, marginTop: 8, lineHeight: 1.6 }}>
            Le devis <strong style={{ color: NAVY, fontFamily: "monospace" }}>{data?.doc?.numero}</strong> a été signé{data?.signedAt ? ` le ${new Date(data.signedAt).toLocaleString("fr-FR")}` : ""}{data?.signerName ? ` par ${data.signerName}` : ""}.
          </div>
        </div>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div style={{ ...wrapperStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: 480, width: "100%", background: "#fff", borderRadius: 14, padding: 32, boxShadow: "0 12px 30px rgba(0,0,0,.1)", textAlign: "center" }}>
          <div style={{ fontSize: 50, marginBottom: 10 }}>🎉</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: GREEN, marginBottom: 6 }}>Signature enregistrée</div>
          <div style={{ fontSize: 13, color: TEXT_MD, lineHeight: 1.7 }}>
            Merci <strong>{data?.signerName}</strong>. Le devis <strong style={{ fontFamily: "monospace", color: NAVY }}>{data?.doc?.numero}</strong> a été signé électroniquement
            {data?.signedAt && <> le <strong>{new Date(data.signedAt).toLocaleString("fr-FR")}</strong></>}.
          </div>
          <div style={{ fontSize: 11, color: TEXT_SM, marginTop: 14, padding: "10px 12px", background: "#F8FAFC", borderRadius: 7, lineHeight: 1.6 }}>
            ℹ️ L'entreprise <strong>{data?.entreprise?.nom}</strong> est notifiée automatiquement. Vous recevrez par e-mail une copie du devis signé sous quelques minutes.
          </div>
        </div>
      </div>
    );
  }

  // ─── État ready : signature en cours ────────────────────────────────
  const { doc, entreprise } = data;
  return (
    <div style={wrapperStyle}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: NAVY }}>Chantier<span style={{ color: ACCENT }}>Pro</span></div>
          <div style={{ fontSize: 13, color: TEXT_MD, marginTop: 4 }}>Signature électronique du devis</div>
        </div>

        {/* Message du patron */}
        {doc.signatureMessage && (
          <div style={{ background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 10, padding: "12px 16px", marginBottom: 14, fontSize: 13, color: "#92400E", lineHeight: 1.6 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#92400E", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>📩 Message de {entreprise?.nom || "l'entreprise"}</div>
            {doc.signatureMessage}
          </div>
        )}

        {/* Aperçu devis */}
        <DevisReadOnly doc={doc} entreprise={entreprise} />

        {/* Formulaire signature */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 22, marginTop: 16, border: `2px solid ${NAVY}`, boxShadow: "0 8px 20px rgba(27,58,92,.1)" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 14 }}>✍️ Bon pour accord et signature</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: TEXT_MD, marginBottom: 4 }}>Nom et prénom <span style={{ color: RED }}>*</span></label>
              <input type="text" value={signerName} onChange={e => setSignerName(e.target.value)} disabled={submitting}
                style={{ width: "100%", padding: "10px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: TEXT_MD, marginBottom: 4 }}>E-mail (pour copie)</label>
              <input type="email" value={signerEmail} onChange={e => setSignerEmail(e.target.value)} disabled={submitting}
                style={{ width: "100%", padding: "10px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 14, padding: "10px 12px", background: agreed ? "#ECFDF5" : "#F8FAFC", border: `1px solid ${agreed ? GREEN : BORDER}`, borderRadius: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} disabled={submitting} style={{ marginTop: 2 }} />
            <span style={{ fontSize: 12, color: TEXT, lineHeight: 1.6 }}>
              <strong>Lu et approuvé.</strong> Je certifie avoir pris connaissance du devis n° <strong style={{ fontFamily: "monospace", color: NAVY }}>{doc.numero}</strong> et accepter ses termes (montant, prestations, conditions de règlement).
            </span>
          </label>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: TEXT_MD, marginBottom: 4 }}>Signature manuscrite <span style={{ color: RED }}>*</span></label>
            <SignatureCanvas onChange={setSignatureDataURL} />
          </div>
          <button onClick={submitSignature} disabled={submitting || !signatureDataURL || !signerName.trim() || !agreed}
            style={{ width: "100%", padding: "14px 16px", background: submitting || !signatureDataURL || !agreed ? "#94A3B8" : GREEN, color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: submitting || !signatureDataURL || !agreed ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 12px rgba(22,163,74,.25)" }}>
            {submitting ? "⏳ Enregistrement…" : "✓ Signer et valider le devis"}
          </button>
          <div style={{ fontSize: 10, color: TEXT_SM, marginTop: 10, textAlign: "center", lineHeight: 1.5 }}>
            🔒 Signature électronique simple (eIDAS niveau 1). Votre adresse IP et l'horodatage sont enregistrés comme preuve d'acceptation.
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", fontSize: 10, color: TEXT_SM, marginTop: 18 }}>
          ChantierPro · Signature électronique sécurisée
        </div>
      </div>
    </div>
  );
}
