// ═══════════════════════════════════════════════════════════════════════════
// VueAgenda — agenda style Google Calendar pour ChantierPro
// ═══════════════════════════════════════════════════════════════════════════
// Composant réutilisable dans 3 contextes :
//   - "global"   : Planning, toutes tâches, sidebar filtres ouvriers + chantiers
//   - "chantier" : Onglet Planning d'un chantier, filtre fixe sur le chantier
//   - "terrain"  : Vue Terrain user, agenda perso visites + interventions
//
// Modes Day / Week (default) / Month. Drag-drop pour reschedule, resize
// bord bas pour changer durée, popover Google-like, all-day events
// (absences + jours fériés FR), ligne "maintenant" rouge.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo, useRef } from "react";
import { joursFeriesFRMap } from "../lib/jours-feries";

// ─── Tokens couleur (alignés sur App.jsx L) ────────────────────────────────
const C = {
  text: "#0F172A", textMd: "#334155", textSm: "#64748B", textXs: "#94A3B8",
  border: "#E2E8F0", borderMd: "#CBD5E1",
  surface: "#FFFFFF", bg: "#F8FAFC",
  navy: "#1B3A5C", navyBg: "#E8EEF5",
  blue: "#2563EB", blueBg: "#EFF6FF",
  accent: "#E8620A", accentBg: "#FFF3EA",
  green: "#059669", greenBg: "#ECFDF5",
  red: "#DC2626", redBg: "#FEF2F2",
  orange: "#EA580C",
  purple: "#7C3AED",
};

// ─── Helpers date ──────────────────────────────────────────────────────────
function fmtISO(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
function startOfDay(d) { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; }
function startOfWeek(d) {
  const r = startOfDay(d);
  const day = r.getDay();
  const offset = day === 0 ? -6 : 1 - day; // Lundi première
  r.setDate(r.getDate() + offset);
  return r;
}
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function sameDay(a, b) { return a && b && fmtISO(a) === fmtISO(b); }

const MOIS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const JOURS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const JOURS_FR_LONG = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]; // index = getDay()

// Couleur stable depuis un id (réplique couleurSalarie/Chantier)
function couleurStable(id, defaut) {
  if (!id) return defaut || C.navy;
  let h = 0;
  const s = String(id);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h},65%,52%)`;
}

// Heures jour d'un salarié (somme plages horaires_travail) — fallback 7h
function heuresJourSal(s) {
  if (!s) return 7;
  if (Array.isArray(s.horaires_travail)) {
    let total = 0;
    for (const p of s.horaires_travail) {
      const m = (str) => { const mt = String(str || "").match(/^(\d{1,2}):(\d{2})$/); return mt ? +mt[1] * 60 + +mt[2] : null; };
      const d = m(p?.debut), f = m(p?.fin);
      if (d != null && f != null && f > d) total += f - d;
    }
    return Math.round(total / 6) / 10;
  }
  return 7;
}

// Capa journalière : somme heuresJourSal des assignés (par défaut 7h)
function capaJourPhase(phase, salaries) {
  const ids = phase?.salariesIds || [];
  if (ids.length === 0) return 7;
  return ids.reduce((a, id) => {
    const s = (salaries || []).find(x => x.id === id);
    return a + (s ? heuresJourSal(s) : 7);
  }, 0);
}

// dureeHeures (avec rétro-compat dureeJours × capa)
function getDureeHeures(phase, salaries) {
  const h = +phase?.dureeHeures;
  if (h > 0) return h;
  return Math.max(0, (+phase?.dureeJours || 1) * capaJourPhase(phase, salaries));
}

// Étalement multi-jour : retourne [{date, heuresUtilisees, heureDebut, heureFin}]
// heureDebut = phase.heureDebut OR "08:00" par défaut.
function calculerEtalementAgenda(phase, salaries, absences = []) {
  const heuresTotal = getDureeHeures(phase, salaries);
  if (heuresTotal <= 0 || !phase?.dateDebut) return [];
  const capa = capaJourPhase(phase, salaries);
  if (capa <= 0) return [];
  const start = new Date(phase.dateDebut + "T00:00:00");
  if (isNaN(start)) return [];
  const heureDebutStr = phase.heureDebut || "08:00";
  const m = heureDebutStr.match(/^(\d{1,2}):(\d{2})$/);
  const startMinutes = m ? (+m[1] * 60 + +m[2]) : (8 * 60);
  let restant = heuresTotal;
  const out = [];
  const cursor = new Date(start);
  let safety = 60;
  let isFirst = true;
  while (restant > 0.01 && safety-- > 0) {
    const day = cursor.getDay();
    const iso = fmtISO(cursor);
    const isWE = day === 0 || day === 6;
    const tousAbsents = (phase.salariesIds || []).length > 0
      && (phase.salariesIds || []).every(sid => (absences || []).some(a => String(a.ouvrier_id) === String(sid) && iso >= a.date_debut && iso <= a.date_fin));
    if (!isWE && !tousAbsents) {
      const heuresCeJour = Math.min(restant, capa);
      const startMin = isFirst ? startMinutes : (8 * 60);
      const endMin = startMin + Math.round(heuresCeJour * 60);
      out.push({
        date: iso,
        heuresUtilisees: Math.round(heuresCeJour * 100) / 100,
        startMinutes: startMin,
        endMinutes: endMin,
      });
      restant -= heuresCeJour;
      isFirst = false;
    }
    if (restant > 0.01) cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// Composant principal VueAgenda
// ═══════════════════════════════════════════════════════════════════════════
export default function VueAgenda({
  chantiers = [], setChantiers,
  salaries = [], sousTraitants = [], absences = [],
  dateInitiale, modeInitial = "week",
  contexte = "global",
  chantierIdFixe = null, salIdFixe = null,
  onPhaseClick, onPhaseCreate,
  hauteur = "calc(100vh - 180px)",
}) {
  const [view, setView] = useState(modeInitial); // "day" | "week" | "month"
  const [cursor, setCursor] = useState(() => {
    const d = dateInitiale ? new Date(dateInitiale) : new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  // Filtres : Set d'ids actifs. null = tous actifs (default).
  const [filtreSal, setFiltreSal] = useState(null);
  const [filtreChantier, setFiltreChantier] = useState(null);
  const [couleurMode, setCouleurMode] = useState("ouvrier"); // "ouvrier" | "chantier"
  const [popover, setPopover] = useState(null); // {phase, chantierId, x, y}
  const [drag, setDrag] = useState(null); // {phase, mode:"move"|"resize", startX, startY, ...}
  const [createDraft, setCreateDraft] = useState(null); // {date, startHour, durationHours} pendant drag
  const [now, setNow] = useState(() => new Date());

  // Update "maintenant" toutes les minutes
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // ─── Filtres effectifs ────────────────────────────────────────────────
  const salFiltre = useMemo(() => {
    if (contexte === "terrain" && salIdFixe) return new Set([salIdFixe]);
    if (filtreSal === null) return null; // tous
    return filtreSal;
  }, [filtreSal, contexte, salIdFixe]);

  const chFiltre = useMemo(() => {
    if (contexte === "chantier" && chantierIdFixe) return new Set([chantierIdFixe]);
    if (filtreChantier === null) return null; // tous
    return filtreChantier;
  }, [filtreChantier, contexte, chantierIdFixe]);

  // ─── Phases enrichies + filtrées ──────────────────────────────────────
  const allPhases = useMemo(() => chantiers.flatMap(c =>
    (c.planning || []).map(p => ({
      ...p, chantierId: c.id, chantierNom: c.nom || `#${c.id}`,
    }))
  ), [chantiers]);

  const phasesFiltrees = useMemo(() => allPhases.filter(p => {
    if (chFiltre && !chFiltre.has(p.chantierId)) return false;
    if (salFiltre) {
      const ids = p.salariesIds || [];
      if (ids.length === 0) return false;
      if (!ids.some(id => salFiltre.has(id))) return false;
    }
    return true;
  }), [allPhases, chFiltre, salFiltre]);

  // ─── Couleur d'une phase ──────────────────────────────────────────────
  function colorPhase(p) {
    if (couleurMode === "chantier") {
      return couleurStable(p.chantierId, C.navy);
    }
    const sids = p.salariesIds || [];
    if (sids.length > 0) {
      const sal = salaries.find(s => s.id === sids[0]);
      if (sal?.couleur) return sal.couleur;
      return couleurStable(sal?.id, C.navy);
    }
    if ((p.sousTraitantsIds || []).length > 0) {
      const st = sousTraitants.find(s => s.id === p.sousTraitantsIds[0]);
      return st?.couleur || C.purple;
    }
    return "#94A3B8";
  }

  // ─── Range de dates affiché ────────────────────────────────────────────
  const range = useMemo(() => {
    if (view === "day") return { start: startOfDay(cursor), days: [startOfDay(cursor)] };
    if (view === "week") {
      const start = startOfWeek(cursor);
      const days = []; for (let i = 0; i < 7; i++) days.push(addDays(start, i));
      return { start, days };
    }
    // month
    const first = startOfMonth(cursor);
    const start = startOfWeek(first);
    const last = endOfMonth(cursor);
    const end = startOfWeek(last); end.setDate(end.getDate() + 6);
    const days = []; const cur = new Date(start);
    while (cur <= end) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    return { start, days };
  }, [view, cursor]);

  // ─── Index segments par jour ──────────────────────────────────────────
  const segmentsByDay = useMemo(() => {
    const m = new Map();
    for (const p of phasesFiltrees) {
      const segs = calculerEtalementAgenda(p, salaries, absences);
      for (const seg of segs) {
        if (!m.has(seg.date)) m.set(seg.date, []);
        m.get(seg.date).push({ ...seg, phase: p });
      }
    }
    return m;
  }, [phasesFiltrees, salaries, absences]);

  // ─── All-day events (absences + fériés) ────────────────────────────────
  const allDayByDay = useMemo(() => {
    const m = new Map();
    // Jours fériés couvrant le range (1 ou 2 années)
    const yearsSet = new Set();
    for (const d of range.days) yearsSet.add(d.getFullYear());
    for (const y of yearsSet) {
      const fmap = joursFeriesFRMap(y);
      for (const [iso, info] of fmap.entries()) {
        if (!m.has(iso)) m.set(iso, []);
        m.get(iso).push({ type: "ferie", label: info.label });
      }
    }
    // Absences : si filtre salarié actif, on n'affiche que celles des concernés.
    // Sinon on n'affiche que celles d'ouvriers ayant au moins une phase visible.
    const salIdsConcernes = salFiltre ? new Set(salFiltre) : new Set(salaries.map(s => s.id));
    for (const a of absences || []) {
      if (!salIdsConcernes.has(a.ouvrier_id)) continue;
      const s = salaries.find(x => x.id === a.ouvrier_id);
      const nom = s?.nom || "Ouvrier";
      const start = new Date(a.date_debut + "T00:00:00");
      const end = new Date(a.date_fin + "T00:00:00");
      const cur = new Date(start);
      while (cur <= end) {
        const iso = fmtISO(cur);
        // Seulement si le jour est dans range
        if (range.days.some(d => fmtISO(d) === iso)) {
          if (!m.has(iso)) m.set(iso, []);
          m.get(iso).push({ type: "absence", motif: a.motif, label: nom, ouvrierId: a.ouvrier_id });
        }
        cur.setDate(cur.getDate() + 1);
      }
    }
    return m;
  }, [range, salFiltre, salaries, absences]);

  // ─── Navigation ────────────────────────────────────────────────────────
  function navigate(delta) {
    const d = new Date(cursor);
    if (view === "day") d.setDate(d.getDate() + delta);
    else if (view === "week") d.setDate(d.getDate() + delta * 7);
    else d.setMonth(d.getMonth() + delta);
    d.setHours(0, 0, 0, 0);
    setCursor(d);
  }
  function today() { const d = new Date(); d.setHours(0, 0, 0, 0); setCursor(d); }

  // ─── Header label ──────────────────────────────────────────────────────
  const headerLabel = view === "day"
    ? cursor.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : view === "week"
      ? `Semaine du ${range.days[0].toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} au ${range.days[6].toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`
      : `${MOIS_FR[cursor.getMonth()]} ${cursor.getFullYear()}`;

  // ─── Persistance phase update ──────────────────────────────────────────
  function updatePhase(chantierId, phaseId, patch) {
    if (!setChantiers) return;
    setChantiers(cs => cs.map(c => c.id !== chantierId ? c : {
      ...c, planning: (c.planning || []).map(p => p.id === phaseId ? { ...p, ...patch } : p),
    }));
  }
  function deletePhase(chantierId, phaseId) {
    if (!setChantiers) return;
    setChantiers(cs => cs.map(c => c.id !== chantierId ? c : {
      ...c, planning: (c.planning || []).filter(p => p.id !== phaseId),
    }));
  }

  // ─── Layout principal ──────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: hauteur, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
      {/* Sidebar gauche : mini-cal + filtres (caché en contexte chantier/terrain pour gain place) */}
      {contexte !== "terrain" && (
        <AgendaSidebar
          cursor={cursor} setCursor={setCursor}
          salaries={salaries} chantiers={chantiers}
          filtreSal={filtreSal} setFiltreSal={setFiltreSal}
          filtreChantier={filtreChantier} setFiltreChantier={setFiltreChantier}
          couleurMode={couleurMode} setCouleurMode={setCouleurMode}
          contexte={contexte}
        />
      )}
      {/* Zone principale */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: `1px solid ${C.border}`, background: C.surface, flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 2, border: `1px solid ${C.border}`, borderRadius: 7, padding: 2, background: C.surface }}>
            <button onClick={() => navigate(-1)} title="Précédent" style={tbBtn(C, false)}>‹</button>
            <button onClick={today} title="Aujourd'hui" style={{ ...tbBtn(C, false), color: C.navy, fontWeight: 600 }}>Aujourd'hui</button>
            <button onClick={() => navigate(1)} title="Suivant" style={tbBtn(C, false)}>›</button>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, minWidth: 200 }}>{headerLabel}</div>
          <div style={{ display: "inline-flex", border: `1px solid ${C.border}`, borderRadius: 7, overflow: "hidden", marginLeft: "auto" }}>
            {[{ id: "day", l: "Jour" }, { id: "week", l: "Semaine" }, { id: "month", l: "Mois" }].map(v => (
              <button key={v.id} onClick={() => setView(v.id)} style={{ padding: "5px 11px", border: "none", background: view === v.id ? C.navy : C.surface, color: view === v.id ? "#fff" : C.textMd, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{v.l}</button>
            ))}
          </div>
        </div>

        {/* Vue principale */}
        {view === "month"
          ? <AgendaMonthView
              days={range.days} cursorMonth={cursor.getMonth()}
              segmentsByDay={segmentsByDay} allDayByDay={allDayByDay}
              colorPhase={colorPhase} now={now}
              onPhaseClick={(p, e) => setPopover({ phase: p, chantierId: p.chantierId, x: e.clientX, y: e.clientY })}
              onCellClick={(date) => onPhaseCreate?.({ dateDebut: fmtISO(date) })}
            />
          : <AgendaTimeGrid
              days={range.days} segmentsByDay={segmentsByDay} allDayByDay={allDayByDay}
              colorPhase={colorPhase} now={now}
              onPhaseClick={(p, e) => setPopover({ phase: p, chantierId: p.chantierId, x: e.clientX, y: e.clientY })}
              updatePhase={updatePhase}
              salaries={salaries} absences={absences}
              onCreate={(payload) => onPhaseCreate?.(payload)}
            />
        }
      </div>

      {/* Popover détails phase */}
      {popover && (
        <AgendaPopover
          phase={popover.phase} chantierId={popover.chantierId}
          x={popover.x} y={popover.y}
          color={colorPhase(popover.phase)}
          salaries={salaries} sousTraitants={sousTraitants}
          onClose={() => setPopover(null)}
          onEdit={(p) => { setPopover(null); onPhaseClick?.(p); }}
          onDelete={(p) => {
            if (window.confirm(`Supprimer "${p.tache || 'cette tâche'}" ?`)) {
              deletePhase(p.chantierId, p.id);
              setPopover(null);
            }
          }}
        />
      )}
    </div>
  );
}

const tbBtn = (C, primary) => ({
  background: primary ? C.navy : "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: 13, fontWeight: 700,
  color: primary ? "#fff" : C.textMd,
  padding: "4px 10px", fontFamily: "inherit",
  borderRadius: 5,
});

// ═══════════════════════════════════════════════════════════════════════════
// Sidebar (mini-cal + filtres)
// ═══════════════════════════════════════════════════════════════════════════
function AgendaSidebar({ cursor, setCursor, salaries, chantiers, filtreSal, setFiltreSal, filtreChantier, setFiltreChantier, couleurMode, setCouleurMode, contexte }) {
  const [miniCalCursor, setMiniCalCursor] = useState(() => startOfMonth(cursor));

  function toggleSal(id) {
    const cur = filtreSal === null ? new Set(salaries.map(s => s.id)) : new Set(filtreSal);
    if (cur.has(id)) cur.delete(id); else cur.add(id);
    if (cur.size === salaries.length) setFiltreSal(null);
    else setFiltreSal(cur);
  }
  function toggleCh(id) {
    const cur = filtreChantier === null ? new Set(chantiers.map(c => c.id)) : new Set(filtreChantier);
    if (cur.has(id)) cur.delete(id); else cur.add(id);
    if (cur.size === chantiers.length) setFiltreChantier(null);
    else setFiltreChantier(cur);
  }
  function isSalActive(id) {
    return filtreSal === null || filtreSal.has(id);
  }
  function isChActive(id) {
    return filtreChantier === null || filtreChantier.has(id);
  }

  return (
    <div style={{ width: 240, borderRight: `1px solid ${C.border}`, background: C.bg, padding: 12, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Mini-calendar */}
      <MiniCalendar
        monthCursor={miniCalCursor} setMonthCursor={setMiniCalCursor}
        selectedDate={cursor}
        onSelectDate={(d) => setCursor(d)}
      />

      {/* Couleur mode */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.textSm, textTransform: "uppercase", marginBottom: 5 }}>Couleur par</div>
        <div style={{ display: "flex", gap: 4 }}>
          {[{ id: "ouvrier", l: "Ouvrier" }, { id: "chantier", l: "Chantier" }].map(o => (
            <button key={o.id} onClick={() => setCouleurMode(o.id)}
              style={{ flex: 1, padding: "5px 8px", border: `1px solid ${couleurMode === o.id ? C.navy : C.border}`, background: couleurMode === o.id ? C.navyBg : C.surface, color: couleurMode === o.id ? C.navy : C.textMd, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", borderRadius: 5 }}>
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {/* Filtres ouvriers */}
      {salaries.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.textSm, textTransform: "uppercase", marginBottom: 5 }}>Ouvriers</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {salaries.map(s => {
              const active = isSalActive(s.id);
              const couleur = s.couleur || couleurStable(s.id, C.navy);
              return (
                <label key={s.id} onClick={() => toggleSal(s.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 6px", borderRadius: 4, cursor: "pointer", background: active ? C.surface : "transparent", opacity: active ? 1 : 0.5 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: active ? couleur : "transparent", border: `2px solid ${couleur}`, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: C.textMd, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{s.nom}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Filtres chantiers (caché en contexte chantier où c'est figé) */}
      {contexte !== "chantier" && chantiers.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.textSm, textTransform: "uppercase", marginBottom: 5 }}>Chantiers</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 200, overflowY: "auto" }}>
            {chantiers.map(c => {
              const active = isChActive(c.id);
              const couleur = couleurStable(c.id, C.navy);
              return (
                <label key={c.id} onClick={() => toggleCh(c.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 6px", borderRadius: 4, cursor: "pointer", background: active ? C.surface : "transparent", opacity: active ? 1 : 0.5 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: active ? couleur : "transparent", border: `2px solid ${couleur}`, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: C.textMd, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{c.nom}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniCalendar({ monthCursor, setMonthCursor, selectedDate, onSelectDate }) {
  const first = startOfMonth(monthCursor);
  const start = startOfWeek(first);
  const days = []; const cur = new Date(start);
  for (let i = 0; i < 42; i++) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
  const today = startOfDay(new Date());

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <button onClick={() => { const d = new Date(monthCursor); d.setMonth(d.getMonth() - 1); setMonthCursor(d); }}
          style={{ background: "transparent", border: "none", cursor: "pointer", color: C.textSm, fontSize: 14, padding: "0 4px" }}>‹</button>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{MOIS_FR[monthCursor.getMonth()]} {monthCursor.getFullYear()}</span>
        <button onClick={() => { const d = new Date(monthCursor); d.setMonth(d.getMonth() + 1); setMonthCursor(d); }}
          style={{ background: "transparent", border: "none", cursor: "pointer", color: C.textSm, fontSize: 14, padding: "0 4px" }}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {JOURS_FR.map(j => <div key={j} style={{ fontSize: 9, color: C.textXs, textAlign: "center", fontWeight: 600 }}>{j[0]}</div>)}
        {days.map((d, i) => {
          const isOtherMonth = d.getMonth() !== monthCursor.getMonth();
          const isToday = sameDay(d, today);
          const isSelected = sameDay(d, selectedDate);
          return (
            <button key={i} onClick={() => onSelectDate(d)}
              style={{
                fontSize: 10, padding: "4px 0", borderRadius: 50,
                background: isSelected ? C.navy : isToday ? C.navyBg : "transparent",
                color: isSelected ? "#fff" : isOtherMonth ? C.textXs : isToday ? C.navy : C.textMd,
                border: "none", cursor: "pointer", fontFamily: "inherit",
                fontWeight: isSelected || isToday ? 700 : 400,
              }}>
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Vue grille horaire (Day/Week)
// ═══════════════════════════════════════════════════════════════════════════
function AgendaTimeGrid({ days, segmentsByDay, allDayByDay, colorPhase, now, onPhaseClick, updatePhase, salaries, absences, onCreate }) {
  const HOUR_START = 7;
  const HOUR_END = 20; // affiche jusqu'à 20h (mais scrollable)
  const HOUR_PX = 48;
  const SCROLL_HOUR_START = 0; // scrollable de 0h à 24h
  const SCROLL_HOUR_END = 24;
  const totalHours = SCROLL_HOUR_END - SCROLL_HOUR_START;
  const scrollRef = useRef(null);

  // Au mount : scroll à 7h
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (HOUR_START - SCROLL_HOUR_START) * HOUR_PX;
    }
  }, []);

  // Drag state pour move/resize/create
  const [drag, setDrag] = useState(null);
  const containerRef = useRef(null);

  function pxToMinutes(px) { return Math.round(px / HOUR_PX * 60 / 15) * 15; } // snap 15min

  function onPhaseMouseDown(e, seg, phase, dayIndex) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const startY = e.clientY;
    const startX = e.clientX;
    const segHeight = (seg.endMinutes - seg.startMinutes) / 60 * HOUR_PX;
    const isResize = (e.clientY - e.currentTarget.getBoundingClientRect().top) > segHeight - 8;
    let dragged = false;
    let lastDeltaY = 0;
    let lastDeltaX = 0;
    const moveHandler = (ev) => {
      const dy = ev.clientY - startY;
      const dx = ev.clientX - startX;
      if (!dragged && (Math.abs(dy) > 3 || Math.abs(dx) > 3)) {
        dragged = true;
        setDrag({ phase, mode: isResize ? "resize" : "move", deltaY: dy, deltaX: dx, segDayIndex: dayIndex });
      }
      if (dragged && (dy !== lastDeltaY || dx !== lastDeltaX)) {
        lastDeltaY = dy; lastDeltaX = dx;
        setDrag(d => d ? { ...d, deltaY: dy, deltaX: dx } : null);
      }
    };
    const upHandler = (ev) => {
      window.removeEventListener("mousemove", moveHandler);
      window.removeEventListener("mouseup", upHandler);
      if (!dragged) {
        onPhaseClick(phase, ev);
      } else {
        const dy = ev.clientY - startY;
        const dx = ev.clientX - startX;
        if (isResize) {
          // Resize : ajuste dureeHeures
          const deltaMin = pxToMinutes(dy);
          const newDureeMin = Math.max(15, (seg.endMinutes - seg.startMinutes) + deltaMin);
          const newDureeHeures = Math.round(newDureeMin / 60 * 4) / 4; // snap 15min
          updatePhase(phase.chantierId, phase.id, { dureeHeures: newDureeHeures, dureeJours: undefined });
        } else {
          // Move : ajuste dateDebut + heureDebut
          const dayWidth = containerRef.current ? containerRef.current.querySelector('[data-day-col="0"]')?.getBoundingClientRect().width || 100 : 100;
          const daysDelta = Math.round(dx / dayWidth);
          const newDate = new Date(phase.dateDebut + "T00:00:00");
          newDate.setDate(newDate.getDate() + daysDelta);
          const startMin = (() => {
            const h = phase.heureDebut || "08:00";
            const m = h.match(/^(\d{1,2}):(\d{2})$/);
            return m ? +m[1] * 60 + +m[2] : 8 * 60;
          })();
          const newStartMin = Math.max(0, Math.min(23 * 60 + 45, startMin + pxToMinutes(dy)));
          const hh = String(Math.floor(newStartMin / 60)).padStart(2, "0");
          const mm = String(newStartMin % 60).padStart(2, "0");
          updatePhase(phase.chantierId, phase.id, { dateDebut: fmtISO(newDate), heureDebut: `${hh}:${mm}` });
        }
      }
      setDrag(null);
    };
    window.addEventListener("mousemove", moveHandler);
    window.addEventListener("mouseup", upHandler);
  }

  // Click sur cellule vide → création
  function onGridClick(e, day) {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const totalMin = SCROLL_HOUR_START * 60 + Math.round(y / HOUR_PX * 60 / 60) * 60;
    const hh = String(Math.floor(totalMin / 60)).padStart(2, "0");
    const mm = "00";
    onCreate?.({ dateDebut: fmtISO(day), heureDebut: `${hh}:${mm}`, dureeHeures: 2 });
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayISO = fmtISO(now);
  const todayIndex = days.findIndex(d => fmtISO(d) === todayISO);

  return (
    <div ref={containerRef} style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: C.surface }}>
      {/* All-day events row */}
      <div style={{ display: "grid", gridTemplateColumns: `60px repeat(${days.length}, 1fr)`, borderBottom: `1px solid ${C.border}`, background: C.bg, minHeight: 32 }}>
        <div style={{ padding: "4px 6px", fontSize: 9, color: C.textXs, fontWeight: 600, textTransform: "uppercase", borderRight: `1px solid ${C.border}`, display: "flex", alignItems: "center" }}>All-day</div>
        {days.map((d, i) => {
          const events = allDayByDay.get(fmtISO(d)) || [];
          return (
            <div key={i} style={{ borderRight: i < days.length - 1 ? `1px solid ${C.border}` : "none", padding: 2, display: "flex", flexDirection: "column", gap: 2 }}>
              {events.map((ev, j) => {
                const bg = ev.type === "ferie" ? C.greenBg : ev.motif === "maladie" ? C.redBg : C.blueBg;
                const fg = ev.type === "ferie" ? C.green : ev.motif === "maladie" ? C.red : C.blue;
                const emoji = ev.type === "ferie" ? "🇫🇷" : ev.motif === "maladie" ? "🤒" : ev.motif === "conges_payes" ? "🌴" : ev.motif === "rtt" ? "💼" : "📅";
                return (
                  <div key={j} style={{ background: bg, color: fg, padding: "2px 6px", borderRadius: 3, fontSize: 10, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {emoji} {ev.label}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Header jours */}
      <div style={{ display: "grid", gridTemplateColumns: `60px repeat(${days.length}, 1fr)`, borderBottom: `1px solid ${C.border}`, background: C.surface, position: "sticky", top: 0, zIndex: 10 }}>
        <div />
        {days.map((d, i) => {
          const isToday = sameDay(d, now);
          return (
            <div key={i} style={{ padding: "8px 6px", textAlign: "center", borderLeft: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: isToday ? C.blue : C.textSm, textTransform: "uppercase" }}>{JOURS_FR_LONG[d.getDay()]}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: isToday ? C.blue : C.text }}>{d.getDate()}</div>
            </div>
          );
        })}
      </div>

      {/* Grille horaire scrollable */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: `60px repeat(${days.length}, 1fr)`, position: "relative", height: totalHours * HOUR_PX }}>
          {/* Colonne heures */}
          <div style={{ borderRight: `1px solid ${C.border}` }}>
            {Array.from({ length: totalHours }, (_, i) => {
              const h = SCROLL_HOUR_START + i;
              return (
                <div key={i} style={{ height: HOUR_PX, padding: "2px 6px", fontSize: 10, color: C.textSm, borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
                  {String(h).padStart(2, "0")}:00
                </div>
              );
            })}
          </div>
          {/* Colonnes jours */}
          {days.map((d, dayIdx) => {
            const segs = segmentsByDay.get(fmtISO(d)) || [];
            return (
              <div key={dayIdx} data-day-col={dayIdx}
                onClick={(e) => onGridClick(e, d)}
                style={{ borderLeft: `1px solid ${C.border}`, position: "relative", cursor: "pointer" }}>
                {/* Lignes heures de fond */}
                {Array.from({ length: totalHours }, (_, i) => (
                  <div key={i} style={{ position: "absolute", left: 0, right: 0, top: i * HOUR_PX, height: 1, background: C.border, opacity: 0.5, pointerEvents: "none" }} />
                ))}
                {/* Lignes 30min */}
                {Array.from({ length: totalHours }, (_, i) => (
                  <div key={`half-${i}`} style={{ position: "absolute", left: 0, right: 0, top: i * HOUR_PX + HOUR_PX / 2, height: 1, background: C.border, opacity: 0.2, pointerEvents: "none" }} />
                ))}
                {/* Now line si aujourd'hui */}
                {dayIdx === todayIndex && nowMinutes >= SCROLL_HOUR_START * 60 && nowMinutes <= SCROLL_HOUR_END * 60 && (
                  <div style={{ position: "absolute", left: 0, right: 0, top: ((nowMinutes - SCROLL_HOUR_START * 60) / 60) * HOUR_PX, height: 2, background: C.red, zIndex: 4, pointerEvents: "none" }}>
                    <div style={{ position: "absolute", left: -5, top: -4, width: 10, height: 10, borderRadius: "50%", background: C.red }} />
                  </div>
                )}
                {/* Segments tâches */}
                {segs.map((seg, segIdx) => {
                  const top = ((seg.startMinutes - SCROLL_HOUR_START * 60) / 60) * HOUR_PX;
                  const height = ((seg.endMinutes - seg.startMinutes) / 60) * HOUR_PX;
                  const color = colorPhase(seg.phase);
                  const isDragged = drag && drag.phase.id === seg.phase.id;
                  const dragOffsetY = isDragged && drag.mode === "move" ? drag.deltaY : 0;
                  const dragOffsetX = isDragged && drag.mode === "move" ? drag.deltaX : 0;
                  const heightAdjust = isDragged && drag.mode === "resize" ? drag.deltaY : 0;
                  return (
                    <div key={segIdx}
                      onMouseDown={(e) => onPhaseMouseDown(e, seg, seg.phase, dayIdx)}
                      onClick={e => e.stopPropagation()}
                      style={{
                        position: "absolute",
                        left: 2 + dragOffsetX, right: 2,
                        top: top + dragOffsetY,
                        height: Math.max(20, height + heightAdjust),
                        background: color,
                        opacity: isDragged ? 0.7 : 0.92,
                        color: "#fff",
                        borderRadius: 4,
                        padding: "2px 6px",
                        fontSize: 10,
                        fontWeight: 600,
                        cursor: drag?.mode === "resize" ? "ns-resize" : "pointer",
                        overflow: "hidden",
                        boxShadow: isDragged ? "0 4px 12px rgba(0,0,0,0.25)" : "0 1px 2px rgba(0,0,0,0.1)",
                        zIndex: isDragged ? 5 : 2,
                        userSelect: "none",
                      }}>
                      <div style={{ fontSize: 9, opacity: 0.9 }}>
                        {String(Math.floor(seg.startMinutes / 60)).padStart(2, "0")}:{String(seg.startMinutes % 60).padStart(2, "0")} - {String(Math.floor(seg.endMinutes / 60)).padStart(2, "0")}:{String(seg.endMinutes % 60).padStart(2, "0")}
                      </div>
                      <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{seg.phase.tache || "Tâche"}</div>
                      <div style={{ fontSize: 9, opacity: 0.85, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{seg.phase.chantierNom}</div>
                      {/* Resize handle */}
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 6, cursor: "ns-resize", background: "rgba(255,255,255,0.2)" }} />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Vue mois (grille classique)
// ═══════════════════════════════════════════════════════════════════════════
function AgendaMonthView({ days, cursorMonth, segmentsByDay, allDayByDay, colorPhase, now, onPhaseClick, onCellClick }) {
  return (
    <div style={{ flex: 1, overflow: "auto", background: C.surface }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: `1px solid ${C.border}`, background: C.bg }}>
        {JOURS_FR.map((l, i) => (
          <div key={l} style={{ padding: "8px 6px", fontSize: 11, fontWeight: 700, color: i >= 5 ? C.red : C.textMd, textAlign: "center", textTransform: "uppercase" }}>{l}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gridAutoRows: "minmax(110px,auto)" }}>
        {days.map((d, i) => {
          const iso = fmtISO(d);
          const isOtherMonth = d.getMonth() !== cursorMonth;
          const isToday = sameDay(d, now);
          const isWE = d.getDay() === 0 || d.getDay() === 6;
          const segs = segmentsByDay.get(iso) || [];
          const allDay = allDayByDay.get(iso) || [];
          const hasFerieToday = allDay.some(e => e.type === "ferie");
          const showMax = 3;
          const hidden = segs.length > showMax ? segs.length - showMax : 0;
          return (
            <div key={iso}
              onClick={() => onCellClick(d)}
              style={{
                position: "relative",
                borderRight: (i % 7 < 6) ? `1px solid ${C.border}` : "none",
                borderBottom: `1px solid ${C.border}`,
                background: hasFerieToday ? C.greenBg : isWE ? C.bg : C.surface,
                opacity: isOtherMonth ? 0.5 : 1,
                padding: "4px 6px", cursor: "pointer", overflow: "hidden",
                outline: isToday ? `2px solid ${C.blue}` : "none",
                outlineOffset: -2,
              }}>
              <div style={{ fontSize: 11, fontWeight: isToday ? 800 : 600, color: isToday ? C.blue : isWE ? C.red : C.text, marginBottom: 3 }}>{d.getDate()}</div>
              {allDay.slice(0, 1).map((ev, j) => (
                <div key={`ad-${j}`} style={{ background: ev.type === "ferie" ? C.green : C.red, color: "#fff", borderRadius: 3, padding: "1px 5px", fontSize: 9, fontWeight: 600, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ev.type === "ferie" ? `🇫🇷 ${ev.label}` : `${ev.motif === "maladie" ? "🤒" : ev.motif === "conges_payes" ? "🌴" : ev.motif === "rtt" ? "💼" : "📅"} ${ev.label}`}
                </div>
              ))}
              {segs.slice(0, showMax).map((seg, j) => {
                const c = colorPhase(seg.phase);
                return (
                  <div key={j} onClick={(e) => { e.stopPropagation(); onPhaseClick(seg.phase, e); }}
                    style={{ background: c, color: "#fff", borderRadius: 3, padding: "1px 5px", fontSize: 9, fontWeight: 600, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }}>
                    {seg.phase.tache}
                  </div>
                );
              })}
              {hidden > 0 && (
                <div style={{ fontSize: 9, color: C.blue, fontWeight: 600 }}>+{hidden} autre{hidden > 1 ? "s" : ""}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Popover détails phase (style Google Cal)
// ═══════════════════════════════════════════════════════════════════════════
function AgendaPopover({ phase, chantierId, x, y, color, salaries, sousTraitants, onClose, onEdit, onDelete }) {
  // Repositionne le popover dans le viewport
  const [pos, setPos] = useState({ x, y });
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    let nx = x + 12, ny = y + 12;
    if (nx + rect.width > window.innerWidth - 8) nx = window.innerWidth - rect.width - 8;
    if (ny + rect.height > window.innerHeight - 8) ny = window.innerHeight - rect.height - 8;
    setPos({ x: nx, y: ny });
  }, [x, y]);

  const sals = (phase.salariesIds || []).map(id => salaries.find(s => s.id === id)).filter(Boolean);
  const sts = (phase.sousTraitantsIds || []).map(id => sousTraitants.find(s => s.id === id)).filter(Boolean);
  const dh = +phase.dureeHeures || 0;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1500 }} />
      <div ref={ref} style={{ position: "fixed", left: pos.x, top: pos.y, background: C.surface, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.18)", padding: 16, width: 320, zIndex: 1501, border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
          <div style={{ width: 4, alignSelf: "stretch", background: color, borderRadius: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{phase.tache || "Tâche"}</div>
            <div style={{ fontSize: 11, color: C.textSm, marginTop: 2 }}>📍 {phase.chantierNom}</div>
          </div>
          <button onClick={onClose} title="Fermer" style={{ background: "transparent", border: "none", cursor: "pointer", color: C.textSm, fontSize: 18, padding: 0, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: C.textMd, marginBottom: 12 }}>
          <div>📅 {phase.dateDebut}{phase.heureDebut ? ` à ${phase.heureDebut}` : ""}</div>
          {dh > 0 && <div>⏱ {dh}h estimées</div>}
          {phase.budgetHT > 0 && <div>💰 Budget : {phase.budgetHT}€</div>}
          {(+phase.avancement > 0) && <div>📊 Avancement : {phase.avancement}%</div>}
          {sals.length > 0 && <div>👷 {sals.map(s => s.nom).join(", ")}</div>}
          {sts.length > 0 && <div>🤝 {sts.map(s => s.nom).join(", ")}</div>}
          {phase.notes && <div style={{ marginTop: 4, padding: "6px 8px", background: C.bg, borderRadius: 5, fontSize: 11, fontStyle: "italic" }}>{phase.notes}</div>}
        </div>
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
          <button onClick={() => onDelete(phase)} style={{ padding: "6px 10px", border: `1px solid ${C.border}`, background: C.surface, color: C.red, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>🗑 Supprimer</button>
          <button onClick={() => onEdit(phase)} style={{ padding: "6px 10px", border: "none", background: C.blue, color: "#fff", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>✏️ Modifier</button>
        </div>
      </div>
    </>
  );
}
