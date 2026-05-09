// ═══════════════════════════════════════════════════════════════════════════
// useArticlesCatalogue — chargement + CRUD du catalogue articles BTP
// ═══════════════════════════════════════════════════════════════════════════
// Lit articles_catalogue (RLS : user_id IS NULL OR = uid) → tous les articles
// globaux + ceux de l'utilisateur. Les écritures portent toujours user_id = uid.
// Pas de cache local : on relit après chaque mutation pour rester simple
// (la table est petite, ~500 lignes globales + qq dizaines persos).
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

export function useArticlesCatalogue(authUserId) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("articles_catalogue")
        .select("*")
        .eq("actif", true)
        .order("categorie", { ascending: true })
        .order("libelle", { ascending: true });
      if (error) throw error;
      setArticles(data || []);
    } catch (e) {
      console.error("[useArticlesCatalogue] reload failed", e);
      setError(e?.message || String(e));
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const addArticle = useCallback(
    async (payload) => {
      if (!authUserId) throw new Error("Non authentifié");
      const row = {
        user_id: authUserId,
        libelle: payload.libelle?.trim(),
        categorie: payload.categorie || "Divers",
        sous_categorie: payload.sous_categorie || null,
        unite: payload.unite || "U",
        prix_achat_ht: Number(payload.prix_achat_ht) || 0,
        coefficient_marge: Number(payload.coefficient_marge) || 1.3,
        fournisseur_default: payload.fournisseur_default || null,
        conditionnement: payload.conditionnement || null,
        tva_pct: Number(payload.tva_pct ?? 20),
        reference: payload.reference || null,
        actif: true,
      };
      const { data, error } = await supabase
        .from("articles_catalogue")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      setArticles((prev) => [...prev, data]);
      return data;
    },
    [authUserId]
  );

  const updateArticle = useCallback(async (id, patch) => {
    const { data, error } = await supabase
      .from("articles_catalogue")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    setArticles((prev) => prev.map((a) => (a.id === id ? data : a)));
    return data;
  }, []);

  const deleteArticle = useCallback(async (id) => {
    const { error } = await supabase
      .from("articles_catalogue")
      .delete()
      .eq("id", id);
    if (error) throw error;
    setArticles((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { articles, loading, error, reload, addArticle, updateArticle, deleteArticle };
}

// Helper : recherche fuzzy locale sur libellé (pour l'autocomplete fournitures).
// Filtre + tri par pertinence basique : startsWith > includes.
export function searchArticles(articles, query, max = 12) {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim().toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  const scored = [];
  for (const a of articles) {
    const lbl = (a.libelle || "").toLowerCase();
    if (!tokens.every((t) => lbl.includes(t))) continue;
    let score = 0;
    if (lbl.startsWith(q)) score += 10;
    if (lbl.includes(" " + q)) score += 5;
    score += tokens.reduce((s, t) => s + (lbl.indexOf(t) >= 0 ? 1 : 0), 0);
    scored.push({ a, score });
  }
  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, max).map((s) => s.a);
}
