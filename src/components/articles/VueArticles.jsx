// ═══════════════════════════════════════════════════════════════════════════
// VueArticles — page Articles (catalogue BTP fournitures unitaires)
// ═══════════════════════════════════════════════════════════════════════════
// Liste filtrable par catégorie + search box + CRUD pour les articles
// personnels (user_id = uid). Les articles globaux (user_id IS NULL) sont en
// lecture seule, signalés par un badge "Catalogue partagé".
// ═══════════════════════════════════════════════════════════════════════════

import React, { useMemo, useState } from "react";
import { useArticlesCatalogue } from "../../hooks/useArticlesCatalogue";

const L = {
  bg: "#F4F6F9", surface: "#FFFFFF", border: "#E2E8F0",
  accent: "#E8620A", accentBg: "#FFF4EE",
  navy: "#1B3A5C", navyBg: "#EEF3F8",
  blue: "#2563EB", blueBg: "#EFF6FF",
  green: "#16A34A", greenBg: "#F0FDF4",
  red: "#DC2626", redBg: "#FEF2F2",
  text: "#0F172A", textMd: "#334155", textSm: "#64748B",
};

const UNITES = ["U", "ml", "m2", "m3", "kg", "sac", "plaque", "boîte", "lot", "paire", "jeu", "rouleau", "coffret", "carton", "palette"];

export default function VueArticles({ authUser }) {
  const uid = authUser?.id || null;
  const { articles, loading, error, addArticle, updateArticle, deleteArticle, reload } =
    useArticlesCatalogue(uid);

  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("Toutes");
  const [filterMine, setFilterMine] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const categories = useMemo(() => {
    const set = new Set();
    articles.forEach((a) => a.categorie && set.add(a.categorie));
    return ["Toutes", ...Array.from(set).sort()];
  }, [articles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return articles.filter((a) => {
      if (filterMine && a.user_id !== uid) return false;
      if (filterCat !== "Toutes" && a.categorie !== filterCat) return false;
      if (!q) return true;
      const hay =
        (a.libelle || "") +
        " " +
        (a.fournisseur_default || "") +
        " " +
        (a.reference || "") +
        " " +
        (a.sous_categorie || "");
      return hay.toLowerCase().includes(q);
    });
  }, [articles, search, filterCat, filterMine, uid]);

  const stats = useMemo(() => {
    const total = articles.length;
    const mien = articles.filter((a) => a.user_id === uid).length;
    const global = total - mien;
    return { total, mien, global };
  }, [articles, uid]);

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: L.text, margin: 0 }}>📦 Articles</h1>
          <p style={{ fontSize: 13, color: L.textSm, margin: "4px 0 0" }}>
            Catalogue de fournitures BTP — {stats.global} articles partagés + {stats.mien} personnels.
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          style={{ padding: "10px 16px", background: L.accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
        >
          + Nouvel article perso
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="search"
          placeholder="Rechercher (libellé, fournisseur, référence…)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: "1 1 280px", minWidth: 200, padding: "10px 14px", border: `1px solid ${L.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none" }}
        />
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          style={{ padding: "10px 12px", border: `1px solid ${L.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", background: "#fff", minWidth: 160 }}
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: L.textMd, cursor: "pointer" }}>
          <input type="checkbox" checked={filterMine} onChange={(e) => setFilterMine(e.target.checked)} />
          Mes articles uniquement
        </label>
      </div>

      {loading && <div style={{ padding: 24, textAlign: "center", color: L.textSm, fontSize: 13 }}>Chargement…</div>}
      {error && <div style={{ padding: 14, background: L.redBg, color: L.red, borderRadius: 8, fontSize: 12 }}>Erreur : {error}</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ padding: 32, textAlign: "center", color: L.textSm, fontSize: 13, border: `1px dashed ${L.border}`, borderRadius: 8 }}>
          Aucun article ne correspond aux filtres.
          {articles.length === 0 && (
            <div style={{ marginTop: 10, fontSize: 11 }}>
              Si la liste est vide, vérifie que la migration <code>articles_catalogue</code> + le seed ont été exécutés dans Supabase.
            </div>
          )}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ background: "#fff", border: `1px solid ${L.border}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720, fontSize: 12 }}>
              <thead style={{ background: L.navyBg, position: "sticky", top: 0 }}>
                <tr>
                  <Th>Libellé</Th>
                  <Th>Catégorie</Th>
                  <Th>Unité</Th>
                  <Th align="right">Prix HT</Th>
                  <Th>Fournisseur</Th>
                  <Th>TVA</Th>
                  <Th>Source</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const mine = a.user_id === uid;
                  return (
                    <tr key={a.id} style={{ borderTop: `1px solid ${L.border}` }}>
                      <td style={{ padding: "8px 10px", fontWeight: 600, color: L.text }}>
                        {a.libelle}
                        {a.sous_categorie && (
                          <div style={{ fontSize: 10, color: L.textSm, fontWeight: 400 }}>{a.sous_categorie}</div>
                        )}
                      </td>
                      <td style={{ padding: "8px 10px", color: L.textMd }}>{a.categorie}</td>
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
                            <button
                              onClick={() => { setEditing(a); setShowForm(true); }}
                              style={btnSm(L.blue, L.blueBg)}
                            >
                              Éditer
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm(`Supprimer "${a.libelle}" ?`)) return;
                                try { await deleteArticle(a.id); }
                                catch (e) { alert("Erreur : " + (e?.message || e)); }
                              }}
                              style={{ ...btnSm(L.red, L.redBg), marginLeft: 6 }}
                            >
                              Suppr.
                            </button>
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
          </div>
        </div>
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

function Th({ children, align = "left" }) {
  return (
    <th style={{ padding: "10px 10px", textAlign: align, fontSize: 11, fontWeight: 700, color: "#1B3A5C", textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap" }}>{children}</th>
  );
}

function btnSm(color, bg) {
  return { padding: "5px 10px", background: bg, color, border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
}

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
            <input value={f.categorie} onChange={(e) => up("categorie", e.target.value)} required style={inp} />
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

const inp = { width: "100%", padding: "8px 10px", border: `1px solid ${L.border}`, borderRadius: 6, fontSize: 13, fontFamily: "inherit", outline: "none" };

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
