// ═══════════════════════════════════════════════════════════════════════════
// Loader bibliothèque BTP — ChantierPro V14
// ═══════════════════════════════════════════════════════════════════════════
// Charge les 81 ouvrages depuis Supabase, avec fallback sur la version
// codee en dur dans App.jsx si Supabase ne repond pas (mode degrade).
//
// Usage dans App.jsx :
//   import { useOuvragesBibliotheque } from "./lib/ouvrages";
//   const { ouvrages, source, loading } = useOuvragesBibliotheque(BIBLIOTHEQUE_BTP);
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { supabase } from "./supabase";

// Map corps_id (BDD) → nom corps (V13)
const CORPS_MAP = {
  maconnerie:    "Maçonnerie",
  carrelage:     "Carrelage",
  peinture:      "Peinture",
  plomberie:     "Plomberie",
  electricite:   "Électricité",
  menuiserie:    "Menuiserie",
  isolation:     "Isolation",
  demolition:    "Démolition",
  etancheite:    "Étanchéité",
  enduit_facade: "Enduit façade",
  main_oeuvre:   "Main d'œuvre",
  divers:        "Divers",
};

// Map unite_code (BDD) → unite affichee (V13)
const UNITE_MAP = {
  m2: "m²", ml: "ml", m3: "m³", u: "U", kg: "kg", l: "L",
  h: "h", forfait: "F", ens: "ENS", marche: "marche",
  jour: "jour", rotation: "rotation", sac: "sac", rouleau: "rouleau",
  bidon: "bidon", paquet: "paquet",
};

// Convertit un ouvrage DB → format V13 (compatible BIBLIOTHEQUE_BTP en dur)
function dbToV13(o, composants, affectations) {
  return {
    code: o.code,
    corps: CORPS_MAP[o.corps_id] || o.corps_id,
    libelle: o.libelle,
    unite: UNITE_MAP[o.unite_code] || o.unite_code,
    moMin: o.mo_min,
    moMoy: o.mo_moy,
    moMax: o.mo_max,
    fournMin: o.fourn_min,
    fournMoy: o.fourn_moy,
    fournMax: o.fourn_max,
    tempsMO: o.temps_mo_unite || 0,
    detail: o.detail || "",
    source: o.source || "",
    composants: (composants || []).map(c => ({
      designation: c.designation,
      qte: c.qte_par_unite,
      unite: UNITE_MAP[c.unite_code] || c.unite_code,
      prixAchat: c.prix_achat_moy || 0,
    })),
    affectations: (affectations || []).map(a => ({
      q: a.qualification,
      nb: a.nb,
    })),
  };
}

// Hook React : charge les ouvrages depuis Supabase, avec fallback.
// Expose aussi `addOuvrage(o)` pour ajouter un ouvrage personnalisé en mémoire
// (sauvegarde côté Supabase non implémentée — TODO quand la table sera prête).
export function useOuvragesBibliotheque(fallback) {
  const [ouvrages, setOuvrages] = useState(fallback || []);
  const [source, setSource] = useState("local");  // "local" | "supabase"
  const [loading, setLoading] = useState(false);

  // Ajoute un ouvrage en haut de la liste (en évitant les doublons par code).
  const addOuvrage = (o) => {
    if (!o || !o.code) return;
    setOuvrages(prev => prev.some(x => x.code === o.code) ? prev : [o, ...prev]);
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!supabase) {
        // Pas de Supabase configure → on garde le fallback
        return;
      }

      setLoading(true);

      try {
        // 1. Charger les ouvrages
        const { data: ouv, error: errOuv } = await supabase
          .from("ouvrages_catalogue")
          .select("*")
          .eq("actif", true)
          .order("code");

        if (errOuv) throw errOuv;
        if (!ouv || ouv.length === 0) {
          console.warn("[ouvrages] Aucun ouvrage trouve dans Supabase, on garde le fallback");
          setLoading(false);
          return;
        }

        // 2. Charger les composants
        const { data: comps } = await supabase
          .from("composants_catalogue")
          .select("*")
          .order("ordre");

        // 3. Charger les affectations
        const { data: affs } = await supabase
          .from("affectations_types")
          .select("*")
          .order("ordre");

        // Index par ouvrage_id pour join cote client
        const compsByOuv = {};
        (comps || []).forEach(c => {
          if (!compsByOuv[c.ouvrage_id]) compsByOuv[c.ouvrage_id] = [];
          compsByOuv[c.ouvrage_id].push(c);
        });
        const affsByOuv = {};
        (affs || []).forEach(a => {
          if (!affsByOuv[a.ouvrage_id]) affsByOuv[a.ouvrage_id] = [];
          affsByOuv[a.ouvrage_id].push(a);
        });

        // 4. Merger
        const merged = ouv.map(o => dbToV13(o, compsByOuv[o.id], affsByOuv[o.id]));

        if (!cancelled) {
          setOuvrages(merged);
          setSource("supabase");
          console.log(`[ouvrages] ${merged.length} ouvrages charges depuis Supabase`);
        }
      } catch (err) {
        console.error("[ouvrages] Erreur Supabase, fallback sur version locale :", err.message || err);
        // On garde le fallback, l'app continue de marcher
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { ouvrages, source, loading, addOuvrage };
}
