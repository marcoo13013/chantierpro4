#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ChantierPro — Générateur d'icônes PNG depuis icon.svg
// ═══════════════════════════════════════════════════════════════════════════
// Usage :
//   1) Installer la dépendance dev (une seule fois) :
//        npm install --save-dev sharp
//   2) Lancer le script :
//        node public/generate-icons.js
//      (ou via le script npm : npm run icons)
//
// Génère public/icon-192.png et public/icon-512.png depuis public/icon.svg.
// Ces PNG sont nécessaires pour que le prompt d'install PWA se déclenche
// sur Chrome Android (qui exige au moins une icône PNG ≥ 192×192).
//
// NOTE : ce fichier est servi statiquement via Vite (public/ → dist/) mais
// ce n'est pas un module runtime — c'est juste un outil de build local.
// On le laisse dans public/ pour qu'il reste à côté de icon.svg.
// ═══════════════════════════════════════════════════════════════════════════

import { readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SVG_PATH = join(__dirname, 'icon.svg');
const OUTPUTS = [
  { size: 192, file: 'icon-192.png' },
  { size: 512, file: 'icon-512.png' },
];

async function main() {
  // 1) Vérifie que sharp est installé
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch (e) {
    console.error('\n❌ Dépendance "sharp" manquante.');
    console.error('   Installe-la avec :  npm install --save-dev sharp\n');
    process.exit(1);
  }

  // 2) Vérifie que icon.svg existe
  try {
    await access(SVG_PATH);
  } catch {
    console.error(`\n❌ ${SVG_PATH} introuvable.\n`);
    process.exit(1);
  }

  // 3) Lit le SVG une fois
  const svgBuffer = await readFile(SVG_PATH);
  console.log(`📄 Source : ${SVG_PATH} (${svgBuffer.length} octets)\n`);

  // 4) Génère chaque taille
  // ⚠ flatten() force un fond opaque navy → supprime tout canal alpha.
  // Sans ça, les coins arrondis du SVG (rx=112) laissent des pixels
  // transparents → iOS dark mode applique un compositing automatique
  // qui décolore l'icône. PNG sans transparence = rendu identique en
  // light/dark mode. iOS et Android s'occupent eux-mêmes du masking
  // arrondi sur l'écran d'accueil.
  const NAVY = { r: 27, g: 58, b: 92 };
  for (const { size, file } of OUTPUTS) {
    const out = join(__dirname, file);
    try {
      await sharp(svgBuffer, { density: Math.max(72, Math.round(size * 2)) })
        .resize(size, size, {
          fit: 'contain',
          background: { ...NAVY, alpha: 1 },
        })
        .flatten({ background: NAVY })
        .png({ compressionLevel: 9 })
        .toFile(out);
      const stat = await readFile(out);
      console.log(`✓ ${file} (${size}×${size}, ${(stat.length / 1024).toFixed(1)} KB, no alpha)`);
    } catch (e) {
      console.error(`✗ ${file} : ${e.message}`);
      process.exit(1);
    }
  }

  console.log(`\n✅ ${OUTPUTS.length} icônes générées dans public/`);
  console.log('   → commit + push pour les déployer sur Vercel');
  console.log('   → manifest.json les référence déjà (icon-192.png + icon-512.png)\n');
}

main().catch((e) => {
  console.error('\n❌ Erreur inattendue :', e?.message || e);
  process.exit(1);
});
