// ============================================================
// IA DEVIS — Estimation MO + Fournitures via Claude API
// ============================================================

const TAUX_HORAIRE = 35; // €/h chargé

export async function estimerLigne(libelle, qte, unite, puHT) {
  const prompt = `Tu es un expert BTP français (référentiels Artiprix, Batiprix, Mediabat).
Pour ce poste de travaux, donne UNIQUEMENT un JSON valide, sans texte avant ou après :
Poste : "${libelle}" - Quantité : ${qte} ${unite} - Prix unitaire HT : ${puHT}€

{
  "heuresMO": <nombre d'heures main d'oeuvre totales pour ce poste>,
  "tauxHoraire": ${TAUX_HORAIRE},
  "fournitures": [
    {"fournisseur": "Point P", "designation": "${libelle}", "qte": ${qte}, "unite": "${unite}", "prixAchat": <prix>, "prixPointP": <prix>},
    {"fournisseur": "Gedimat", "designation": "${libelle}", "qte": ${qte}, "unite": "${unite}", "prixAchat": <prix>, "prixGedimat": <prix>},
    {"fournisseur": "Kiloutou", "designation": "${libelle}", "qte": ${qte}, "unite": "${unite}", "prixAchat": <prix>, "prixKiloutou": <prix>}
  ],
  "commentaire": "<explication courte>"
}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    const text = data.content[0].text;
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch (e) {
    return {
      heuresMO: Math.round((puHT * qte) / (TAUX_HORAIRE * 3)),
      tauxHoraire: TAUX_HORAIRE,
      fournitures: [
        { fournisseur: "Point P", designation: libelle, qte, unite, prixAchat: puHT * 0.85 },
        { fournisseur: "Gedimat", designation: libelle, qte, unite, prixAchat: puHT * 0.88 },
        { fournisseur: "Kiloutou", designation: libelle, qte, unite, prixAchat: puHT * 0.90 },
      ],
      commentaire: "Estimation automatique (fallback)",
    };
  }
}

export async function estimerDevis(devis) {
  const resultats = [];
  for (const tranche of (devis.tranches || [])) {
    for (const ligne of (tranche.lignes || [])) {
      const estimation = await estimerLigne(
        ligne.libelle, ligne.qte, ligne.unite || "U", ligne.puHT || ligne.prixUnitHT || 0
      );
      resultats.push({ ...ligne, ...estimation, trancheId: tranche.id });
    }
  }
  return resultats;
}
