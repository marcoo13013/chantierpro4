// ═══════════════════════════════════════════════════════════════════════════
// Client Supabase — ChantierPro V14
// ═══════════════════════════════════════════════════════════════════════════
// Ce fichier initialise la connexion à Supabase.
// Les variables SUPABASE_URL et SUPABASE_ANON_KEY viennent de Vercel
// (ou d'un fichier .env local si tu développes en local).
//
// La clé anon est PUBLIQUE, pas de souci qu'elle soit visible dans le code
// compilé. Ce qui protège les données, c'est la RLS configurée dans Supabase.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Safeguard : si les variables ne sont pas définies (oubli côté Vercel), 
// on log une erreur claire mais on ne fait pas planter l'app.
if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error(
    '[Supabase] Variables d\'environnement manquantes.\n' +
    'Verifie que VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont definies sur Vercel.'
  );
}

export const supabase = (SUPABASE_URL && SUPABASE_ANON)
  ? createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: {
        persistSession: true,       // garde la session apres refresh
        autoRefreshToken: true,     // renouvelle le token automatiquement
        detectSessionInUrl: true,   // utile pour les magic links
      },
    })
  : null;

// Helper : est-ce que Supabase est correctement configure ?
export const isSupabaseConfigured = () => supabase !== null;
