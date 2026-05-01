import { useState } from "react";
import { estimerLigne } from "../lib/iaDevis";

export default function BoutonIALigne({ ligne, onResult }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const result = await estimerLigne(
        ligne.libelle,
        ligne.qte,
        ligne.unite || "U",
        ligne.puHT || ligne.prixUnitHT || 0
      );
      onResult(result);
      setDone(true);
    } catch (e) {
      alert("Erreur IA : " + e.message);
    }
    setLoading(false);
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title="Estimer MO + fournitures avec l'IA"
      style={{
        background: done ? "#16A34A" : "#2563EB",
        color: "#fff",
        border: "none",
        borderRadius: 6,
        padding: "4px 10px",
        fontSize: 12,
        cursor: loading ? "wait" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      {loading ? "⏳" : done ? "✅ IA OK" : "✨ IA"}
    </button>
  );
}
