// ═══════════════════════════════════════════════════════════════════════════
// dossierExport.js — export d'un dossier client en PDF concat / ZIP / mail
// ═══════════════════════════════════════════════════════════════════════════
// Format PDF complet : concatene devis + acomptes + facture + recapitulatif.
// Format ZIP : tous les PDFs separes + recapitulatif, via JSZip.
// Format mail : ouvre un mailto pre-rempli avec un lien vers le PDF (le user
// devra l'attacher manuellement — limitation mailto).
//
// Lazy-load des libs lourdes (pdf-lib + jszip) pour ne pas alourdir le chunk
// principal.
// ═══════════════════════════════════════════════════════════════════════════

import { buildInvoicePdf } from "./facturx/buildPdf";

// ─── Sanitize pour encodage WinAnsi (PDF standard) ─────────────────────────
// Implementation char-by-char pour eviter d'avoir U+2028/U+2029 LITTERAUX
// dans le source (ces line-terminators JS cassent le parser esbuild).
// On remplace les chars Unicode non-WinAnsi par leurs equivalents ASCII,
// et on strip tout caractere > U+00FF.
function sanitizeWinAnsi(s) {
  if (s == null) return "";
  const str = String(s);
  let out = "";
  for (let i = 0; i < str.length; i++) {
    const cc = str.charCodeAt(i);
    // Espaces non-standard NBSP, THIN, HAIR, NARROW NBSP, LINE SEP, PARA SEP, ZWSP, BOM
    if (cc === 0xA0 || cc === 0x2009 || cc === 0x200A || cc === 0x202F
      || cc === 0x2028 || cc === 0x2029 || cc === 0x200B || cc === 0xFEFF) {
      out += " ";
      continue;
    }
    // Tirets typographiques EN DASH, EM DASH, MINUS SIGN
    if (cc === 0x2013 || cc === 0x2014 || cc === 0x2212) { out += "-"; continue; }
    // Apostrophes typographiques
    if (cc === 0x2018 || cc === 0x2019 || cc === 0x201A || cc === 0x201B) { out += "'"; continue; }
    // Guillemets doubles typographiques + guillemets francais
    if (cc === 0x201C || cc === 0x201D || cc === 0x201E || cc === 0x201F
      || cc === 0xAB || cc === 0xBB) { out += '"'; continue; }
    // Ellipsis
    if (cc === 0x2026) { out += "..."; continue; }
    // Strip tout char hors WinAnsi (au-dela de U+00FF)
    if (cc > 0xFF) continue;
    // Strip caracteres de controle (sauf newline / tab)
    if ((cc >= 0x00 && cc <= 0x1F && cc !== 0x09 && cc !== 0x0A && cc !== 0x0D)
      || (cc >= 0x7F && cc <= 0x9F)) continue;
    out += str[i];
  }
  return out;
}

// ─── Slug pour nom de fichier ──────────────────────────────────────────────
function slug(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 50);
}

function aujourdHuiSlug() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function euro(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
}

function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── Adapte un doc ChantierPro (devis ou facture) au format buildInvoicePdf ─
function adapterDocPourPdf(doc) {
  return {
    ...doc,
    numero: doc.numero,
    dateEmission: doc.date || doc.dateEmission,
    dateEcheance: doc.dateEcheance || doc.date_echeance,
    lignes: doc.lignes || [],
    tranches: doc.tranches || [],
  };
}

// ─── Genere le PDF d'un doc unique (devis ou facture, sans Factur-X XML) ────
async function genererPdfDoc(doc, entreprise, client) {
  const facture = adapterDocPourPdf(doc);
  const bytes = await buildInvoicePdf({ facture, entreprise, client });
  return bytes;
}

// ─── Genere le PDF recapitulatif (page custom) ─────────────────────────────
async function genererRecapPdf(dossier, entreprise, calcDocTotal) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const MM = 2.83464;
  const A4_W = 210 * MM;
  const A4_H = 297 * MM;
  const MARGIN = 18 * MM;
  let page = doc.addPage([A4_W, A4_H]);
  let y = A4_H - MARGIN;

  const draw = (text, x, yy, opts = {}) => page.drawText(sanitizeWinAnsi(text), {
    x, y: yy, font: opts.bold ? fontBold : font, size: opts.size || 10,
    color: opts.color || rgb(0.06, 0.09, 0.16),
  });

  // En-tete entreprise
  draw(entreprise?.nom || "Entreprise", MARGIN, y, { bold: true, size: 16 });
  y -= 6 * MM;
  if (entreprise?.adresse) { draw(entreprise.adresse, MARGIN, y, { size: 9 }); y -= 4 * MM; }
  if (entreprise?.code_postal || entreprise?.ville) {
    draw(`${entreprise.code_postal || ""} ${entreprise.ville || ""}`.trim(), MARGIN, y, { size: 9 });
    y -= 4 * MM;
  }
  if (entreprise?.siret) { draw(`SIRET : ${entreprise.siret}`, MARGIN, y, { size: 8 }); y -= 3.5 * MM; }
  if (entreprise?.tva_intra) { draw(`TVA intra : ${entreprise.tva_intra}`, MARGIN, y, { size: 8 }); y -= 3.5 * MM; }
  y -= 4 * MM;

  // Titre
  draw("RECAPITULATIF DOSSIER CLIENT", MARGIN, y, { bold: true, size: 18, color: rgb(0.10, 0.23, 0.36) });
  y -= 8 * MM;

  // Client + chantier
  const ch = dossier.chantier;
  draw("Client :", MARGIN, y, { bold: true, size: 11 });
  draw(ch?.client || "-", MARGIN + 25 * MM, y, { size: 11 });
  y -= 5 * MM;
  draw("Chantier :", MARGIN, y, { bold: true, size: 11 });
  draw(ch?.nom || `#${ch?.id || "-"}`, MARGIN + 25 * MM, y, { size: 11 });
  y -= 5 * MM;
  if (ch?.adresse) {
    draw("Adresse :", MARGIN, y, { bold: true, size: 9 });
    draw(ch.adresse, MARGIN + 25 * MM, y, { size: 9 });
    y -= 5 * MM;
  }
  y -= 4 * MM;

  // Tableau recapitulatif
  draw("DOCUMENTS DU DOSSIER", MARGIN, y, { bold: true, size: 11 });
  y -= 5 * MM;

  const headers = [
    { label: "Type", x: MARGIN },
    { label: "Numero", x: MARGIN + 22 * MM },
    { label: "Date", x: MARGIN + 60 * MM },
    { label: "Montant TTC", x: MARGIN + 82 * MM, w: 35 * MM },
    { label: "Statut", x: MARGIN + 117 * MM },
  ];
  page.drawRectangle({ x: MARGIN, y: y - 4 * MM, width: A4_W - 2 * MARGIN, height: 5 * MM, color: rgb(0.10, 0.23, 0.36) });
  for (const h of headers) {
    page.drawText(sanitizeWinAnsi(h.label), { x: h.x + 1.5 * MM, y: y - 2.8 * MM, font: fontBold, size: 8.5, color: rgb(1, 1, 1) });
  }
  y -= 5 * MM;

  const rows = [];
  for (const d of dossier.devis) rows.push({ type: "Devis", numero: d.numero, date: d.date, montant: calcDocTotal(d).ttc, statut: d.statut });
  for (const a of dossier.acomptes) rows.push({ type: "Acompte", numero: a.numero, date: a.datePaiement || a.date, montant: calcDocTotal(a).ttc, statut: a.statut });
  for (const f of dossier.factures) rows.push({ type: "Facture", numero: f.numero, date: f.date, montant: calcDocTotal(f).ttc, statut: f.statut });

  let alt = false;
  for (const r of rows) {
    if (alt) page.drawRectangle({ x: MARGIN, y: y - 4 * MM, width: A4_W - 2 * MARGIN, height: 5 * MM, color: rgb(0.97, 0.98, 0.99) });
    alt = !alt;
    page.drawText(sanitizeWinAnsi(r.type), { x: MARGIN + 1.5 * MM, y: y - 2.8 * MM, font, size: 8.5 });
    page.drawText(sanitizeWinAnsi(r.numero || "-"), { x: MARGIN + 22 * MM + 1.5 * MM, y: y - 2.8 * MM, font, size: 8.5 });
    page.drawText(sanitizeWinAnsi(fmtDate(r.date)), { x: MARGIN + 60 * MM + 1.5 * MM, y: y - 2.8 * MM, font, size: 8.5 });
    const sMontant = sanitizeWinAnsi(euro(r.montant));
    page.drawText(sMontant, { x: MARGIN + 82 * MM + 35 * MM - 1.5 * MM - font.widthOfTextAtSize(sMontant, 8.5), y: y - 2.8 * MM, font: fontBold, size: 8.5 });
    page.drawText(sanitizeWinAnsi((r.statut || "-").toUpperCase()), { x: MARGIN + 117 * MM + 1.5 * MM, y: y - 2.8 * MM, font, size: 8.5 });
    y -= 5 * MM;
  }
  y -= 4 * MM;

  // Totaux
  page.drawLine({ start: { x: A4_W - MARGIN - 70 * MM, y }, end: { x: A4_W - MARGIN, y }, thickness: 0.5, color: rgb(0.86, 0.89, 0.92) });
  y -= 5 * MM;

  const totalsX = A4_W - MARGIN - 70 * MM;

  function drawTotalRow(label, value, bold = false) {
    draw(label, totalsX, y, { bold, size: 10 });
    const sv = sanitizeWinAnsi(euro(value));
    page.drawText(sv, { x: A4_W - MARGIN - (bold ? fontBold : font).widthOfTextAtSize(sv, 10), y, font: bold ? fontBold : font, size: 10 });
    y -= 5 * MM;
  }
  drawTotalRow("Total devis", dossier.totalDevis);
  drawTotalRow("Total facture", dossier.totalFact);
  drawTotalRow("Total encaisse", dossier.totalEnc);
  y -= 1 * MM;
  page.drawRectangle({ x: totalsX - 2 * MM, y: y - 1.5 * MM, width: A4_W - MARGIN - totalsX + 2 * MM, height: 7 * MM, color: rgb(0.10, 0.23, 0.36) });
  draw("Reste a percevoir", totalsX, y + 0.5 * MM, { bold: true, size: 11, color: rgb(1, 1, 1) });
  const sReste = sanitizeWinAnsi(euro(dossier.reste));
  page.drawText(sReste, { x: A4_W - MARGIN - fontBold.widthOfTextAtSize(sReste, 11), y: y + 0.5 * MM, font: fontBold, size: 11, color: rgb(1, 1, 1) });
  y -= 10 * MM;

  // Footer
  draw(`Recapitulatif genere le ${new Date().toLocaleString("fr-FR")} par ChantierPro`, MARGIN, MARGIN, { size: 7, color: rgb(0.39, 0.45, 0.55) });

  return await doc.save({ useObjectStreams: false });
}

// ─── Concatene plusieurs PDFs en un seul ───────────────────────────────────
async function concatenerPdfs(listOfBytes) {
  const { PDFDocument } = await import("pdf-lib");
  const merged = await PDFDocument.create();
  for (const bytes of listOfBytes) {
    const src = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(src, src.getPageIndices());
    for (const p of pages) merged.addPage(p);
  }
  return await merged.save({ useObjectStreams: false });
}

// ─── Declencheur de telechargement (Blob → ObjectURL → <a>) ────────────────
function downloadBlob(bytes, filename, mime) {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ═══════════════════════════════════════════════════════════════════════════
// API principale
// ═══════════════════════════════════════════════════════════════════════════
export async function exportDossier({ format, dossier, entreprise, client, calcDocTotal }) {
  const baseFilename = `dossier-${slug(dossier.chantier?.client)}-${slug(dossier.chantier?.nom)}-${aujourdHuiSlug()}`;

  // Genere tous les PDFs individuels (devis + acomptes + factures)
  const pdfs = [];
  let idx = 1;
  for (const d of dossier.devis) {
    const bytes = await genererPdfDoc(d, entreprise, client);
    pdfs.push({ filename: `${String(idx).padStart(2, "0")}-devis-${d.numero || d.id}.pdf`, bytes });
    idx++;
  }
  for (const a of dossier.acomptes) {
    const bytes = await genererPdfDoc(a, entreprise, client);
    pdfs.push({ filename: `${String(idx).padStart(2, "0")}-acompte-${a.numero || a.id}.pdf`, bytes });
    idx++;
  }
  for (const f of dossier.factures) {
    const bytes = await genererPdfDoc(f, entreprise, client);
    pdfs.push({ filename: `${String(idx).padStart(2, "0")}-facture-${f.numero || f.id}.pdf`, bytes });
    idx++;
  }
  // Recapitulatif en dernier
  const recapBytes = await genererRecapPdf(dossier, entreprise, calcDocTotal);
  pdfs.push({ filename: `${String(idx).padStart(2, "0")}-recapitulatif.pdf`, bytes: recapBytes });

  if (format === "pdf") {
    const merged = await concatenerPdfs(pdfs.map(p => p.bytes));
    downloadBlob(merged, `${baseFilename}.pdf`, "application/pdf");
    return;
  }

  if (format === "zip") {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    for (const p of pdfs) zip.file(p.filename, p.bytes);
    const zipBytes = await zip.generateAsync({ type: "uint8array" });
    downloadBlob(zipBytes, `${baseFilename.replace(/-\d{8}$/, "")}.zip`, "application/zip");
    return;
  }

  if (format === "mail") {
    const merged = await concatenerPdfs(pdfs.map(p => p.bytes));
    downloadBlob(merged, `${baseFilename}.pdf`, "application/pdf");
    const to = encodeURIComponent(client?.email || "");
    const subject = encodeURIComponent(`Dossier ${dossier.chantier?.nom || ""} - ${dossier.chantier?.client || ""}`);
    const body = encodeURIComponent([
      `Bonjour,`,
      ``,
      `Veuillez trouver ci-joint le dossier complet du chantier "${dossier.chantier?.nom || ""}".`,
      ``,
      `Recapitulatif :`,
      `- Total facture : ${euro(dossier.totalFact)}`,
      `- Total encaisse : ${euro(dossier.totalEnc)}`,
      `- Reste a percevoir : ${euro(dossier.reste)}`,
      ``,
      `Cordialement,`,
      entreprise?.nom || "",
    ].join("\r\n"));
    setTimeout(() => {
      window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    }, 400);
    return;
  }

  throw new Error(`Format export inconnu : ${format}`);
}
