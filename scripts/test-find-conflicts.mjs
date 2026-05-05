// Test isolé du helper findSalarieConflicts (copié-collé verbatim depuis App.jsx
// pour vérifier la logique sans React/JSX).
// Run : node scripts/test-find-conflicts.mjs

function findSalarieConflicts(salId, candidate, candidateChantierId, allChantiers) {
  if (!candidate?.dateDebut) return [];
  const cs = new Date(candidate.dateDebut + "T00:00:00");
  if (isNaN(cs)) return [];
  const ce = new Date(cs); ce.setDate(ce.getDate() + (+candidate.dureeJours || 1) - 1);
  const out = [];
  for (const c of (allChantiers || [])) {
    for (const p of (c.planning || [])) {
      if (c.id === candidateChantierId && candidate.id && p.id === candidate.id) continue;
      if (!Array.isArray(p.salariesIds) || !p.salariesIds.includes(salId)) continue;
      if (!p.dateDebut) continue;
      const ps = new Date(p.dateDebut + "T00:00:00");
      if (isNaN(ps)) continue;
      const pe = new Date(ps); pe.setDate(pe.getDate() + (+p.dureeJours || 1) - 1);
      if (cs <= pe && ps <= ce) {
        out.push({
          chantierId: c.id,
          chantierNom: c.nom || `#${c.id}`,
          phaseLib: p.tache || "phase",
          dateDebut: p.dateDebut,
          dureeJours: +p.dureeJours || 1,
        });
      }
    }
  }
  return out;
}

// ─── Données de test simulant ta capture (12/05/2026) ──────────────────────
const REMI = "remi-uuid-001";
const MANOEUVRE = "manoeuvre-uuid-002";
const AUTRE = "autre-uuid-003";

const chantiers = [
  {
    id: 1,
    nom: "DEV-83211",
    planning: [
      // Phase A : Rémi + Manœuvre du 10 au 14/05 (couvre le 12)
      { id: 100, tache: "Maçonnerie sous-sol", dateDebut: "2026-05-10", dureeJours: 5,
        salariesIds: [REMI, MANOEUVRE] },
    ],
  },
  {
    id: 2,
    nom: "DEV-45239",
    planning: [
      // Phase B : Rémi du 11 au 13/05 (chevauche le 12 avec phase A)
      { id: 200, tache: "Carrelage salle de bain", dateDebut: "2026-05-11", dureeJours: 3,
        salariesIds: [REMI] },
    ],
  },
  {
    id: 3,
    nom: "DEV-99999",
    planning: [
      // Phase C : sans rapport, en juin
      { id: 300, tache: "Peinture", dateDebut: "2026-06-01", dureeJours: 5,
        salariesIds: [AUTRE] },
    ],
  },
];

const tests = [];
function check(label, expected, actual) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  tests.push({ label, pass, expected, actual });
  console.log(`${pass ? "✅" : "❌"} ${label}`);
  if (!pass) {
    console.log("   attendu :", JSON.stringify(expected, null, 2));
    console.log("   reçu    :", JSON.stringify(actual, null, 2));
  }
}

// ─── Scénario 1 : assigner Rémi sur une nouvelle phase chantier 4 le 12/05 ──
console.log("\n── Test 1 : Rémi → nouvelle phase 12/05 sur un 4ème chantier ──");
const conflicts1 = findSalarieConflicts(
  REMI,
  { dateDebut: "2026-05-12", dureeJours: 1 },  // pas d'id → nouvelle phase
  4,                                              // nouveau chantier
  chantiers
);
check(
  "Rémi a 2 conflits (DEV-83211 phase A + DEV-45239 phase B)",
  2,
  conflicts1.length
);
console.log("   Conflits détectés :", conflicts1.map(c => `${c.chantierNom}/${c.phaseLib}`).join(" + "));

// ─── Scénario 2 : assigner Manœuvre sur nouvelle phase 12/05 ──
console.log("\n── Test 2 : Manœuvre → nouvelle phase 12/05 ──");
const conflicts2 = findSalarieConflicts(
  MANOEUVRE,
  { dateDebut: "2026-05-12", dureeJours: 1 },
  4,
  chantiers
);
check("Manœuvre a 1 conflit (DEV-83211 phase A)", 1, conflicts2.length);
console.log("   Conflits détectés :", conflicts2.map(c => `${c.chantierNom}/${c.phaseLib}`).join(" + "));

// ─── Scénario 3 : Rémi sur 2026-05-15 (Phase A finie le 14, Phase B finie le 13) ──
console.log("\n── Test 3 : Rémi → phase 15/05 (après les 2 autres) ──");
const conflicts3 = findSalarieConflicts(
  REMI,
  { dateDebut: "2026-05-15", dureeJours: 2 },
  4,
  chantiers
);
check("Aucun conflit si on évite la période chargée", 0, conflicts3.length);

// ─── Scénario 4 : édition d'une phase existante (skip self) ──
console.log("\n── Test 4 : édition de Phase A pour étendre durée à 7 jours ──");
const conflicts4 = findSalarieConflicts(
  REMI,
  { id: 100, dateDebut: "2026-05-10", dureeJours: 7 },  // même id que phase 100
  1,                                                       // même chantier
  chantiers
);
check(
  "Phase A skip self → seul conflit avec Phase B (DEV-45239)",
  1,
  conflicts4.length
);
console.log("   Conflit détecté :", conflicts4.map(c => `${c.chantierNom}/${c.phaseLib}`).join(""));

// ─── Scénario 5 : chevauchement d'1 seul jour ──
console.log("\n── Test 5 : chevauchement d'un seul jour (le 14) ──");
const conflicts5 = findSalarieConflicts(
  REMI,
  { dateDebut: "2026-05-14", dureeJours: 3 },  // 14, 15, 16
  4,
  chantiers
);
check(
  "Conflit Phase A le 14 uniquement (Phase A finit le 14)",
  1,
  conflicts5.length
);

// ─── Scénario 6 : Rémi sur même chantier, autre phase, même période ──
console.log("\n── Test 6 : Rémi déjà sur Phase A (chantier 1) + Phase B (chantier 2), nouvelle phase chantier 1 le 12/05 ──");
const conflicts6 = findSalarieConflicts(
  REMI,
  { dateDebut: "2026-05-12", dureeJours: 2 },  // pas d'id, sur chantier 1
  1,
  chantiers
);
check(
  "2 conflits : Phase A même chantier + Phase B chantier différent (les deux comptent)",
  2,
  conflicts6.length
);
console.log("   Conflits détectés :", conflicts6.map(c => `${c.chantierNom}/${c.phaseLib}`).join(" + "));

// ─── Scénario 7 : assigner exactement le 12/05 (1 jour) ──
console.log("\n── Test 7 : Rémi → phase 1 jour pile le 12/05 (cas le plus serré) ──");
const conflicts7 = findSalarieConflicts(
  REMI,
  { dateDebut: "2026-05-12", dureeJours: 1 },
  4,
  chantiers
);
check(
  "Détecte les 2 phases qui couvrent le 12/05 même pour 1 seul jour",
  2,
  conflicts7.length
);

// ─── Helper findSalarieAbsenceConflicts (sprint planning #3) ────────────────
function findSalarieAbsenceConflicts(salId, candidate, absences) {
  if (!candidate?.dateDebut || !Array.isArray(absences)) return [];
  const cs = new Date(candidate.dateDebut + "T00:00:00");
  if (isNaN(cs)) return [];
  const ce = new Date(cs); ce.setDate(ce.getDate() + (+candidate.dureeJours || 1) - 1);
  const out = [];
  for (const a of absences) {
    if (String(a.ouvrier_id) !== String(salId)) continue;
    if (!a.date_debut || !a.date_fin) continue;
    const as = new Date(a.date_debut + "T00:00:00");
    const ae = new Date(a.date_fin + "T00:00:00");
    if (isNaN(as) || isNaN(ae)) continue;
    if (cs <= ae && as <= ce) out.push(a);
  }
  return out;
}

function estJourAbsent(dateISO, salId, absences) {
  if (!dateISO || !Array.isArray(absences)) return null;
  for (const a of absences) {
    if (String(a.ouvrier_id) !== String(salId)) continue;
    if (!a.date_debut || !a.date_fin) continue;
    if (dateISO >= a.date_debut && dateISO <= a.date_fin) return a;
  }
  return null;
}

// ─── Données de test absences ──
const absences = [
  // Rémi : maladie 13-15 mai (1 jour de chevauchement avec phase A et B)
  { id: 1, ouvrier_id: REMI, date_debut: "2026-05-13", date_fin: "2026-05-15", motif: "maladie", commentaire: "Grippe" },
  // Manœuvre : congés 20-25 mai (hors planning existant)
  { id: 2, ouvrier_id: MANOEUVRE, date_debut: "2026-05-20", date_fin: "2026-05-25", motif: "conges_payes" },
  // Autre : RTT le 12 mai exact (1 jour)
  { id: 3, ouvrier_id: AUTRE, date_debut: "2026-05-12", date_fin: "2026-05-12", motif: "rtt" },
];

console.log("\n══════════════════════════════════════════════════════════════");
console.log("══ Tests findSalarieAbsenceConflicts (étape 3 sprint planning) ══");
console.log("══════════════════════════════════════════════════════════════");

// ─── Scénario 8 : Rémi → phase 14/05, durée 1j ─ chevauche absence maladie ──
console.log("\n── Test 8 : Rémi → phase 14/05 (1j) — chevauche maladie 13-15 ──");
const abs8 = findSalarieAbsenceConflicts(REMI, { dateDebut: "2026-05-14", dureeJours: 1 }, absences);
check("Rémi a 1 conflit absence (maladie)", 1, abs8.length);
check("Motif détecté = maladie", "maladie", abs8[0]?.motif);

// ─── Scénario 9 : Rémi → phase 16/05, durée 1j ─ APRÈS la maladie ──
console.log("\n── Test 9 : Rémi → phase 16/05 (1j) — après la maladie ──");
const abs9 = findSalarieAbsenceConflicts(REMI, { dateDebut: "2026-05-16", dureeJours: 1 }, absences);
check("Aucun conflit absence si après la fin", 0, abs9.length);

// ─── Scénario 10 : Rémi → phase couvrant TOUTE la période d'absence ──
console.log("\n── Test 10 : Rémi → phase 10/05 durée 10j — couvre l'absence ──");
const abs10 = findSalarieAbsenceConflicts(REMI, { dateDebut: "2026-05-10", dureeJours: 10 }, absences);
check("Conflit détecté quand phase englobe l'absence", 1, abs10.length);

// ─── Scénario 11 : Manœuvre → phase 22/05 (en plein milieu congés) ──
console.log("\n── Test 11 : Manœuvre → phase 22/05 (1j) — pendant congés payés 20-25 ──");
const abs11 = findSalarieAbsenceConflicts(MANOEUVRE, { dateDebut: "2026-05-22", dureeJours: 1 }, absences);
check("Conflit congés payés détecté", 1, abs11.length);
check("Motif = conges_payes", "conges_payes", abs11[0]?.motif);

// ─── Scénario 12 : estJourAbsent — Autre le 12/05 ──
console.log("\n── Test 12 : estJourAbsent — Autre le 12/05 (1 jour de RTT) ──");
const day12 = estJourAbsent("2026-05-12", AUTRE, absences);
check("Autre absent le 12/05 (RTT)", "rtt", day12?.motif);
const day13 = estJourAbsent("2026-05-13", AUTRE, absences);
check("Autre PAS absent le 13/05 (RTT 1 jour)", null, day13);

// ─── Scénario 13 : assigner ouvrier sain → 0 absence ──
console.log("\n── Test 13 : ouvrier sans absence ─ pas de conflit ──");
const abs13 = findSalarieAbsenceConflicts("inconnu-id", { dateDebut: "2026-05-12", dureeJours: 1 }, absences);
check("Ouvrier sans absence → liste vide", 0, abs13.length);

// ─── Helpers refonte sprint #5 — durée tâches en heures ─────────────────
const HEURES_PRODUCTIVES_JOUR_DEFAULT = 7;
function heuresJourSal(s) {
  if (Array.isArray(s?.horaires_travail)) {
    let totalMin = 0;
    for (const p of s.horaires_travail) {
      const m = (str) => {
        const mt = String(str || "").match(/^(\d{1,2}):(\d{2})$/);
        return mt ? +mt[1] * 60 + +mt[2] : null;
      };
      const d = m(p?.debut), f = m(p?.fin);
      if (d != null && f != null && f > d) totalMin += f - d;
    }
    return Math.round(totalMin / 6) / 10;
  }
  return HEURES_PRODUCTIVES_JOUR_DEFAULT;
}
function getDureeHeures(tache, salaries) {
  const h = +tache?.dureeHeures;
  if (h > 0) return h;
  const assignes = (tache?.salariesIds || []).map(id => (salaries || []).find(s => s.id === id)).filter(Boolean);
  const capa = assignes.length === 0 ? HEURES_PRODUCTIVES_JOUR_DEFAULT : assignes.reduce((a, s) => a + heuresJourSal(s), 0);
  return Math.max(0, (+tache?.dureeJours || 1) * capa);
}
function capaJourTache(tache, salaries) {
  const assignes = (tache?.salariesIds || []).map(id => (salaries || []).find(s => s.id === id)).filter(Boolean);
  if (assignes.length === 0) return HEURES_PRODUCTIVES_JOUR_DEFAULT;
  return assignes.reduce((a, s) => a + heuresJourSal(s), 0);
}
function fmtISODateLocal(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
function calculerEtalementTache(tache, salaries, absences = []) {
  const heuresTotal = getDureeHeures(tache, salaries);
  if (heuresTotal <= 0 || !tache?.dateDebut) return { dureeJours: 0, joursDetail: [], dateFin: tache?.dateDebut || null, heuresJourFin: 0, capaJour: 0 };
  const capaJour = capaJourTache(tache, salaries);
  if (capaJour <= 0) return { dureeJours: 0, joursDetail: [], dateFin: tache.dateDebut, heuresJourFin: 0, capaJour: 0 };
  const start = new Date(tache.dateDebut + "T00:00:00");
  if (isNaN(start)) return { dureeJours: 0, joursDetail: [], dateFin: tache.dateDebut, heuresJourFin: 0, capaJour };
  const assignes = (tache.salariesIds || []).map(id => (salaries || []).find(s => s.id === id)).filter(Boolean);
  let restant = heuresTotal;
  const joursDetail = [];
  const cursor = new Date(start);
  let safety = 400;
  while (restant > 0.01 && safety-- > 0) {
    const day = cursor.getDay();
    const iso = fmtISODateLocal(cursor);
    const isWE = day === 0 || day === 6;
    const tousAbsents = false; // simplification pour tests : pas d'absences dans ces scénarios
    if (!isWE && !tousAbsents) {
      const heuresCeJour = Math.min(restant, capaJour);
      joursDetail.push({ date: iso, heuresUtilisees: Math.round(heuresCeJour * 100) / 100 });
      restant -= heuresCeJour;
    }
    if (restant > 0.01) cursor.setDate(cursor.getDate() + 1);
  }
  const last = joursDetail[joursDetail.length - 1];
  return { dureeJours: joursDetail.length, joursDetail, dateFin: last ? last.date : tache.dateDebut, heuresJourFin: last ? last.heuresUtilisees : 0, capaJour };
}

console.log("\n══════════════════════════════════════════════════════════════");
console.log("══ Tests calculerEtalementTache (sprint #5 — durée en heures) ");
console.log("══════════════════════════════════════════════════════════════");

const sal7h = { id: "sal-7h", horaires_travail: [{ debut: "08:00", fin: "12:00" }, { debut: "13:00", fin: "16:00" }] }; // 7h/j
const sal8h = { id: "sal-8h", horaires_travail: [{ debut: "08:00", fin: "12:00" }, { debut: "13:00", fin: "17:00" }] }; // 8h/j
const salariesTest = [sal7h, sal8h];

// ─── Scénario 14 : 1 ouvrier 7h/j, tâche 10h ──
console.log("\n── Test 14 : ouvrier 7h/j, tâche 10h depuis lundi ──");
const e14 = calculerEtalementTache({ dateDebut: "2026-05-04", dureeHeures: 10, salariesIds: ["sal-7h"] }, salariesTest);
check("dureeJours = 2", 2, e14.dureeJours);
check("heuresJourFin = 3 (10 - 7)", 3, e14.heuresJourFin);
check("dateFin = 2026-05-05 (mardi)", "2026-05-05", e14.dateFin);

// ─── Scénario 15 : 2 ouvriers (somme = 15h), tâche 14h → 1 jour ──
console.log("\n── Test 15 : 2 ouvriers (7h+8h=15h capa), tâche 14h ──");
const e15 = calculerEtalementTache({ dateDebut: "2026-05-04", dureeHeures: 14, salariesIds: ["sal-7h", "sal-8h"] }, salariesTest);
check("dureeJours = 1 (14h ≤ 15h capa)", 1, e15.dureeJours);
check("heuresJourFin = 14", 14, e15.heuresJourFin);

// ─── Scénario 16 : tâche 50h, ouvrier 7h/j, doit skip WE ──
console.log("\n── Test 16 : tâche 50h, 1 ouvrier 7h/j, skip week-end ──");
const e16 = calculerEtalementTache({ dateDebut: "2026-05-04", dureeHeures: 50, salariesIds: ["sal-7h"] }, salariesTest);
// 50/7 = 7.14 → 7 jours pleins (49h) + 1 jour partiel (1h) = 8 jours
// Lundi 04 → vendredi 08 (5j × 7h = 35h, reste 15h) → samedi/dimanche skip → lun 11 (42h, reste 8h) → mar 12 (49h, reste 1h) → mer 13 (50h, reste 0)
check("dureeJours = 8 (50h/7h, skip 1 weekend)", 8, e16.dureeJours);
check("dateFin = mercredi 13/05", "2026-05-13", e16.dateFin);
check("heuresJourFin = 1", 1, e16.heuresJourFin);

// ─── Scénario 17 : aucun ouvrier assigné, tâche 14h ──
console.log("\n── Test 17 : aucun ouvrier, tâche 14h (capa default 7h) ──");
const e17 = calculerEtalementTache({ dateDebut: "2026-05-04", dureeHeures: 14, salariesIds: [] }, salariesTest);
check("dureeJours = 2 (capa default 7h)", 2, e17.dureeJours);

// ─── Scénario 18 : rétro-compat dureeJours sans dureeHeures ──
console.log("\n── Test 18 : rétro-compat dureeJours=2, ouvrier 7h → 14h calculées ──");
const e18 = calculerEtalementTache({ dateDebut: "2026-05-04", dureeJours: 2, salariesIds: ["sal-7h"] }, salariesTest);
check("getDureeHeures rétro-compat = 14h", 14, getDureeHeures({ dureeJours: 2, salariesIds: ["sal-7h"] }, salariesTest));
check("dureeJours = 2 après étalement", 2, e18.dureeJours);

// ─── Scénario 19 : 3h sur ouvrier 7h/j (moins d'une journée) ──
console.log("\n── Test 19 : tâche 3h, ouvrier 7h/j ──");
const e19 = calculerEtalementTache({ dateDebut: "2026-05-04", dureeHeures: 3, salariesIds: ["sal-7h"] }, salariesTest);
check("dureeJours = 1 (3h < 7h capa)", 1, e19.dureeJours);
check("heuresJourFin = 3", 3, e19.heuresJourFin);

// ─── Récap ──
console.log("\n══════════════════════════════════════════════════════════════");
const passed = tests.filter(t => t.pass).length;
const total = tests.length;
console.log(`Résultat : ${passed}/${total} tests réussis`);
console.log(passed === total ? "✅ Helpers conflits + absences + étalement durée tâches OK." : "❌ Bug détecté — voir détails ci-dessus.");
process.exit(passed === total ? 0 : 1);
