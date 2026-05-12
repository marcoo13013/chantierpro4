// ═══════════════════════════════════════════════════════════════════════════
// kpi.js — calcul centralisé des KPIs (Accueil + Comptabilité + Encaissements)
// ═══════════════════════════════════════════════════════════════════════════
// Source de vérité pour les agrégats financiers de l'app. Centralise les
// calculs précédemment dispersés (chacun avait sa version, certaines
// périmées : Accueil et Comptabilité lisaient chantier.acompteEncaisse /
// chantier.soldeEncaisse qui ne sont jamais peuplés → encaissé toujours 0
// alors que l'onglet Encaissements lit correctement les docs payés).
//
// Conventions :
//   - "Encaissé" = somme TTC des docs (facture finale OU acompte) avec
//     statut === "payé" (ou "encaissé", synonyme legacy).
//   - "À encaisser" = somme TTC des docs en statut "en attente" ou
//     "partiellement payé" (= reste à percevoir).
//   - "CA total" = somme TTC des factures finales émises non annulées.
//     Avant l'introduction des factures (sprint duplication 3A), on peut
//     fallback sur les devis acceptés/facturés.
//   - "Dépenses réelles" = somme chantier.depensesReelles[].montant
//   - "Sous-traitants" = somme (phase.dureeJours × ST.tauxJournalier) pour
//     chaque phase de chaque chantier ayant des sousTraitantsIds.
//   - "Bénéfice estimé" = CA − Dépenses − Sous-traitants
//   - "Taux de marge" = Bénéfice / CA × 100 (entier %)
// ═══════════════════════════════════════════════════════════════════════════

// Helper : calcule le TTC d'un document (devis ou facture). Reproduit la
// logique de calcDocTotal/calcFact sans dépendre du scope React, pour
// pouvoir être utilisé partout. Tient compte de l'autoliquidation BTP
// (TVA forcée à 0).
function ttcDoc(d) {
  if (!d || !Array.isArray(d.lignes)) return 0;
  const autoliq = d.autoliquidation_btp === true;
  let ht = 0, tv = 0;
  for (const l of d.lignes) {
    // Type "ligne" uniquement (ignore titres/sous-titres/options pour les
    // totaux principaux — les options sont comptées séparément si besoin)
    if (l?.type !== "ligne") {
      // Compat : si pas de type explicite et libellé/qte/prix présents, on
      // considère comme une ligne. Cf isLigneDevis dans App.jsx.
      if (l?.type === "titre" || l?.type === "soustitre" || l?.type === "option") continue;
    }
    const lh = (+l.qte || 0) * (+l.prixUnitHT || 0);
    if (!Number.isFinite(lh) || lh <= 0) continue;
    ht += lh;
    if (!autoliq) tv += lh * ((+l.tva || 0) / 100);
  }
  return +(ht + tv).toFixed(2);
}

// ─── Encaissé / à encaisser ────────────────────────────────────────────────
function calculerEncaissements(docs) {
  const list = Array.isArray(docs) ? docs : [];
  let totalEncaisse = 0;
  let totalAEncaisser = 0;
  let nbPayes = 0, nbAttente = 0;
  for (const d of list) {
    if (d?.type !== "facture") continue;       // factures + acomptes (estAcompte)
    if (d.statut === "annulé") continue;
    const ttc = ttcDoc(d);
    if (d.statut === "payé" || d.statut === "encaissé") {
      totalEncaisse += ttc;
      nbPayes++;
    } else if (d.statut === "partiellement payé") {
      // Compte le montant déjà payé (champ montantPaye persisté) + reste à encaisser
      const paye = +d.montantPaye || 0;
      totalEncaisse += paye;
      totalAEncaisser += Math.max(0, ttc - paye);
      nbAttente++;
    } else if (d.statut === "en attente") {
      totalAEncaisser += ttc;
      nbAttente++;
    }
  }
  const tauxRecouvrement = (totalEncaisse + totalAEncaisser) > 0
    ? Math.round((totalEncaisse / (totalEncaisse + totalAEncaisser)) * 100)
    : 0;
  return {
    totalEncaisse: +totalEncaisse.toFixed(2),
    totalAEncaisser: +totalAEncaisser.toFixed(2),
    tauxRecouvrement,
    nbPayes,
    nbAttente,
  };
}

// ─── Chiffre d'affaires (factures émises) ──────────────────────────────────
function calculerCA(docs) {
  const list = Array.isArray(docs) ? docs : [];
  // CA réel = factures finales émises non annulées (hors acomptes pour
  // ne pas double-compter, l'acompte est inclus dans le TTC de la facture
  // si la facture est issue d'un devis avec acomptes).
  let caFactures = 0;
  let caDevisAcceptes = 0; // fallback si pas encore de factures
  for (const d of list) {
    if (d?.type !== "facture") {
      if (d?.type === "devis" && (d.statut === "accepté" || d.statut === "signé" || d.statut === "facturé")) {
        caDevisAcceptes += ttcDoc(d);
      }
      continue;
    }
    if (d.estAcompte) continue;
    if (d.statut === "annulé") continue;
    caFactures += ttcDoc(d);
  }
  return {
    caFactures: +caFactures.toFixed(2),
    caDevisAcceptes: +caDevisAcceptes.toFixed(2),
    // CA total : on prend caFactures si > 0, sinon fallback devis acceptés
    caTotal: +(caFactures > 0 ? caFactures : caDevisAcceptes).toFixed(2),
  };
}

// ─── Dépenses réelles (saisies sur chantier) ───────────────────────────────
function calculerDepenses(chantiers) {
  const list = Array.isArray(chantiers) ? chantiers : [];
  let total = 0;
  for (const c of list) {
    if (!Array.isArray(c?.depensesReelles)) continue;
    for (const d of c.depensesReelles) total += +d.montant || 0;
  }
  return +total.toFixed(2);
}

// ─── Coût sous-traitants (jours × taux journalier par phase de planning) ──
function calculerSousTraitants(chantiers, sousTraitants) {
  const stList = Array.isArray(sousTraitants) ? sousTraitants : [];
  const chList = Array.isArray(chantiers) ? chantiers : [];
  let total = 0;
  for (const c of chList) {
    for (const p of (c.planning || [])) {
      const ids = Array.isArray(p?.sousTraitantsIds) ? p.sousTraitantsIds : [];
      const dur = +p?.dureeJours || 0;
      for (const stid of ids) {
        const st = stList.find(x => x.id === stid);
        if (!st) continue;
        total += dur * (+st.tauxJournalier || 0);
      }
    }
  }
  return +total.toFixed(2);
}

// ═══════════════════════════════════════════════════════════════════════════
// API principale : retourne tous les KPIs en un appel
// ═══════════════════════════════════════════════════════════════════════════
export function calculerKPIs(docs, chantiers, sousTraitants) {
  const enc = calculerEncaissements(docs);
  const ca = calculerCA(docs);
  const depensesReelles = calculerDepenses(chantiers);
  const totalSousTraitants = calculerSousTraitants(chantiers, sousTraitants);
  const beneficeEstime = +(ca.caTotal - depensesReelles - totalSousTraitants).toFixed(2);
  const tauxMarge = ca.caTotal > 0
    ? Math.round((beneficeEstime / ca.caTotal) * 100)
    : 0;
  return {
    // Encaissements
    totalEncaisse: enc.totalEncaisse,
    totalAEncaisser: enc.totalAEncaisser,
    tauxRecouvrement: enc.tauxRecouvrement,
    nbPayes: enc.nbPayes,
    nbAttente: enc.nbAttente,
    // CA
    caTotal: ca.caTotal,
    caFactures: ca.caFactures,
    caDevisAcceptes: ca.caDevisAcceptes,
    // Charges
    depensesReelles,
    totalSousTraitants,
    // Synthèse
    beneficeEstime,
    tauxMarge,
  };
}

// Exports unitaires pour usage ciblé
export { calculerEncaissements, calculerCA, calculerDepenses, calculerSousTraitants, ttcDoc };
