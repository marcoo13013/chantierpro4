// ═══════════════════════════════════════════════════════════════════════════
// PopupDevisAccepte — modal de finalisation acceptation devis
// ═══════════════════════════════════════════════════════════════════════════
// Déclenché quand l'utilisateur passe un devis en statut "accepté" depuis
// VueDevis (intercepte le StatutSelect avant le setDocs effectif).
//
// Récolte les choix de Marco :
//   - Planifier le chantier maintenant (toggle Oui/Non)
//   - Date début + date fin estimée IA (modifiable) + slider coefficient sécu
//   - Récap ouvriers affectés depuis les lignes du devis
//   - Réaffectation rapide des lignes orphelines
//   - Toggle notification client (avec préférence client respectée)
//
// À la validation : appelle onConfirm({ planifie, dateDebut, dateFin,
// coefficientSecurite, notificationClientCochee, notificationCanal }).
// Le déclenchement effectif (création chantier + planning + mail) est porté
// par les Commits 3 et 4 — ce composant ne fait QUE collecter les données.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef, useState } from "react";
import { joursFeriesFRMap, getFerieLabel } from "../lib/jours-feries";

const C = {
  text: "#0F172A", textMd: "#334155", textSm: "#64748B", textXs: "#94A3B8",
  border: "#E2E8F0", borderMd: "#CBD5E1",
  surface: "#FFFFFF", bg: "#F8FAFC",
  navy: "#1B3A5C", navyBg: "#E8EEF5",
  blue: "#2563EB", blueBg: "#EFF6FF",
  accent: "#E8620A", accentBg: "#FFF3EA",
  green: "#059669", greenBg: "#ECFDF5",
  orange: "#EA580C", orangeBg: "#FFF7ED",
  red: "#DC2626", redBg: "#FEF2F2",
  purple: "#7C3AED",
};

const HEURES_PRODUCTIVES_JOUR = 7;
const COEF_MIN = 0.8;
const COEF_MAX = 2.0;
const COEF_STEP = 0.05;
const COEF_DEFAULT = 1.3;

// ─── Helpers date ──────────────────────────────────────────────────────────
function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmtFR(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
// Ajoute nbJ jours OUVRÉS (skip samedi+dimanche+jours fériés FR) à dateISO.
function addJoursOuvres(dateISO, nbJ) {
  if (!dateISO || nbJ <= 0) return dateISO;
  const d = new Date(dateISO);
  if (isNaN(d.getTime())) return dateISO;
  let count = 0;
  while (count < nbJ) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day === 0 || day === 6) continue;
    const iso = d.toISOString().slice(0, 10);
    if (getFerieLabel(iso)) continue;
    count++;
  }
  return d.toISOString().slice(0, 10);
}

// Couleur stable pour un salarié (recopiée pour éviter d'importer App.jsx)
function colorSal(sal) {
  if (sal?.couleur) return sal.couleur;
  const id = +sal?.id || 0;
  return `hsl(${(id * 137) % 360},65%,52%)`;
}

// ─── Composant principal ───────────────────────────────────────────────────
export default function PopupDevisAccepte({
  doc, clients = [], salaries = [],
  entreprise,
  onCancel, onConfirm,
}) {
  // ─── State principal ────────────────────────────────────────────────────
  const [planifie, setPlanifie] = useState(true);
  const [dateDebut, setDateDebut] = useState(todayISO());
  // dateFin : suggérée par défaut, modifiable manuellement. Si l'utilisateur
  // touche au champ, on bascule en "manuel" pour ne plus écraser sa saisie.
  const [dateFin, setDateFin] = useState("");
  const [dateFinManuelle, setDateFinManuelle] = useState(false);
  const [coefficientSecurite, setCoefficientSecurite] = useState(COEF_DEFAULT);
  const [notifChecked, setNotifChecked] = useState(true);
  const [reaffectOpen, setReaffectOpen] = useState(false);
  const [reaffectSalId, setReaffectSalId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const firstFieldRef = useRef(null);

  // ─── Données dérivées du devis ──────────────────────────────────────────
  const lignes = useMemo(
    () => (doc?.lignes || []).filter(l => l && l.type !== "titre" && l.type !== "soustitre" && l.type !== "option"),
    [doc]
  );
  const totalHT = useMemo(
    () => lignes.reduce((a, l) => a + (+l.qte || 0) * (+l.prixUnitHT || 0), 0),
    [lignes]
  );
  // Total heures MO brutes (somme des heures par unité × qte de chaque ligne)
  const totalHeuresBrutes = useMemo(() => lignes.reduce((a, l) => {
    const h = +l.heuresPrevues || 0;
    const q = +l.qte || 1;
    return a + h * q;
  }, 0), [lignes]);
  // Avec coefficient sécurité appliqué
  const totalHeures = +(totalHeuresBrutes * coefficientSecurite).toFixed(1);

  // Récap ouvriers : grouper les lignes par salarié unique
  const ouvriersStats = useMemo(() => {
    const map = new Map(); // salId → { sal, nbLignes }
    for (const l of lignes) {
      const ids = Array.isArray(l.salariesAssignes) ? l.salariesAssignes : [];
      for (const sid of ids) {
        if (!map.has(sid)) {
          const sal = salaries.find(s => s.id === sid);
          if (sal) map.set(sid, { sal, nbLignes: 0 });
        }
        if (map.has(sid)) map.get(sid).nbLignes += 1;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.nbLignes - a.nbLignes);
  }, [lignes, salaries]);
  const nbOuvriersUniques = Math.max(1, ouvriersStats.length);
  const lignesOrphelines = useMemo(
    () => lignes.filter(l => !(Array.isArray(l.salariesAssignes) && l.salariesAssignes.length > 0)),
    [lignes]
  );

  // Estimation IA des jours ouvrés
  const nbJoursOuvres = useMemo(() => {
    if (totalHeures <= 0) return 0;
    return Math.max(1, Math.ceil(totalHeures / (nbOuvriersUniques * HEURES_PRODUCTIVES_JOUR)));
  }, [totalHeures, nbOuvriersUniques]);
  const dateFinSuggeree = useMemo(
    () => nbJoursOuvres > 0 ? addJoursOuvres(dateDebut, nbJoursOuvres) : dateDebut,
    [dateDebut, nbJoursOuvres]
  );
  // Sync auto dateFin sur la suggestion tant que l'utilisateur n'a pas
  // touché manuellement au champ.
  useEffect(() => {
    if (!dateFinManuelle) setDateFin(dateFinSuggeree);
  }, [dateFinSuggeree, dateFinManuelle]);

  // ─── Client + préférence communication ─────────────────────────────────
  // Lookup par nom (le devis stocke client en string). Si fiche client
  // trouvée : récupérer preference_communication (défaut "mail").
  const clientFiche = useMemo(() => {
    const nomNorm = (doc?.client || "").trim().toLowerCase();
    if (!nomNorm) return null;
    return clients.find(c => (c.nom || "").trim().toLowerCase() === nomNorm) || null;
  }, [doc, clients]);
  const prefComm = clientFiche?.preference_communication || "mail";
  const peutNotifier = prefComm !== "rien";

  // ─── Focus initial + raccourcis clavier ────────────────────────────────
  useEffect(() => {
    firstFieldRef.current?.focus?.();
    function onKey(e) {
      if (e.key === "Escape" && !submitting) handleCancel();
      // Enter = Confirmer SAUF si focus sur textarea/select/input date
      if (e.key === "Enter" && !submitting) {
        const tag = (e.target?.tagName || "").toUpperCase();
        const type = (e.target?.type || "").toLowerCase();
        if (tag === "TEXTAREA") return;
        if (tag === "SELECT") return;
        if (tag === "INPUT" && (type === "date" || type === "range")) return;
        e.preventDefault();
        handleConfirm();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitting, planifie, dateDebut, dateFin, coefficientSecurite, notifChecked]);

  // ─── Handlers ──────────────────────────────────────────────────────────
  function handleCancel() {
    if (submitting) return;
    onCancel?.();
  }

  function handleConfirm() {
    setErrorMsg(null);
    if (planifie) {
      if (!dateDebut) { setErrorMsg("Date de début requise"); return; }
      const dD = new Date(dateDebut);
      // Date dans le passé autorisée (chantier rétroactif), juste un bandeau
      // informatif visible dans le bloc Planification (cf isDateDebutPasse).
      if (dateFin && new Date(dateFin) < dD) {
        setErrorMsg("La date de fin ne peut pas précéder la date de début");
        return;
      }
    }
    setSubmitting(true);
    const payload = {
      planifie,
      dateDebut: planifie ? dateDebut : null,
      dateFin: planifie ? (dateFin || dateFinSuggeree) : null,
      coefficientSecurite: planifie ? coefficientSecurite : null,
      totalHeuresEstimees: planifie ? totalHeures : null,
      nbJoursOuvresEstimes: planifie ? nbJoursOuvres : null,
      notificationClientCochee: notifChecked,
      // Canal effectif : si client refuse, on log "rien" même si toggle ON.
      notificationCanal: notifChecked && peutNotifier ? "mail" : "rien",
      acceptationDate: new Date().toISOString(),
    };
    // L'appelant peut renvoyer une Promise (cas insertion DB) ; on attend
    // sa résolution avant de fermer.
    try {
      const ret = onConfirm?.(payload);
      if (ret && typeof ret.then === "function") {
        ret.catch((e) => { setSubmitting(false); setErrorMsg(e?.message || "Erreur"); });
      }
    } catch (e) {
      setSubmitting(false);
      setErrorMsg(e?.message || "Erreur");
    }
  }

  function applyReaffect() {
    if (!reaffectSalId) return;
    // On laisse le parent appliquer la modification sur les lignes orphelines
    // via le callback onConfirm (les lignes seront re-affectées au moment où
    // le chantier est créé). Pour Commit 2, on stocke l'intention dans le
    // payload — Commit 3 lira ce champ pour patcher les lignes du devis avant
    // la conversion en chantier.
    setReaffectOpen(false);
    // Note : on garde le salId sélectionné dans le state pour qu'il soit
    // transmis dans le payload (champ reaffectOrphansToSalId).
  }

  // ─── Styles inline ─────────────────────────────────────────────────────
  const section = { padding: "14px 18px", borderBottom: `1px solid ${C.border}` };
  const sectionTitle = { fontSize: 11, fontWeight: 800, color: C.textSm, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 };
  const radio = (active) => ({
    display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
    border: `2px solid ${active ? C.accent : C.border}`, borderRadius: 8,
    background: active ? C.accentBg : "#fff",
    cursor: "pointer", fontSize: 13, color: active ? C.accent : C.textMd,
    fontWeight: active ? 700 : 500, fontFamily: "inherit", flex: 1,
  });
  const dateInp = { padding: "8px 11px", border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, fontFamily: "inherit", outline: "none", background: "#fff" };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(15,23,42,0.7)",
        zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center",
        padding: 14, paddingTop: "calc(var(--safe-top, 0px) + 14px)",
        paddingBottom: "calc(var(--safe-bottom, 0px) + 14px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) handleCancel(); }}
    >
      <div style={{
        background: "#fff", borderRadius: 14,
        width: "min(95vw, 620px)", maxHeight: "92vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, background: `linear-gradient(135deg, ${C.greenBg} 0%, #fff 100%)` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 22 }}>🎉</span>
            <strong style={{ fontSize: 16, color: C.text }}>Devis accepté — finalisation du chantier</strong>
          </div>
          <div style={{ fontSize: 12, color: C.textSm, marginLeft: 32 }}>
            <strong style={{ color: C.text }}>{doc.client || "Client"}</strong>
            {" · "}
            <span style={{ fontFamily: "monospace" }}>{doc.numero || "—"}</span>
            {" · "}
            <strong style={{ color: C.navy }}>{totalHT.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} € HT</strong>
          </div>
        </div>

        {/* Contenu scrollable */}
        <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain" }}>
          {/* PLANIFICATION */}
          <section style={section}>
            <div style={sectionTitle}>📅 Planification</div>
            <div style={{ display: "flex", gap: 8 }}>
              <label style={radio(planifie)}>
                <input type="radio" name="planifie" checked={planifie} onChange={() => setPlanifie(true)} ref={firstFieldRef} />
                Oui, je planifie ce chantier <span style={{ fontSize: 10, color: planifie ? C.accent : C.textXs, marginLeft: 4 }}>(recommandé)</span>
              </label>
              <label style={radio(!planifie)}>
                <input type="radio" name="planifie" checked={!planifie} onChange={() => setPlanifie(false)} />
                Non, "À planifier"
              </label>
            </div>

            {planifie && dateDebut && new Date(dateDebut) < new Date(todayISO()) && (
              <div style={{ marginTop: 10, padding: "8px 12px", background: C.orangeBg, border: `1px solid ${C.orange}55`, borderRadius: 7, fontSize: 12, color: "#92400E", lineHeight: 1.4 }}>
                ⚠️ Cette date est dans le passé. Confirme que tu veux créer un chantier rétroactif.
              </div>
            )}
            {planifie && (
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: C.textMd, display: "block", marginBottom: 4 }}>Date début *</label>
                    <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} style={dateInp} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: C.textMd, display: "block", marginBottom: 4 }}>
                      Date fin {dateFinManuelle ? "(manuelle)" : "(IA)"}
                    </label>
                    <input
                      type="date"
                      value={dateFin}
                      onChange={(e) => { setDateFin(e.target.value); setDateFinManuelle(true); }}
                      onBlur={() => { if (!dateFin) setDateFinManuelle(false); }}
                      style={dateInp}
                    />
                  </div>
                </div>

                <div style={{ background: C.bg, padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.textMd, marginBottom: 6 }}>⚙️ Coefficient sécurité</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <input
                      type="range" min={COEF_MIN} max={COEF_MAX} step={COEF_STEP}
                      value={coefficientSecurite}
                      onChange={(e) => setCoefficientSecurite(+e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <strong style={{ fontSize: 14, color: C.accent, fontFamily: "monospace", minWidth: 50, textAlign: "right" }}>×{coefficientSecurite.toFixed(2)}</strong>
                  </div>
                  <div style={{ fontSize: 11, color: C.textSm, marginTop: 6, lineHeight: 1.5 }}>
                    {totalHeuresBrutes > 0 ? (
                      <>
                        IA estime <strong>{Math.ceil(totalHeuresBrutes / (nbOuvriersUniques * HEURES_PRODUCTIVES_JOUR))} j ouvrés</strong>
                        {" "}({totalHeuresBrutes.toFixed(1)} h MO ÷ {nbOuvriersUniques} ouvrier{nbOuvriersUniques > 1 ? "s" : ""} × {HEURES_PRODUCTIVES_JOUR} h/j).
                        Marge ×{coefficientSecurite.toFixed(2)} → <strong>{nbJoursOuvres} j ouvrés</strong>.
                      </>
                    ) : (
                      <>Aucune estimation d'heures MO sur les lignes du devis — durée non calculable. Renseigne la date fin manuellement.</>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* OUVRIERS */}
          <section style={section}>
            <div style={sectionTitle}>👥 Ouvriers affectés (depuis le devis)</div>
            {ouvriersStats.length === 0 ? (
              <div style={{ fontSize: 12, color: C.textSm, fontStyle: "italic" }}>
                Aucun ouvrier affecté sur les lignes du devis.
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ouvriersStats.map(({ sal, nbLignes }) => {
                  const col = colorSal(sal);
                  const init = (sal.nom || "?").split(/\s+/).map(w => w[0] || "").join("").slice(0, 2).toUpperCase();
                  return (
                    <span key={sal.id} title={sal.nom} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px 4px 4px", background: col + "15", border: `1px solid ${col}55`, borderRadius: 14, fontSize: 11, fontWeight: 600, color: col }}>
                      <span style={{ width: 20, height: 20, borderRadius: "50%", background: col, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800 }}>{init || "?"}</span>
                      ✓ {sal.nom} <span style={{ color: C.textXs, fontWeight: 400 }}>({nbLignes} ligne{nbLignes > 1 ? "s" : ""})</span>
                    </span>
                  );
                })}
              </div>
            )}
            {lignesOrphelines.length > 0 && (
              <div style={{ marginTop: 10, padding: "8px 12px", background: C.orangeBg, border: `1px solid ${C.orange}55`, borderRadius: 7, fontSize: 12, color: "#92400E" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <span><strong>⚠ {lignesOrphelines.length} ligne{lignesOrphelines.length > 1 ? "s" : ""} sans ouvrier</strong></span>
                  {!reaffectOpen && (
                    <button onClick={() => setReaffectOpen(true)} style={{ padding: "4px 10px", background: "#fff", border: `1px solid ${C.orange}`, color: C.orange, borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      Réaffecter
                    </button>
                  )}
                </div>
                {reaffectOpen && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${C.orange}66` }}>
                    <div style={{ fontSize: 11, color: "#92400E", marginBottom: 6 }}>Affecter ces lignes à :</div>
                    <select value={reaffectSalId || ""} onChange={(e) => setReaffectSalId(e.target.value ? +e.target.value : null)} style={{ ...dateInp, width: "100%", marginBottom: 8 }}>
                      <option value="">— Choisir un ouvrier —</option>
                      {salaries.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                    </select>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button onClick={() => { setReaffectOpen(false); setReaffectSalId(null); }} style={{ padding: "4px 10px", background: "#fff", border: `1px solid ${C.border}`, color: C.textMd, borderRadius: 5, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Annuler</button>
                      <button onClick={applyReaffect} disabled={!reaffectSalId} style={{ padding: "4px 10px", background: reaffectSalId ? C.orange : C.borderMd, color: "#fff", border: "none", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: reaffectSalId ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                        ✓ Appliquer
                      </button>
                    </div>
                  </div>
                )}
                {!reaffectOpen && reaffectSalId && (
                  <div style={{ fontSize: 11, color: C.green, marginTop: 6 }}>
                    ✓ Ces lignes seront affectées à <strong>{salaries.find(s => s.id === reaffectSalId)?.nom}</strong> à la création du chantier.
                  </div>
                )}
              </div>
            )}
          </section>

          {/* NOTIFICATION */}
          <section style={section}>
            <div style={sectionTitle}>💌 Notification client</div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: peutNotifier ? "pointer" : "not-allowed", opacity: peutNotifier ? 1 : 0.6 }}>
              <input
                type="checkbox"
                checked={notifChecked && peutNotifier}
                onChange={(e) => peutNotifier && setNotifChecked(e.target.checked)}
                disabled={!peutNotifier}
              />
              <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>
                Envoyer confirmation à {doc.client || "ce client"}
              </span>
            </label>
            <div style={{ fontSize: 11, color: peutNotifier ? C.textSm : C.orange, marginTop: 6, marginLeft: 24, lineHeight: 1.5 }}>
              {peutNotifier
                ? <>Préférence client : <strong>Mail ✉️</strong>{clientFiche?.email && <> · <span style={{ fontFamily: "monospace" }}>{clientFiche.email}</span></>}</>
                : <>⚠️ Ce client a refusé les notifications (<code>preference_communication = 'rien'</code>) — aucun envoi même si la case est cochée.</>
              }
            </div>
          </section>
        </div>

        {/* Footer sticky : erreurs + boutons */}
        <div style={{ borderTop: `1px solid ${C.border}`, background: "#fff" }}>
          {errorMsg && (
            <div style={{ padding: "8px 18px", background: C.redBg, color: C.red, fontSize: 12, fontWeight: 600, borderBottom: `1px solid ${C.red}33` }}>
              ❌ {errorMsg}
            </div>
          )}
          <div style={{ padding: "12px 18px", display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              onClick={handleCancel}
              disabled={submitting}
              style={{ padding: "10px 18px", background: "#fff", border: `1px solid ${C.border}`, color: C.textMd, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: submitting ? "wait" : "pointer", fontFamily: "inherit" }}
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={submitting}
              style={{ padding: "10px 22px", background: submitting ? C.textXs : C.green, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: submitting ? "wait" : "pointer", fontFamily: "inherit" }}
            >
              {submitting ? "⏳ Validation…" : "✓ Confirmer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export utilitaire pour rendre la fonction réutilisable dans App.jsx
// (génération planning Commit 3).
export { addJoursOuvres };
