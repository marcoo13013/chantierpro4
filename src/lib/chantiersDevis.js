import { DEVIS_DEMO_PAR_CORPS } from "./devisDemo";

function devisToChantier(devis, index) {
  return {
    id: 100 + index,
    nom: devis.objet || ("Chantier " + (devis.client || "")),
    client: devis.client || "",
    adresse: devis.adresseChantier || "",
    statut: devis.statut === "accepté" ? "en cours" : "prospect",
    devisHT: devis.totalHT || 0,
    devisTTC: devis.totalTTC || 0,
    devisId: devis.numero || "",
    postes: [],
    taches: [],
    salaries: [],
    fournitures: [],
    depenses: [],
  };
}

export const CHANTIERS_DEMO = Object.values(DEVIS_DEMO_PAR_CORPS).map(
  (d, i) => devisToChantier(d, i)
);
