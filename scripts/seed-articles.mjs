// ═══════════════════════════════════════════════════════════════════════════
// scripts/seed-articles.mjs — exécute le seed articles_catalogue en prod
// ═══════════════════════════════════════════════════════════════════════════
// Lit supabase/seeds/articles_catalogue_seed.sql, parse les VALUES (...),
// insère via supabase-js (service_role bypass RLS).
// Garde-fou : si la table contient déjà des articles globaux, on n'insère pas.
//
// Usage : node scripts/seed-articles.mjs
// Env requis : VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (.env.production.local)
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

// ── 1. Charger les env vars depuis .env.production.local (KEY=VALUE)
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const envFile = resolve(ROOT, ".env.production.local");
const envText = readFileSync(envFile, "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      let v = l.slice(i + 1);
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      return [l.slice(0, i), v];
    })
);

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("✗ VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans .env.production.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── 2. Parse seed SQL → rows
const seedPath = resolve(ROOT, "supabase/seeds/articles_catalogue_seed.sql");
const sql = readFileSync(seedPath, "utf8");

// Extraire les tuples : on prend les lignes commençant par "(" et finissant par "),"
// (ou "(...)" suivi de ");" pour la dernière). Les apostrophes dans les chaînes
// SQL sont échappées en "''". On parse avec une mini state-machine.
const COLS = ["libelle", "categorie", "sous_categorie", "unite", "prix_achat_ht", "fournisseur_default", "conditionnement", "tva_pct"];

function parseTuple(line) {
  // line ressemble à : ('Bonde Ø90', 'Plomberie', 'Bonde', 'U', 28.00, 'Point P', 'Pièce', 20)
  // On parse champ par champ.
  const fields = [];
  let i = 0;
  // skip leading '('
  while (i < line.length && line[i] !== "(") i++;
  if (line[i] !== "(") return null;
  i++;
  while (i < line.length) {
    while (i < line.length && /\s|,/.test(line[i])) i++;
    if (line[i] === ")") break;
    if (line[i] === "'") {
      i++;
      let s = "";
      while (i < line.length) {
        if (line[i] === "'" && line[i + 1] === "'") { s += "'"; i += 2; continue; }
        if (line[i] === "'") { i++; break; }
        s += line[i]; i++;
      }
      fields.push(s);
    } else {
      // numérique ou NULL
      let n = "";
      while (i < line.length && !/[,)]/.test(line[i])) { n += line[i]; i++; }
      n = n.trim();
      fields.push(n.toUpperCase() === "NULL" ? null : Number(n));
    }
  }
  return fields;
}

const rows = [];
for (const rawLine of sql.split(/\r?\n/)) {
  const t = rawLine.trim();
  if (!t.startsWith("(")) continue;
  if (!/\),?$|\);$/.test(t)) continue;
  const fields = parseTuple(t);
  if (!fields || fields.length !== COLS.length) {
    console.warn("→ ligne ignorée (parse incomplet):", t.slice(0, 80));
    continue;
  }
  const row = {};
  COLS.forEach((c, idx) => { row[c] = fields[idx]; });
  row.user_id = null;        // catalogue partagé global
  row.actif = true;
  rows.push(row);
}

console.log(`✓ Seed parsé : ${rows.length} articles prêts à insérer`);

// ── 3. Garde-fou : si déjà peuplé, abort
const { count: existing, error: countErr } = await supabase
  .from("articles_catalogue")
  .select("*", { count: "exact", head: true })
  .is("user_id", null);

if (countErr) {
  console.error("✗ Erreur count :", countErr);
  process.exit(1);
}

if (existing && existing > 0) {
  console.error(`✗ Catalogue déjà peuplé (${existing} articles globaux). Abort pour éviter les doublons.`);
  console.error('  Pour forcer un re-seed : TRUNCATE puis relancer ce script.');
  process.exit(1);
}

console.log(`→ Catalogue vide, insertion en cours…`);

// ── 4. Insert par batch de 100
const BATCH = 100;
let inserted = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const { error } = await supabase.from("articles_catalogue").insert(batch);
  if (error) {
    console.error(`✗ Erreur batch ${i}-${i + batch.length}:`, error);
    process.exit(1);
  }
  inserted += batch.length;
  console.log(`  ✓ Batch ${Math.floor(i / BATCH) + 1} : ${inserted}/${rows.length}`);
}

// ── 5. Vérification finale
const { count: finalCount, error: finalErr } = await supabase
  .from("articles_catalogue")
  .select("*", { count: "exact", head: true })
  .is("user_id", null);

if (finalErr) { console.error("✗ Verif finale :", finalErr); process.exit(1); }

console.log(`\n═══════════════════════════════════════════════════════════════`);
console.log(`✓ SEED TERMINÉ — ${finalCount} articles globaux dans articles_catalogue`);
console.log(`═══════════════════════════════════════════════════════════════`);

// Stats par catégorie
const { data: cats } = await supabase
  .from("articles_catalogue")
  .select("categorie")
  .is("user_id", null);
const byCat = {};
(cats || []).forEach((r) => { byCat[r.categorie] = (byCat[r.categorie] || 0) + 1; });
console.log("\nRépartition par catégorie :");
Object.entries(byCat).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => {
  console.log(`  ${c.padEnd(20)} ${n}`);
});
