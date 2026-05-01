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
Règles :
- Si unite=M2 ou M3 : heuresMO et fournitures sont PAR unité de surface
- Si unite=U/ENS/F : heuresMO et fournitures sont pour l'ensemble du poste
- nbOuvriers : nombre d'ouvriers recommandés (1 à 4)
- fournitures : liste DETAILLEE et REALISTE des matériaux nécessaires
- Les 3 prix doivent être cohérents avec le marché PACA 2024
- Calcul : puHT = (heuresMO x ${TAUX} x ${cm} + totalAchatFourn x ${cf}) / (1 - marge)
{
  "heuresMO": <heures totales main d'oeuvre>,
  "nbOuvriers": <nombre ouvriers recommandés>,
  "tauxHoraire": ${TAUX},
  "coeffMO": ${cm},
  "totalMO": <heuresMO x ${TAUX} x ${cm}>,
  "fournitures": [
    {"fournisseur":"<Point P|Gedimat|Kiloutou|Leroy Merlin>","designation":"<article précis et réaliste>","qte":<qte>,"unite":"<unite>","prixAchat":<prix achat HT unitaire>,"prixVente":<prixAchat x ${cf}>}
  ],
  "totalAchatFourn": <somme totale achat fournitures>,
  "totalVenteFourn": <somme totale vente fournitures>,
  "prix": {
    "bas":   {"puHT": <prix bas cohérent marché>,   "marge": 30, "label": "Compétitif"},
    "moyen": {"puHT": <prix moyen cohérent marché>, "marge": 40, "label": "Marché"},
    "haut":  {"puHT": <prix haut cohérent marché>,  "marge": 50, "label": "Premium"}
  },
  "puHT": <prix moyen recommandé par défaut>,
  "commentaire": "<conseil ou difficulté technique courte>"
}`;
  try{
const res=await fetch("/api/estimer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:2000,messages:[{role:"user",content:prompt}]})});
    const data=await res.json();
    const text=data.content[0].text;
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
