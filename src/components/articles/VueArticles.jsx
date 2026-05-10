// ═══════════════════════════════════════════════════════════════════════════
// VueArticles — page Articles (catalogue BTP fournitures unitaires)
// ═══════════════════════════════════════════════════════════════════════════
// 2 modes d'affichage :
//   - "grouped" (défaut) : sections accordéon par catégorie BTP, avec
//     sous-groupes par sous_categorie. Header sticky pour garder le contexte
//     en mobile. État ouvert/fermé persisté en localStorage par catégorie.
//   - "flat" : liste plate filtrable (table desktop, cards mobile).
//
// Switch automatique vers "flat" quand search actif ou "Mes articles" coché
// (le groupement n'a plus de sens sur un sous-ensemble réduit).
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from "react";
import { useArticlesCatalogue } from "../../hooks/useArticlesCatalogue";

const L = {
  bg: "#F4F6F9", surface: "#FFFFFF", border: "#E2E8F0",
  accent: "#E8620A", accentBg: "#FFF4EE",
  navy: "#1B3A5C", navyBg: "#EEF3F8",
  blue: "#2563EB", blueBg: "#EFF6FF",
  green: "#16A34A", greenBg: "#F0FDF4",
  red: "#DC2626", redBg: "#FEF2F2",
  text: "#0F172A", textMd: "#334155", textSm: "#64748B", textXs: "#94A3B8",
};

const UNITES = ["U", "ml", "m2", "m3", "kg", "sac", "plaque", "boîte", "lot", "paire", "jeu", "rouleau", "coffret", "carton", "palette"];

// Ordre + icônes des 12 catégories BTP. Les catégories non listées ici
// passent en "Autres" en bas de la liste.
const CATEGORIE_META = {
  "Plomberie":   { icon: "🚿", color: "#0EA5E9" },
  "Sanitaire":   { icon: "🛁", color: "#06B6D4" },
  "Électricité": { icon: "⚡", color: "#EAB308" },
  "Carrelage":   { icon: "🟫", color: "#A16207" },
  "Peinture":    { icon: "🎨", color: "#EC4899" },
  "Plâtrerie":   { icon: "📐", color: "#9CA3AF" },
  "Isolation":   { icon: "🧊", color: "#60A5FA" },
  "Menuiserie":  { icon: "🚪", color: "#92400E" },
  "Couverture":  { icon: "🏠", color: "#7C2D12" },
  "Maçonnerie":  { icon: "🧱", color: "#B45309" },
  "Étanchéité":  { icon: "💧", color: "#0284C7" },
  "Outillage":   { icon: "🔧", color: "#475569" },
};
const CATEGORIE_ORDER = Object.keys(CATEGORIE_META);
const FALLBACK_META = { icon: "📦", color: "#64748B" };

// ─── localStorage helpers (best-effort, on ignore les erreurs quota) ────────
const LS_VIEW = "cp_articles_view_mode";
const LS_OPEN = "cp_articles_open_sections";
function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
  catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ─── Hook viewport pour switch table/cards ─────────────────────────────────
function useIsNarrow(breakpoint = 720) {
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth < breakpoint);
  useEffect(() => {
    function onR() { setNarrow(window.innerWidth < breakpoint); }
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, [breakpoint]);
  return narrow;
}

export default function VueArticles({ authUser }) {
  const uid = authUser?.id || null;
  const { articles, loading, error, addArticle, updateArticle, deleteArticle } = useArticlesCatalogue(uid);
  const narrow = useIsNarrow();

  const [search, setSearch] = useState("");
  const [filterMine, setFilterMine] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  // Mode utilisateur (persisté). Le mode effectif peut être forcé "flat" par
  // les filtres (search non vide ou "mes articles" actif).
  const [viewMode, setViewMode] = useState(() => lsGet(LS_VIEW, "grouped"));
  // Sections ouvertes (Set sérialisé en array). Init : aucune ouverte par
  // défaut — l'utilisateur clique pour explorer.
  const [openSections, setOpenSections] = useState(() => new Set(lsGet(LS_OPEN, [])));

  // Persistance localStorage
  useEffect(() => { lsSet(LS_VIEW, viewMode); }, [viewMode]);
  useEffect(() => { lsSet(LS_OPEN, Array.from(openSections)); }, [openSections]);

  const searchActive = search.trim().length > 0 || filterMine;
  const effectiveMode = searchActive ? "flat" : viewMode;

  // Liste filtrée pour le mode "flat" (et le calcul de stats globales)
  const filteredFlat = useMemo(() => {
    const q = search.trim().toLowerCase();
    return articles.filter((a) => {
      if (filterMine && a.user_id !== uid) return false;
      if (!q) return true;
      const hay =
        (a.libelle || "") + " " +
        (a.fournisseur_default || "") + " " +
        (a.reference || "") + " " +
        (a.sous_categorie || "") + " " +
        (a.categorie || "");
      return hay.toLowerCase().includes(q);
    });
  }, [articles, search, filterMine, uid]);

  // Groupement par catégorie pour le mode "grouped" (ignore les filtres
  // search/mine puisque on bascule en flat dans ces cas).
  const grouped = useMemo(() => {
    const g = {};
    for (const a of articles) {
      const k = a.categorie || "Autres";
      if (!g[k]) g[k] = [];
      g[k].push(a);
    }
    return g;
  }, [articles]);

  // Catégories à afficher : ordre fixe + extras (cat trouvées hors mapping)
  const displayedCats = useMemo(() => {
    const known = CATEGORIE_ORDER.filter((c) => grouped[c]?.length > 0);
    const extras = Object.keys(grouped).filter((c) => !CATEGORIE_META[c]).sort();
    return [...known, ...extras];
  }, [grouped]);

  const stats = useMemo(() => {
    const total = articles.length;
    const mien = articles.filter((a) => a.user_id === uid).length;
    return { total, global: total - mien, mien };
  }, [articles, uid]);

  function toggleSection(cat) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }
  function expandAll() { setOpenSections(new Set(displayedCats)); }
  function collapseAll() { setOpenSections(new Set()); }

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header — titre + toggle vue + bouton CRUD */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: L.text, margin: 0 }}>📦 Articles</h1>
          <p style={{ fontSize: 12, color: L.textSm, margin: "3px 0 0" }}>
            {stats.global} articles partagés + {stats.mien} personnels — {displayedCats.length} catégories
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <ViewToggle value={viewMode} disabled={searchActive} onChange={setViewMode} />
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            style={{ padding: "9px 14px", background: L.accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
          >
            + Nouvel article perso
          </button>
        </div>
      </div>

      {/* Filtres : search + checkbox mes articles */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="search"
          placeholder="Rechercher (libellé, fournisseur, référence, catégorie…)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: "1 1 280px", minWidth: 200, padding: "10px 14px", border: `1px solid ${L.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none" }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: L.textMd, cursor: "pointer" }}>
          <input type="checkbox" checked={filterMine} onChange={(e) => setFilterMine(e.target.checked)} />
          Mes articles uniquement
        </label>
        {effectiveMode === "grouped" && (
          <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
            <button onClick={expandAll} style={chipBtn}>Tout déplier</button>
            <button onClick={collapseAll} style={chipBtn}>Tout replier</button>
          </div>
        )}
      </div>

      {searchActive && (
        <div style={{ fontSize: 11, color: L.textSm, padding: "0 4px", marginTop: -8 }}>
          Mode liste activé automatiquement par les filtres — efface la recherche pour revenir au mode {viewMode === "grouped" ? "groupé" : "liste"}.
        </div>
      )}

      {loading && <div style={{ padding: 24, textAlign: "center", color: L.textSm, fontSize: 13 }}>Chargement…</div>}
      {error && <div style={{ padding: 14, background: L.redBg, color: L.red, borderRadius: 8, fontSize: 12 }}>Erreur : {error}</div>}

      {!loading && articles.length === 0 && (
        <EmptyState />
      )}

      {!loading && articles.length > 0 && effectiveMode === "flat" && (
        <FlatView
          items={filteredFlat}
          uid={uid}
          narrow={narrow}
          onEdit={(a) => { setEditing(a); setShowForm(true); }}
          onDelete={async (a) => {
            if (!confirm(`Supprimer "${a.libelle}" ?`)) return;
            try { await deleteArticle(a.id); }
            catch (e) { alert("Erreur : " + (e?.message || e)); }
          }}
        />
      )}

      {!loading && articles.length > 0 && effectiveMode === "grouped" && (
        <GroupedView
          cats={displayedCats}
          grouped={grouped}
          openSections={openSections}
          onToggle={toggleSection}
          uid={uid}
          narrow={narrow}
          onEdit={(a) => { setEditing(a); setShowForm(true); }}
          onDelete={async (a) => {
            if (!confirm(`Supprimer "${a.libelle}" ?`)) return;
            try { await deleteArticle(a.id); }
            catch (e) { alert("Erreur : " + (e?.message || e)); }
          }}
        />
      )}

      {showForm && (
        <ArticleFormModal
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={async (payload) => {
            try {
              if (editing) await updateArticle(editing.id, payload);
              else await addArticle(payload);
              setShowForm(false);
              setEditing(null);
            } catch (e) {
              alert("Erreur enregistrement : " + (e?.message || e));
            }
          }}
        />
      )}
    </div>
  );
}

// ─── Toggle "Par métier" / "Liste" ─────────────────────────────────────────
function ViewToggle({ value, onChange, disabled }) {
  const opts = [
    { id: "grouped", label: "📂 Par métier" },
    { id: "flat", label: "📋 Liste" },
  ];
  return (
    <div style={{ display: "inline-flex", border: `1px solid ${L.border}`, borderRadius: 8, overflow: "hidden", opacity: disabled ? 0.5 : 1 }}>
      {opts.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => !disabled && onChange(o.id)}
            disabled={disabled}
            title={disabled ? "Efface la recherche pour changer de vue" : ""}
            style={{
              padding: "8px 12px",
              background: active ? L.navy : "#fff",
              color: active ? "#fff" : L.textMd,
              border: "none",
              fontSize: 12,
              fontWeight: active ? 700 : 500,
              cursor: disabled ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const chipBtn = { padding: "5px 10px", background: "#fff", border: `1px solid ${L.border}`, borderRadius: 6, fontSize: 11, fontWeight: 600, color: L.textMd, cursor: "pointer", fontFamily: "inherit" };

function EmptyState() {
  return (
    <div style={{ padding: 32, textAlign: "center", color: L.textSm, fontSize: 13, border: `1px dashed ${L.border}`, borderRadius: 8 }}>
      Catalogue vide.
      <div style={{ marginTop: 10, fontSize: 11 }}>
        Vérifie que la migration <code>articles_catalogue</code> + le seed ont été exécutés dans Supabase.
      </div>
    </div>
  );
}

// ─── Mode GROUPED — sections accordéon par catégorie ───────────────────────
function GroupedView({ cats, grouped, openSections, onToggle, uid, narrow, onEdit, onDelete }) {
  if (cats.length === 0) {
    return <div style={{ padding: 24, textAlign: "center", color: L.textSm, fontSize: 12 }}>Aucune catégorie.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {cats.map((cat) => {
        const items = grouped[cat] || [];
        const meta = CATEGORIE_META[cat] || FALLBACK_META;
        const isOpen = openSections.has(cat);
        return (
          <section key={cat} style={{ background: "#fff", border: `1px solid ${L.border}`, borderRadius: 10, overflow: "hidden" }}>
            <header
              onClick={() => onToggle(cat)}
              style={{
                position: "sticky",
                top: 0,
                zIndex: 5,
                background: isOpen ? meta.color + "11" : "#fff",
                cursor: "pointer",
                padding: "12px 14px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                borderBottom: isOpen ? `1px solid ${meta.color}33` : "none",
                userSelect: "none",
              }}
            >
              <span style={{ fontSize: 20 }}>{meta.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: L.text }}>{cat}</div>
                <div style={{ fontSize: 11, color: L.textSm }}>{items.length} article{items.length > 1 ? "s" : ""}</div>
              </div>
              <span style={{ fontSize: 14, color: L.textSm, transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform .15s" }}>▾</span>
            </header>
            {isOpen && (
              <div style={{ padding: narrow ? 8 : 14, display: "flex", flexDirection: "column", gap: 12 }}>
                {renderSousGroupes(items, uid, narrow, onEdit, onDelete, meta)}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function renderSousGroupes(items, uid, narrow, onEdit, onDelete, meta) {
  // Groupement par sous_categorie (ou "_none" si pas de sous-cat)
  const groups = {};
  for (const a of items) {
    const k = (a.sous_categorie || "").trim() || "_none";
    if (!groups[k]) groups[k] = [];
    groups[k].push(a);
  }
  const keys = Object.keys(groups).sort((a, b) => {
    if (a === "_none") return -1;
    if (b === "_none") return 1;
    return a.localeCompare(b);
  });
  return keys.map((k) => (
    <div key={k}>
      {k !== "_none" && (
        <div style={{ fontSize: 11, fontWeight: 700, color: meta.color, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6, paddingLeft: 2 }}>
          • {k} <span style={{ color: L.textXs, fontWeight: 500 }}>({groups[k].length})</span>
        </div>
      )}
      {narrow ? (
        <CardsGrid items={groups[k]} uid={uid} onEdit={onEdit} onDelete={onDelete} />
      ) : (
        <ItemsTable items={groups[k]} uid={uid} onEdit={onEdit} onDelete={onDelete} />
      )}
    </div>
  ));
}

// ─── Mode FLAT — liste plate ───────────────────────────────────────────────
function FlatView({ items, uid, narrow, onEdit, onDelete }) {
  if (items.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: L.textSm, fontSize: 13, border: `1px dashed ${L.border}`, borderRadius: 8 }}>
        Aucun article ne correspond aux filtres.
      </div>
    );
  }
  if (narrow) {
    return (
      <div style={{ background: "#fff", border: `1px solid ${L.border}`, borderRadius: 10, padding: 8 }}>
        <div style={{ fontSize: 11, color: L.textSm, padding: "4px 6px 8px" }}>{items.length} article{items.length > 1 ? "s" : ""}</div>
        <CardsGrid items={items} uid={uid} onEdit={onEdit} onDelete={onDelete} />
      </div>
    );
  }
  return (
    <div style={{ background: "#fff", border: `1px solid ${L.border}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <ItemsTable items={items} uid={uid} onEdit={onEdit} onDelete={onDelete} showCategorie />
      </div>
    </div>
  );
}

// ─── Table desktop ─────────────────────────────────────────────────────────
function ItemsTable({ items, uid, onEdit, onDelete, showCategorie }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720, fontSize: 12 }}>
      <thead style={{ background: L.navyBg, position: "sticky", top: 0 }}>
        <tr>
          <Th>Libellé</Th>
          {showCategorie && <Th>Catégorie</Th>}
          <Th>Unité</Th>
          <Th align="right">Prix HT</Th>
          <Th>Fournisseur</Th>
          <Th>TVA</Th>
          <Th>Source</Th>
          <Th align="right">Actions</Th>
        </tr>
      </thead>
      <tbody>
        {items.map((a) => {
          const mine = a.user_id === uid;
          return (
            <tr key={a.id} style={{ borderTop: `1px solid ${L.border}` }}>
              <td style={{ padding: "8px 10px", fontWeight: 600, color: L.text }}>
                {a.libelle}
                {a.sous_categorie && !showCategorie && (
                  <div style={{ fontSize: 10, color: L.textSm, fontWeight: 400 }}>{a.sous_categorie}</div>
                )}
              </td>
              {showCategorie && <td style={{ padding: "8px 10px", color: L.textMd }}>{a.categorie}</td>}
              <td style={{ padding: "8px 10px", color: L.textMd }}>{a.unite}</td>
              <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: L.text }}>
                {Number(a.prix_achat_ht).toFixed(2)} €
              </td>
              <td style={{ padding: "8px 10px", color: L.textMd }}>{a.fournisseur_default || "—"}</td>
              <td style={{ padding: "8px 10px", color: L.textMd }}>{a.tva_pct}%</td>
              <td style={{ padding: "8px 10px" }}>
                {mine ? (
                  <span style={{ background: L.accentBg, color: L.accent, padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700 }}>Personnel</span>
                ) : (
                  <span style={{ background: L.navyBg, color: L.navy, padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700 }}>Partagé</span>
                )}
              </td>
              <td style={{ padding: "8px 10px", textAlign: "right" }}>
                {mine ? (
                  <>
                    <button onClick={() => onEdit(a)} style={btnSm(L.blue, L.blueBg)}>Éditer</button>
                    <button onClick={() => onDelete(a)} style={{ ...btnSm(L.red, L.redBg), marginLeft: 6 }}>Suppr.</button>
                  </>
                ) : (
                  <span style={{ fontSize: 10, color: L.textSm }}>Lecture seule</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Cards mobile ──────────────────────────────────────────────────────────
function CardsGrid({ items, uid, onEdit, onDelete }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((a) => {
        const mine = a.user_id === uid;
        return (
          <div key={a.id} style={{ border: `1px solid ${L.border}`, borderRadius: 8, padding: 10, background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: L.text, lineHeight: 1.3 }}>{a.libelle}</div>
                <div style={{ fontSize: 10, color: L.textSm, marginTop: 2 }}>
                  {a.sous_categorie && <span>{a.sous_categorie} · </span>}
                  {a.fournisseur_default || "—"}
                </div>
              </div>
              <div style={{ textAlign: "right", whiteSpace: "nowrap", flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: L.accent, fontFamily: "monospace" }}>{Number(a.prix_achat_ht).toFixed(2)} €</div>
                <div style={{ fontSize: 10, color: L.textXs }}>/{a.unite}</div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <span style={{ background: mine ? L.accentBg : L.navyBg, color: mine ? L.accent : L.navy, padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700 }}>
                {mine ? "Personnel" : "Partagé"}
              </span>
              {mine && (
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => onEdit(a)} style={btnSm(L.blue, L.blueBg)}>Éditer</button>
                  <button onClick={() => onDelete(a)} style={btnSm(L.red, L.redBg)}>Suppr.</button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Th({ children, align = "left" }) {
  return (
    <th style={{ padding: "10px 10px", textAlign: align, fontSize: 11, fontWeight: 700, color: "#1B3A5C", textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap" }}>{children}</th>
  );
}

function btnSm(color, bg) {
  return { padding: "5px 10px", background: bg, color, border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
}

// ─── Modale création/édition article ───────────────────────────────────────
function ArticleFormModal({ initial, onClose, onSave }) {
  const [f, setF] = useState({
    libelle: initial?.libelle || "",
    categorie: initial?.categorie || "Divers",
    sous_categorie: initial?.sous_categorie || "",
    unite: initial?.unite || "U",
    prix_achat_ht: initial?.prix_achat_ht ?? 0,
    fournisseur_default: initial?.fournisseur_default || "",
    conditionnement: initial?.conditionnement || "",
    tva_pct: initial?.tva_pct ?? 20,
    reference: initial?.reference || "",
    coefficient_marge: initial?.coefficient_marge ?? 1.3,
  });

  function up(k, v) { setF((p) => ({ ...p, [k]: v })); }

  function submit(e) {
    e.preventDefault();
    if (!f.libelle.trim()) { alert("Libellé requis"); return; }
    if (Number(f.prix_achat_ht) < 0) { alert("Prix invalide"); return; }
    onSave(f);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16, paddingTop: "calc(var(--safe-top, 0px) + 16px)", paddingBottom: "calc(var(--safe-bottom, 0px) + 16px)" }}>
      <form
        onSubmit={submit}
        style={{ background: "#fff", borderRadius: 12, padding: 22, maxWidth: 540, width: "100%", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 800, color: L.text, margin: "0 0 14px" }}>
          {initial ? "Éditer l'article" : "Nouvel article personnel"}
        </h2>
        <Field label="Libellé *">
          <input value={f.libelle} onChange={(e) => up("libelle", e.target.value)} autoFocus required style={inp} />
        </Field>
        <Row>
          <Field label="Catégorie *">
            <select value={f.categorie} onChange={(e) => up("categorie", e.target.value)} required style={inp}>
              {[...CATEGORIE_ORDER, "Autres"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Sous-catégorie">
            <input value={f.sous_categorie} onChange={(e) => up("sous_categorie", e.target.value)} style={inp} />
          </Field>
        </Row>
        <Row>
          <Field label="Unité">
            <select value={f.unite} onChange={(e) => up("unite", e.target.value)} style={inp}>
              {UNITES.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
          <Field label="Prix achat HT (€) *">
            <input type="number" step="0.01" min="0" value={f.prix_achat_ht} onChange={(e) => up("prix_achat_ht", e.target.value)} required style={inp} />
          </Field>
          <Field label="TVA (%)">
            <input type="number" step="0.1" value={f.tva_pct} onChange={(e) => up("tva_pct", e.target.value)} style={inp} />
          </Field>
        </Row>
        <Row>
          <Field label="Fournisseur">
            <input value={f.fournisseur_default} onChange={(e) => up("fournisseur_default", e.target.value)} style={inp} />
          </Field>
          <Field label="Conditionnement">
            <input value={f.conditionnement} onChange={(e) => up("conditionnement", e.target.value)} style={inp} placeholder="Ex: Sac 25kg" />
          </Field>
        </Row>
        <Row>
          <Field label="Référence">
            <input value={f.reference} onChange={(e) => up("reference", e.target.value)} style={inp} placeholder="Ex: GED-1234" />
          </Field>
          <Field label="Coef marge (vente / achat)">
            <input type="number" step="0.01" value={f.coefficient_marge} onChange={(e) => up("coefficient_marge", e.target.value)} style={inp} />
          </Field>
        </Row>
        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} style={{ padding: "9px 16px", background: "#fff", color: L.textMd, border: `1px solid ${L.border}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Annuler</button>
          <button type="submit" style={{ padding: "9px 18px", background: L.accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {initial ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inp = { width: "100%", padding: "8px 10px", border: `1px solid ${L.border}`, borderRadius: 6, fontSize: 13, fontFamily: "inherit", outline: "none", background: "#fff" };

function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 10, flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: L.textMd, marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  );
}
function Row({ children }) {
  return <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{children}</div>;
}
