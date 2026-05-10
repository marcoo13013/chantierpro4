import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// Sourcemap activé en prod pour que les erreurs runtime (TDZ, etc.)
// pointent vers le fichier source d'origine dans DevTools console
// stack trace. Léger surcoût en taille (~+230KB par bundle).
//
// resolve.alias : la lib @stackforge-eu/factur-x importe statiquement
// node:fs / path / url / console pour sa fonction validateXsd() (chargement
// XSD depuis le filesystem). Côté browser, on N'APPELLE PAS validateXsd
// (cf src/lib/facturx/index.js → validateXsd: false). Mais Vite/Rollup
// analyse statiquement le bundle et plante sur ces imports node-only.
// Le stub src/lib/facturx-node-stubs.js exporte des helpers vides — la
// fonction validateXsd jettera une erreur si jamais appelée.
const stub = fileURLToPath(new URL('./src/lib/facturx-node-stubs.js', import.meta.url))
export default defineConfig({
  plugins: [react()],
  // target: esnext requis pour autoriser le top-level await utilisé par
  // libxml2-wasm (init du module WebAssembly). Tous les browsers cibles
  // de ChantierPro (Chrome 89+, Safari 15+, FF 89+) le supportent.
  build: { sourcemap: true, target: 'esnext' },
  optimizeDeps: { esbuildOptions: { target: 'esnext' } },
  resolve: {
    alias: [
      { find: /^node:fs$/,      replacement: stub },
      { find: /^node:path$/,    replacement: stub },
      { find: /^node:url$/,     replacement: stub },
      { find: /^node:console$/, replacement: stub },
      { find: /^node:module$/,  replacement: stub },
      { find: /^fs$/,           replacement: stub },
      { find: /^path$/,         replacement: stub },
      { find: /^url$/,          replacement: stub },
      { find: /^console$/,      replacement: stub },
      { find: /^module$/,       replacement: stub },
    ],
  },
})
