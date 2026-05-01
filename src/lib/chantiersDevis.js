import { DEVIS_DEMO_PAR_CORPS } from "./devisDemo";

function devisToChantier(devis, index) {
  var postes = [];
  var pid = 1;
  (devis.tranches || []).forEach(function(t) {
    (t.lignes || []).forEach(function(l) {
      postes.push({
        id: pid++,
        lot: t.titre || "",
        libelle: l.libelle || "",
        montantHT: l.totalHT || 0,
        tempsMO: { heures: l.heuresPrevues || 0, nbOuvriers: 1, detail: "" },
        fournitures: [{
          designation: l.libelle || "",
          qte: l.qte || 1,
          unite: l.unite || "U",
          prixAchat: l.puHT || l.prixUnitHT || 0,
          fournisseur: "",
        }],
      });
    });
  });
  return {
    id: 100 + index,
    nom: devis.objet || ("Chantier " + ((devis.client && devis.client.nom) || devis.client || "")),
    client: (devis.client && devis.client.nom) || devis.client || "",
    adresseClient: (devis.client && devis.client.adresse) || "",
    adresse: devis.adresseChantier || "",
    statut: devis.statut === "accepté" ? "en cours" : "prospect",
    devisHT: devis.totalHT || 0,
    devisTTC: devis.totalTTC || 0,
    devisId: devis.numero || "",
    postes: postes,
    taches: [],
    salaries: [],
    fournitures: [],
    depenses: [],
  };
}

export const CHANTIERS_DEMO = Object.values(DEVIS_DEMO_PAR_CORPS).map(
  function(d, i) { return devisToChantier(d, i); }
);
