// ═══════════════════════════════════════════════════════════════════════════
// useDevis — Hook React pour gérer la liste des devis (Sprint 1)
// ═══════════════════════════════════════════════════════════════════════════
// Stratégie actuelle (Sprint 1) :
// - Liste de devis stockée en mémoire (useState)
// - Au démarrage : liste vide (pas de devis-démo)
// - À la fin de l'onboarding : on injecte AUTOMATIQUEMENT le devis-démo
//   correspondant au corps de métier choisi
// - CRUD : create, update, delete fonctionnent en mémoire
//
// Plus tard (Sprint 3 / Phase 7) :
// - On branchera Supabase ici, sans rien changer à App.jsx
//
// Usage dans App.jsx :
//   import { useDevis } from "./lib/useDevis";
//   const { devis, addDevisDemoForCorps, createDevis, updateDevis,
//           deleteDevis, setDevis } = useDevis(devisInitiaux);
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useRef } from "react";
import { getDevisDemoPourCorps } from "./devisDemo";

export function useDevis(devisInitiaux = []) {
  const [devis, setDevisState] = useState(devisInitiaux);

  // Pour ne jamais ré-injecter 2 fois le même devis-démo
  // (sécurité au cas où l'utilisateur ferait l'onboarding plusieurs fois)
  const demosInjected = useRef(new Set());

  // ─── Injection auto d'un devis-démo selon le corps de métier ──────
  // À appeler à la fin de l'onboarding, juste après que l'utilisateur
  // ait choisi son activité principale.
  //
  // Exemple : addDevisDemoForCorps("Plomberie")
  // → Ajoute le devis "DEMO-PLO-001 - M. Martin" en haut de la liste
  //
  // Si le corps n'a pas de devis-démo (ex: "Rénovation générale"),
  // on ne fait rien — l'utilisateur démarre avec une liste vide.
  const addDevisDemoForCorps = useCallback((corps) => {
    if (!corps) return null;

    const demo = getDevisDemoPourCorps(corps);
    if (!demo) {
      return null;
    }

    // Eviter les doublons
    if (demosInjected.current.has(demo.numero)) {
      console.log(`[useDevis] Devis-demo "${demo.numero}" deja injecte, ignore`);
      return null;
    }
    demosInjected.current.add(demo.numero);

    // Donner un id unique au devis-demo
    const demoAvecId = { ...demo, id: `demo-${demo.numero}-${Date.now()}` };

    setDevisState(prev => {
      // Si un devis avec ce numero existe deja (cas tres rare), on ne fait rien
      if (prev.some(d => d.numero === demo.numero)) return prev;
      return [demoAvecId, ...prev];
    });

    console.log(`[useDevis] Devis-demo "${demo.numero}" injecte pour corps "${corps}"`);
    return demoAvecId;
  }, []);

  // ─── Créer un nouveau devis ────────────────────────────────────────
  const createDevis = useCallback((newDevis) => {
    const devisComplet = {
      id: newDevis.id || `dev-${Date.now()}`,
      ...newDevis,
    };
    setDevisState(prev => [devisComplet, ...prev]);
    return devisComplet;
  }, []);

  // ─── Modifier un devis existant ────────────────────────────────────
  const updateDevis = useCallback((id, updates) => {
    setDevisState(prev => prev.map(d =>
      d.id === id ? { ...d, ...updates } : d
    ));
  }, []);

  // ─── Supprimer un devis ────────────────────────────────────────────
  const deleteDevis = useCallback((id) => {
    setDevisState(prev => prev.filter(d => d.id !== id));
  }, []);

  // ─── Replace complet (utile pour les imports massifs ou Supabase) ──
  const setDevis = useCallback((newList) => {
    setDevisState(newList);
  }, []);

  // ─── Helpers de filtrage (pour l'UI) ───────────────────────────────
  const getDevisById = useCallback((id) => {
    return devis.find(d => d.id === id) || null;
  }, [devis]);

  const getDevisByNumero = useCallback((numero) => {
    return devis.find(d => d.numero === numero) || null;
  }, [devis]);

  const filterDevisByStatut = useCallback((statut) => {
    return devis.filter(d => d.statut === statut);
  }, [devis]);

  const filterDevisDemo = useCallback(() => {
    return devis.filter(d => d.isDemo === true);
  }, [devis]);

  // ─── Retour du hook ────────────────────────────────────────────────
  return {
    // Liste complete des devis
    devis,

    // Actions principales
    setDevis,
    createDevis,
    updateDevis,
    deleteDevis,

    // Actions specifiques au Sprint 1
    addDevisDemoForCorps,

    // Helpers de lecture
    getDevisById,
    getDevisByNumero,
    filterDevisByStatut,
    filterDevisDemo,
  };
}
