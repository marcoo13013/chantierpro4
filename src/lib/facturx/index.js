// ═══════════════════════════════════════════════════════════════════════════
// facturx/index.js — orchestrateur génération facture Factur-X
// ═══════════════════════════════════════════════════════════════════════════
// Point d'entrée unique : appelé par le bouton "📥 Factur-X" de la VueFacture.
// Lazy-load des libs lourdes (pdf-lib + @stackforge-eu/factur-x + libxml2-wasm)
// pour ne pas alourdir le bundle initial — ces imports ne sont chargés qu'au
// premier clic sur le bouton.
//
// Pipeline :
//   1. buildInvoicePdf  → génère le PDF visuel (Uint8Array)
//   2. buildFacturXInvoiceInput → mappe la facture au format EN 16931
//   3. embedFacturX     → embarque le XML CII dans le PDF en PDF/A-3b
//   4. retourne un Blob téléchargeable
// ═══════════════════════════════════════════════════════════════════════════

export { auditConformiteFacturX } from "./validation.js";

// ─── Génération principale ──────────────────────────────────────────────────
// Renvoie { blob: Blob, filename: string, profile: string } prêt à download.
export async function generateFacturXInvoice({ facture, entreprise, client }) {
  // Lazy-load (split chunk Vite)
  const [{ buildInvoicePdf }, { buildFacturXInvoiceInput }, facturx] = await Promise.all([
    import("./buildPdf.js"),
    import("./buildInput.js"),
    import("@stackforge-eu/factur-x"),
  ]);
  const { embedFacturX, Profile, Flavor } = facturx;

  // 1. Génère le PDF visuel
  const pdfBytes = await buildInvoicePdf({ facture, entreprise, client });

  // 2. Construit l'input EN 16931
  const input = buildFacturXInvoiceInput({ facture, entreprise, client });

  // 3. Embarque le XML CII + PDF/A-3 metadata
  // validateBeforeEmbed: true par défaut → si l'input est invalide pour BASIC_WL,
  // l'erreur est lancée ici (catché par l'appelant pour afficher l'alerte).
  const result = await embedFacturX({
    pdf: pdfBytes,
    input,
    profile: Profile.BASIC_WL,
    flavor: Flavor.FACTUR_X,
    validateBeforeEmbed: true,
    // validateXsd: false par défaut — la validation XSD nécessite les schémas
    // libxml2-wasm. Désactivé pour rester léger ; le validateur en ligne
    // permettra la vérif finale.
  });

  // 4. Blob téléchargeable
  const blob = new Blob([result.pdf], { type: "application/pdf" });
  const safeNumero = String(facture?.numero || "facture").replace(/[^A-Za-z0-9_.-]/g, "_");
  return {
    blob,
    filename: `${safeNumero}-facturx.pdf`,
    profile: "BASIC WL",
  };
}

// Helper : déclenche le download dans le browser (pour intégration UI directe)
export async function downloadFacturXInvoice({ facture, entreprise, client }) {
  const { blob, filename } = await generateFacturXInvoice({ facture, entreprise, client });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Libère la mémoire après 1 s (le browser a eu le temps de démarrer le download)
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
