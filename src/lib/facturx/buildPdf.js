// ═══════════════════════════════════════════════════════════════════════════
// buildPdf.js — génère le PDF visuel d'une facture avec pdf-lib
// ═══════════════════════════════════════════════════════════════════════════
// API impérative : on dessine ligne par ligne sur une page A4 portrait. Sortie :
// Uint8Array prêt à être passé à embedFacturX (qui ajoutera le PDF/A-3
// metadata + le XML CII en attachement).
//
// Visuel volontairement sobre : pas de couleurs custom, pas de logo, pas de
// modèles « Moderne / Inter / Pierre ». L'argument est : conformité Factur-X
// > esthétique. L'ancien window.print() reste dispo pour les brouillons riches.
// ═══════════════════════════════════════════════════════════════════════════

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Conversion mm → points PDF (1 mm = 2.83464 pt)
const MM = 2.83464;
const A4_W = 210 * MM; // 595.28 pt
const A4_H = 297 * MM; // 841.89 pt
const MARGIN = 18 * MM; // marge 18 mm de chaque côté

// Palette (rgb 0..1)
const COL = {
  text: rgb(0.06, 0.09, 0.16),
  textMd: rgb(0.20, 0.25, 0.33),
  textSm: rgb(0.39, 0.45, 0.55),
  border: rgb(0.86, 0.89, 0.92),
  navy: rgb(0.10, 0.23, 0.36),
  navyBg: rgb(0.93, 0.95, 0.97),
  accent: rgb(0.91, 0.38, 0.04),
};

// Format numérique FR avec 2 décimales et espace insécable comme séparateur milliers
function euro(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
}

function fmtDateFR(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Helper : draw text avec wrap simple sur une largeur max
function drawWrapped(page, text, { x, y, font, size, color, maxWidth, lineHeight }) {
  if (!text) return y;
  const words = String(text).split(/\s+/);
  let line = "";
  let curY = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    const width = font.widthOfTextAtSize(test, size);
    if (width > maxWidth && line) {
      page.drawText(line, { x, y: curY, font, size, color });
      curY -= lineHeight;
      line = w;
    } else {
      line = test;
    }
  }
  if (line) {
    page.drawText(line, { x, y: curY, font, size, color });
    curY -= lineHeight;
  }
  return curY;
}

// Aplatit les lignes (cf buildInput.extraireLignesPlates) pour rendu PDF.
function extraireLignes(facture) {
  const out = [];
  if (Array.isArray(facture?.lignes)) {
    for (const l of facture.lignes) {
      if (l?.type === "titre" || l?.type === "soustitre") continue;
      out.push(l);
    }
  }
  if (Array.isArray(facture?.tranches)) {
    for (const t of facture.tranches) {
      for (const l of (t?.lignes || [])) {
        if (l?.type === "titre" || l?.type === "soustitre") continue;
        out.push({ ...l, _tranche: t.titre });
      }
    }
  }
  return out;
}

function totalHT(l) {
  const pu = Number(l.prixUnitHT ?? l.puHT ?? 0);
  const q = Number(l.qte ?? l.quantite ?? 1);
  return pu * q;
}

// ─── Génération principale ──────────────────────────────────────────────────
export async function buildInvoicePdf({ facture, entreprise, client }) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Métadonnées document (utiles pour Acrobat / clients de mail)
  pdfDoc.setTitle(`Facture ${facture?.numero || ""} - ${entreprise?.nom || ""}`);
  pdfDoc.setAuthor(entreprise?.nom || "ChantierPro");
  pdfDoc.setCreator("ChantierPro - Factur-X compliant");
  pdfDoc.setProducer("@stackforge-eu/factur-x via pdf-lib");
  pdfDoc.setSubject(`Facture ${facture?.numero || ""}`);
  pdfDoc.setKeywords(["facture", "factur-x", "en16931", "pdf-a3", "invoice"]);

  let page = pdfDoc.addPage([A4_W, A4_H]);
  let y = A4_H - MARGIN; // curseur descendant

  // ─── Header : émetteur (gauche) + bloc destinataire (droite) ──────────────
  const headerStartY = y;

  // Émetteur
  page.drawText(entreprise?.nom || "Émetteur", { x: MARGIN, y, font: fontBold, size: 14, color: COL.text });
  y -= 5 * MM;
  if (entreprise?.activite) {
    page.drawText(String(entreprise.activite), { x: MARGIN, y, font, size: 9, color: COL.textSm });
    y -= 4 * MM;
  }
  if (entreprise?.adresse) {
    y = drawWrapped(page, entreprise.adresse, { x: MARGIN, y, font, size: 9, color: COL.textMd, maxWidth: 80 * MM, lineHeight: 4 * MM });
  }
  if (entreprise?.code_postal || entreprise?.ville) {
    page.drawText(`${entreprise.code_postal || ""} ${entreprise.ville || ""}`.trim(), { x: MARGIN, y, font, size: 9, color: COL.textMd });
    y -= 4 * MM;
  }
  if (entreprise?.tel) {
    page.drawText(`Tél : ${entreprise.tel}`, { x: MARGIN, y, font, size: 8, color: COL.textSm });
    y -= 3.5 * MM;
  }
  if (entreprise?.email) {
    page.drawText(entreprise.email, { x: MARGIN, y, font, size: 8, color: COL.textSm });
    y -= 3.5 * MM;
  }
  if (entreprise?.siret) {
    page.drawText(`SIRET : ${entreprise.siret}`, { x: MARGIN, y, font, size: 8, color: COL.textSm });
    y -= 3.5 * MM;
  }
  if (entreprise?.tva_intra) {
    page.drawText(`TVA : ${entreprise.tva_intra}`, { x: MARGIN, y, font, size: 8, color: COL.textSm });
    y -= 3.5 * MM;
  }

  // Bloc destinataire (droite)
  let destY = headerStartY;
  const destX = A4_W - MARGIN - 80 * MM;
  page.drawRectangle({ x: destX - 4, y: destY - 36 * MM, width: 84 * MM, height: 38 * MM, borderColor: COL.border, borderWidth: 0.5, color: COL.navyBg });
  page.drawText("DESTINATAIRE", { x: destX, y: destY - 5 * MM, font: fontBold, size: 8, color: COL.navy });
  destY -= 10 * MM;
  const destNom = (client?.raison_sociale && client.raison_sociale.trim())
    || ([client?.prenom, client?.nom].filter(Boolean).join(" ").trim())
    || (client?.nom || "Client");
  page.drawText(destNom, { x: destX, y: destY, font: fontBold, size: 11, color: COL.text });
  destY -= 5 * MM;
  if (client?.adresse) {
    destY = drawWrapped(page, client.adresse, { x: destX, y: destY, font, size: 9, color: COL.textMd, maxWidth: 78 * MM, lineHeight: 4 * MM });
  }
  if (client?.code_postal || client?.ville) {
    page.drawText(`${client.code_postal || ""} ${client.ville || ""}`.trim(), { x: destX, y: destY, font, size: 9, color: COL.textMd });
    destY -= 4 * MM;
  }
  if (client?.siret) {
    page.drawText(`SIRET : ${client.siret}`, { x: destX, y: destY, font, size: 8, color: COL.textSm });
    destY -= 3.5 * MM;
  }
  if (client?.tva_intra) {
    page.drawText(`TVA : ${client.tva_intra}`, { x: destX, y: destY, font, size: 8, color: COL.textSm });
    destY -= 3.5 * MM;
  }

  // Place le curseur en dessous du bloc le plus bas
  y = Math.min(y, destY) - 6 * MM;

  // ─── Titre facture + dates ────────────────────────────────────────────────
  page.drawText(`FACTURE n° ${facture?.numero || "—"}`, { x: MARGIN, y, font: fontBold, size: 16, color: COL.navy });
  y -= 7 * MM;

  const issueDate = facture?.dateEmission || facture?.date_emission || facture?.date || new Date().toISOString();
  const dueDate = facture?.dateEcheance || facture?.date_echeance;

  page.drawText(`Date d'émission : ${fmtDateFR(issueDate)}`, { x: MARGIN, y, font, size: 9, color: COL.textMd });
  if (dueDate) {
    page.drawText(`Date d'échéance : ${fmtDateFR(dueDate)}`, { x: MARGIN + 70 * MM, y, font, size: 9, color: COL.textMd });
  }
  y -= 4 * MM;
  if (facture?.referenceCommande || facture?.reference_commande) {
    page.drawText(`Référence : ${facture.referenceCommande || facture.reference_commande}`, { x: MARGIN, y, font, size: 9, color: COL.textMd });
    y -= 4 * MM;
  }

  y -= 4 * MM;

  // ─── Tableau des lignes ────────────────────────────────────────────────────
  const lignes = extraireLignes(facture);
  // Colonnes : Désignation, Qté, Unité, PU HT, TVA, Total HT
  const colDesignW = 90 * MM;
  const colQteW = 14 * MM;
  const colUniteW = 14 * MM;
  const colPuHTW = 22 * MM;
  const colTvaW = 12 * MM;
  const colTotalW = 22 * MM;
  const tableX = MARGIN;
  const tableEndX = tableX + colDesignW + colQteW + colUniteW + colPuHTW + colTvaW + colTotalW;

  // Header tableau
  page.drawRectangle({ x: tableX, y: y - 5 * MM, width: tableEndX - tableX, height: 5 * MM, color: COL.navy });
  let tx = tableX + 1.5 * MM;
  page.drawText("Désignation", { x: tx, y: y - 3.6 * MM, font: fontBold, size: 8.5, color: rgb(1, 1, 1) }); tx += colDesignW;
  page.drawText("Qté", { x: tx + colQteW - 1.5 * MM - fontBold.widthOfTextAtSize("Qté", 8.5), y: y - 3.6 * MM, font: fontBold, size: 8.5, color: rgb(1, 1, 1) }); tx += colQteW;
  page.drawText("Unité", { x: tx + 1.5 * MM, y: y - 3.6 * MM, font: fontBold, size: 8.5, color: rgb(1, 1, 1) }); tx += colUniteW;
  page.drawText("PU HT", { x: tx + colPuHTW - 1.5 * MM - fontBold.widthOfTextAtSize("PU HT", 8.5), y: y - 3.6 * MM, font: fontBold, size: 8.5, color: rgb(1, 1, 1) }); tx += colPuHTW;
  page.drawText("TVA", { x: tx + colTvaW - 1.5 * MM - fontBold.widthOfTextAtSize("TVA", 8.5), y: y - 3.6 * MM, font: fontBold, size: 8.5, color: rgb(1, 1, 1) }); tx += colTvaW;
  page.drawText("Total HT", { x: tx + colTotalW - 1.5 * MM - fontBold.widthOfTextAtSize("Total HT", 8.5), y: y - 3.6 * MM, font: fontBold, size: 8.5, color: rgb(1, 1, 1) });
  y -= 5 * MM;

  // Lignes
  let alt = false;
  for (const l of lignes) {
    const designation = l.libelle || l.designation || l.tache || "—";
    const qte = Number(l.qte ?? l.quantite ?? 1);
    const unite = l.unite || "U";
    const pu = Number(l.prixUnitHT ?? l.puHT ?? 0);
    const tvaPct = Number(l.tvaPct ?? l.tva ?? 20);
    const tot = totalHT(l);

    // Estimer hauteur (multiline désignation)
    const desigLines = Math.max(1, Math.ceil(font.widthOfTextAtSize(designation, 8.5) / colDesignW));
    const rowH = Math.max(5 * MM, desigLines * 3.5 * MM + 1 * MM);

    // Pagination si on dépasse la marge basse
    if (y - rowH < MARGIN + 50 * MM) {
      page = pdfDoc.addPage([A4_W, A4_H]);
      y = A4_H - MARGIN;
    }

    if (alt) {
      page.drawRectangle({ x: tableX, y: y - rowH, width: tableEndX - tableX, height: rowH, color: COL.navyBg, opacity: 0.5 });
    }
    alt = !alt;

    let cx = tableX + 1.5 * MM;
    drawWrapped(page, designation, { x: cx, y: y - 3.6 * MM, font, size: 8.5, color: COL.text, maxWidth: colDesignW - 3 * MM, lineHeight: 3.5 * MM });
    cx += colDesignW;
    const qteStr = qte.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    page.drawText(qteStr, { x: cx + colQteW - 1.5 * MM - font.widthOfTextAtSize(qteStr, 8.5), y: y - 3.6 * MM, font, size: 8.5, color: COL.textMd });
    cx += colQteW;
    page.drawText(unite, { x: cx + 1.5 * MM, y: y - 3.6 * MM, font, size: 8.5, color: COL.textMd });
    cx += colUniteW;
    const puStr = euro(pu);
    page.drawText(puStr, { x: cx + colPuHTW - 1.5 * MM - font.widthOfTextAtSize(puStr, 8.5), y: y - 3.6 * MM, font, size: 8.5, color: COL.textMd });
    cx += colPuHTW;
    const tvaStr = `${tvaPct} %`;
    page.drawText(tvaStr, { x: cx + colTvaW - 1.5 * MM - font.widthOfTextAtSize(tvaStr, 8.5), y: y - 3.6 * MM, font, size: 8.5, color: COL.textMd });
    cx += colTvaW;
    const totStr = euro(tot);
    page.drawText(totStr, { x: cx + colTotalW - 1.5 * MM - fontBold.widthOfTextAtSize(totStr, 8.5), y: y - 3.6 * MM, font: fontBold, size: 8.5, color: COL.text });
    y -= rowH;

    // Séparateur
    page.drawLine({ start: { x: tableX, y }, end: { x: tableEndX, y }, thickness: 0.3, color: COL.border });
  }

  // ─── Totaux ────────────────────────────────────────────────────────────────
  y -= 6 * MM;
  // Ventilation TVA par taux
  const breakdown = new Map();
  for (const l of lignes) {
    const pct = Number(l.tvaPct ?? l.tva ?? 20);
    const ht = totalHT(l);
    const cur = breakdown.get(pct) || { ht: 0, tva: 0 };
    cur.ht += ht;
    cur.tva += ht * (pct / 100);
    breakdown.set(pct, cur);
  }

  const totalsX = A4_W - MARGIN - 70 * MM;
  for (const [pct, b] of breakdown.entries()) {
    page.drawText(`Base HT TVA ${pct} % :`, { x: totalsX, y, font, size: 9, color: COL.textMd });
    const s1 = euro(b.ht);
    page.drawText(s1, { x: A4_W - MARGIN - font.widthOfTextAtSize(s1, 9), y, font, size: 9, color: COL.textMd });
    y -= 4 * MM;
    page.drawText(`Montant TVA ${pct} % :`, { x: totalsX, y, font, size: 9, color: COL.textMd });
    const s2 = euro(b.tva);
    page.drawText(s2, { x: A4_W - MARGIN - font.widthOfTextAtSize(s2, 9), y, font, size: 9, color: COL.textMd });
    y -= 5 * MM;
  }

  const totalHTSum = Array.from(breakdown.values()).reduce((a, b) => a + b.ht, 0);
  const totalTVASum = Array.from(breakdown.values()).reduce((a, b) => a + b.tva, 0);
  const totalTTC = totalHTSum + totalTVASum;

  page.drawLine({ start: { x: totalsX - 2 * MM, y: y + 1 * MM }, end: { x: A4_W - MARGIN, y: y + 1 * MM }, thickness: 0.6, color: COL.border });
  y -= 1 * MM;

  page.drawText("Total HT", { x: totalsX, y, font: fontBold, size: 10, color: COL.text });
  const sht = euro(totalHTSum);
  page.drawText(sht, { x: A4_W - MARGIN - fontBold.widthOfTextAtSize(sht, 10), y, font: fontBold, size: 10, color: COL.text });
  y -= 5 * MM;

  page.drawText("Total TVA", { x: totalsX, y, font: fontBold, size: 10, color: COL.text });
  const stva = euro(totalTVASum);
  page.drawText(stva, { x: A4_W - MARGIN - fontBold.widthOfTextAtSize(stva, 10), y, font: fontBold, size: 10, color: COL.text });
  y -= 5 * MM;

  page.drawRectangle({ x: totalsX - 2 * MM, y: y - 1.5 * MM, width: A4_W - MARGIN - totalsX + 2 * MM, height: 7 * MM, color: COL.navy });
  page.drawText("Total TTC (Net à payer)", { x: totalsX, y: y + 0.5 * MM, font: fontBold, size: 11, color: rgb(1, 1, 1) });
  const sttc = euro(totalTTC);
  page.drawText(sttc, { x: A4_W - MARGIN - fontBold.widthOfTextAtSize(sttc, 11), y: y + 0.5 * MM, font: fontBold, size: 11, color: rgb(1, 1, 1) });
  y -= 10 * MM;

  // ─── Mentions paiement ────────────────────────────────────────────────────
  y -= 4 * MM;
  page.drawText("MODALITÉS DE PAIEMENT", { x: MARGIN, y, font: fontBold, size: 9, color: COL.navy });
  y -= 4 * MM;
  if (entreprise?.iban) {
    page.drawText(`IBAN : ${entreprise.iban}`, { x: MARGIN, y, font, size: 9, color: COL.textMd });
    y -= 3.5 * MM;
  }
  if (entreprise?.bic) {
    page.drawText(`BIC : ${entreprise.bic}`, { x: MARGIN, y, font, size: 9, color: COL.textMd });
    y -= 3.5 * MM;
  }
  if (dueDate) {
    page.drawText(`Échéance : ${fmtDateFR(dueDate)}`, { x: MARGIN, y, font, size: 9, color: COL.textMd });
    y -= 3.5 * MM;
  }

  // Mentions légales obligatoires (pénalités de retard L441-10)
  y -= 4 * MM;
  page.drawText("MENTIONS LÉGALES", { x: MARGIN, y, font: fontBold, size: 8, color: COL.textSm });
  y -= 3.5 * MM;
  const mentions = "En cas de retard de paiement : pénalités au taux BCE majoré de 10 points + indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 et D441-5 du Code de commerce). Pas d'escompte pour paiement anticipé.";
  y = drawWrapped(page, mentions, { x: MARGIN, y, font, size: 7.5, color: COL.textSm, maxWidth: A4_W - 2 * MARGIN, lineHeight: 3 * MM });

  // ─── Pied de page Factur-X ────────────────────────────────────────────────
  // Bandeau accent en bas pour mettre en valeur la conformité
  const footerY = MARGIN + 8 * MM;
  page.drawRectangle({ x: 0, y: 0, width: A4_W, height: footerY, color: COL.navyBg });
  page.drawText("✓ Facture conforme Factur-X / EN 16931 — Réforme française 2026", {
    x: MARGIN,
    y: footerY - 5 * MM,
    font: fontBold,
    size: 8,
    color: COL.navy,
  });
  page.drawText(`Généré par ChantierPro · ${new Date().toLocaleDateString("fr-FR")}`, {
    x: MARGIN,
    y: footerY - 8.5 * MM,
    font,
    size: 7,
    color: COL.textSm,
  });

  return await pdfDoc.save({ useObjectStreams: false });
}
