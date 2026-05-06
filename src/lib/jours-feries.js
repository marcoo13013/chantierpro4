// ═══════════════════════════════════════════════════════════════════════════
// Jours fériés français — ChantierPro
// ═══════════════════════════════════════════════════════════════════════════
// Calcul Pâques par algorithme de Gauss + dates fixes. Renvoie un Map
// dateISO → label utilisable dans Gantt, Agenda, Calendar.
// ═══════════════════════════════════════════════════════════════════════════

// Algorithme Gauss (Pâques grégorien)
function paques(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function fmtISO(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// Retourne un Map<ISO, {label, type}> pour 1 année donnée.
export function joursFeriesFRMap(year) {
  const p = paques(year);
  const items = [
    { date: new Date(year, 0, 1), label: "Jour de l'An" },
    { date: addDays(p, 1), label: "Lundi de Pâques" },
    { date: new Date(year, 4, 1), label: "Fête du Travail" },
    { date: new Date(year, 4, 8), label: "Victoire 1945" },
    { date: addDays(p, 39), label: "Ascension" },
    { date: addDays(p, 50), label: "Lundi de Pentecôte" },
    { date: new Date(year, 6, 14), label: "Fête nationale" },
    { date: new Date(year, 7, 15), label: "Assomption" },
    { date: new Date(year, 10, 1), label: "Toussaint" },
    { date: new Date(year, 10, 11), label: "Armistice 1918" },
    { date: new Date(year, 11, 25), label: "Noël" },
  ];
  const m = new Map();
  for (const it of items) m.set(fmtISO(it.date), { label: it.label, type: "ferie" });
  return m;
}

// Retourne un Set d'ISO pour la plage donnée (compat ancien code Gantt).
export function joursFeriesFR(yearsRange) {
  const out = new Set();
  for (const y of yearsRange) {
    for (const k of joursFeriesFRMap(y).keys()) out.add(k);
  }
  return out;
}

// Ferié à une date donnée (label ou null).
export function getFerieLabel(dateISO) {
  if (!dateISO || dateISO.length < 10) return null;
  const year = +dateISO.slice(0, 4);
  if (!Number.isFinite(year)) return null;
  const m = joursFeriesFRMap(year);
  return m.get(dateISO)?.label || null;
}
