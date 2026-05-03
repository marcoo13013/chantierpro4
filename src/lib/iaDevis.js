const TAUX=35;
export async function estimerLigne(libelle,qte,unite,puHT,coeffMO,coeffFourn){
  const cm=coeffMO||1.5;
  const cf=coeffFourn||1.3;
  const prompt=`Tu es un expert BTP français (Artiprix, Batiprix, Mediabat 2024, marché Marseille/PACA).
Analyse ce poste et retourne UNIQUEMENT un JSON valide, sans texte avant ou après.

Poste : "${libelle}"
Quantité : ${qte} ${unite}

Paramètres :
- Taux horaire ouvrier chargé : ${TAUX}€/h
- Coefficient MO appliqué : x${cm}
- Coefficient fournitures (achat vers vente) : x${cf}

═══════════════════════════════════════════════════════════════════════════
RÈGLE ABSOLUE — heuresMO et fournitures.qte sont TOUJOURS PAR UNITÉ DE
MESURE, JAMAIS en valeur absolue. Le multiplicateur ${qte} est appliqué
côté frontend, ne le fais PAS dans tes nombres. Adapte la logique selon
l'unité détectée :
═══════════════════════════════════════════════════════════════════════════

▸ SURFACE (m2 / M2) — heures et qtés PAR M² :
  • Placo BA13 plafond     : 0.45h/m², plaque BA13 1.05m²/m², rail 0.5ml, montant 0.6ml, vis 12U, enduit 0.3kg
  • Carrelage sol 60x60    : 0.6h/m²,  carrelage 1.1m², colle 4kg, joint 0.3kg, croisillons 10U
  • Faïence murale         : 0.8h/m²,  faïence 1.1m², colle 5kg, joint 0.3kg
  • Peinture mur 2 couches : 0.15h/m², peinture 0.25L, sous-couche 0.1L, ruban 1ml, bâche 0.1m²
  • Isolation laine verre  : 0.2h/m²,  laine 1.1m², agrafes 8U, pare-vapeur 1.05m²
  • Parquet flottant       : 0.4h/m²,  lames 1.05m², sous-couche 1.05m², plinthe 0.4ml

▸ VOLUME (m3 / M3) — heures et qtés PAR M³ :
  • Béton dosage 350       : 1.2h/m³, béton 1.05m³, ferraillage 25kg, coffrage 4m²
  • Démolition cloison     : 0.8h/m³, big-bag 0.3U, gants 0.5U

▸ LINÉAIRE (ml / ML) — heures et qtés PAR ML :
  • Câble électrique 2.5²  : 0.05h/ml, câble 1.05ml, attache-câble 2U
  • Tuyau PER Ø16          : 0.08h/ml, tuyau 1.05ml, collier 1U, raccord 0.2U
  • Plinthe MDF 70mm       : 0.10h/ml, plinthe 1.05ml, colle 0.05L, pointes 4U
  • Gaine ICTA Ø20         : 0.03h/ml, gaine 1.05ml, collier 2U
  • Tuyau cuivre Ø14       : 0.15h/ml, tuyau 1.05ml, raccord 0.3U, soudure 0.05U

▸ UNITÉ (U / pce) — heures et qtés POUR 1 ÉLÉMENT :
  • Prise électrique       : 0.5h/U,  prise 1U, boîte encastrement 1U, dominos 2U
  • Interrupteur           : 0.4h/U,  interrupteur 1U, boîte 1U, vis 2U
  • Point lumineux DCL     : 0.6h/U,  douille 1U, boîte 1U, dominos 2U
  • WC suspendu            : 4h/U,    cuvette 1U, bâti-support 1U, abattant 1U, flexibles 2U, plaque commande 1U
  • Receveur douche        : 3h/U,    receveur 1U, bonde 1U, étanchéité SEL 1U, joint silicone 0.3U
  • Lavabo + meuble        : 2.5h/U,  meuble 1U, vasque 1U, mitigeur 1U, siphon 1U
  • Radiateur électrique   : 1.5h/U,  radiateur 1U, chevilles 4U, vis 4U
  • Radiateur eau chaude   : 2.5h/U,  radiateur 1U, robinetterie 1U, chevilles 4U
  • Porte intérieure       : 3h/U,    bloc-porte 1U, poignée 1U, charnières 3U, joint 2ml
  • Fenêtre PVC pose neuf  : 4h/U,    fenêtre 1U, mousse PU 1U, vis 8U, joint 6ml
  • Spot encastré LED      : 0.4h/U,  spot 1U, transformateur 1U

▸ FORFAIT (forfait / F / ENS) — heures et qtés POUR L'ENSEMBLE DU POSTE :
  • Tableau électrique 13 modules : 8h/forfait, tableau 1U, disjoncteurs 13U, différentiel 30mA 2U, peignes 1U
  • VMC simple flux               : 6h/forfait, centrale 1U, bouches 2U, gaine isolée 5ml, sortie toiture 1U
  • Ballon ECC 200L                : 5h/forfait, ballon 1U, groupe sécurité 1U, vase expansion 1U
  • Saignée + raccordement chantier: 4h/forfait, disqueuse loc 0.5jour, sac gravats 2U

▸ HEURES (h / H) — quantité = nombre d'heures déjà chiffrées :
  • heuresMO = qte (1h saisie = 1h facturée), fournitures vide ou minimes

═══════════════════════════════════════════════════════════════════════════

Règles complémentaires :
- nbOuvriers : 1 à 3 selon la tâche (1 finition, 2 gros œuvre courant, 3 manutention lourde)
- fournitures : liste DÉTAILLÉE et RÉALISTE des matériaux nécessaires (5 maxi, principaux d'abord)
- fournitures[*].qte = quantité PAR UNITÉ du poste (cf. tableaux ci-dessus). Inclure ~5% de chute pour les matériaux découpés
- Les 3 prix puHT sont cohérents avec le marché PACA 2024 (fourni-posé, par unité)
- Calcul : puHT = (heuresMO × ${TAUX} × ${cm} + totalAchatFourn × ${cf}) / (1 - marge)
- totalAchatFourn et totalVenteFourn = somme PAR UNITÉ également (pas multipliés par qte)

Schéma JSON STRICT :
{
  "heuresMO": <heures PAR UNITÉ>,
  "nbOuvriers": <1-3>,
  "tauxHoraire": ${TAUX},
  "coeffMO": ${cm},
  "totalMO": <heuresMO × ${TAUX} × ${cm}>,
  "fournitures": [
    {"fournisseur":"<Point P|Gedimat|Kiloutou|Leroy Merlin|Brico Dépôt>","designation":"<article précis>","qte":<qte PAR UNITÉ>,"unite":"<unite>","prixAchat":<HT unitaire>,"prixVente":<prixAchat × ${cf}>}
  ],
  "totalAchatFourn": <somme achat PAR UNITÉ>,
  "totalVenteFourn": <somme vente PAR UNITÉ>,
  "prix": {
    "bas":   {"puHT": <prix unitaire bas>,   "marge": 30, "label": "Compétitif"},
    "moyen": {"puHT": <prix unitaire moyen>, "marge": 40, "label": "Marché"},
    "haut":  {"puHT": <prix unitaire haut>,  "marge": 50, "label": "Premium"}
  },
  "puHT": <prix moyen recommandé>,
  "commentaire": "<conseil technique court>"
}`;
  try{
const res=await fetch("/api/estimer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:2000,messages:[{role:"user",content:prompt}]})});
    const data=await res.json();
    const text=data.content[0].text;
    console.log("IA RAW:",text);
    const clean=text.replace(/```json|```/g,"").trim();
    const r=JSON.parse(clean);
    r.totalHT=+(r.puHT*qte).toFixed(2);
    return r;
  }catch(e){
    const pu=puHT>0?puHT:100;
    const base=+(pu*0.35*qte).toFixed(2);
    return{heuresMO:2,nbOuvriers:1,tauxHoraire:TAUX,coeffMO:cm,totalMO:+(2*TAUX*cm).toFixed(2),fournitures:[{fournisseur:"Point P",designation:libelle,qte,unite,prixAchat:+(pu*0.25).toFixed(2),prixVente:+(pu*0.25*cf).toFixed(2)}],totalAchatFourn:base,totalVenteFourn:+(base*cf).toFixed(2),prix:{bas:{puHT:+(pu*0.85).toFixed(2),marge:30,label:"Compétitif"},moyen:{puHT:pu,marge:40,label:"Marché"},haut:{puHT:+(pu*1.2).toFixed(2),marge:50,label:"Premium"}},puHT:pu,commentaire:"Estimation fallback"};
  }
}
export async function estimerDevis(devis){
  const resultats=[];
  for(const tranche of(devis.tranches||[])){
    for(const ligne of(tranche.lignes||[])){
      const r=await estimerLigne(ligne.libelle,ligne.qte,ligne.unite||"U",ligne.puHT||0,1.5,1.3);
      resultats.push({...ligne,...r,trancheId:tranche.id});
    }
  }
  return resultats;
}
export async function genererDesignations(libelle,qte,unite){
  const prompt=`Tu es un expert BTP français. Génère 4 versions de désignation professionnelle pour ce poste de travaux.
Poste : "${libelle}" - Quantité : ${qte} ${unite}
Retourne UNIQUEMENT un JSON valide :
{
  "courte": "<désignation courte 1 ligne max>",
  "detaillee": "<désignation détaillée 3-4 lignes avec détail des prestations>",
  "technique": "<désignation technique avec références DTU/normes>",
  "commerciale": "<désignation commerciale orientée client final>"
}`;
  const res=await fetch("/api/estimer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:1000,messages:[{role:"user",content:prompt}]})});
  const data=await res.json();
  const text=data.content[0].text;
  const clean=text.replace(/```json|```/g,"").trim();
  return JSON.parse(clean);
}
