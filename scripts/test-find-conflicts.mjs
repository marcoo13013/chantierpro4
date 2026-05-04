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

// ─── Récap ──
console.log("\n══════════════════════════════════════════════════════════════");
const passed = tests.filter(t => t.pass).length;
const total = tests.length;
console.log(`Résultat : ${passed}/${total} tests réussis`);
console.log(passed === total ? "✅ Helper findSalarieConflicts fonctionne correctement." : "❌ Bug détecté — voir détails ci-dessus.");
process.exit(passed === total ? 0 : 1);
