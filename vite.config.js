import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// Sourcemap activé en prod pour que les erreurs runtime (TDZ, etc.)
// pointent vers le fichier source d'origine dans DevTools console
// stack trace. Léger surcoût en taille (~+230KB par bundle).
export default defineConfig({ plugins: [react()], build: { sourcemap: true } })
