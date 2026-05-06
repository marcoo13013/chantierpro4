-- ═══════════════════════════════════════════════════════════════════════════
-- ChantierPro — Ajout colonnes code_postal + ville à clients
-- À coller dans Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════════════════
-- Bug résolu : import CSV échouait avec
--   "Could not find the 'code_postal' column of 'clients' in the schema cache"
-- car le schéma initial (20260513_clients.sql) n'incluait que `adresse`
-- en un seul champ. Le module d'import sépare ville/CP pour matcher les
-- exports Excel/CSV standards FR (qui ont 1 colonne par champ).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS code_postal text,
  ADD COLUMN IF NOT EXISTS ville       text;

-- Index optionnel pour les recherches par ville (utile si beaucoup de clients)
CREATE INDEX IF NOT EXISTS clients_ville_idx ON public.clients(user_id, ville);

-- ═══════════════════════════════════════════════════════════════════════════
-- Vérification :
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='clients'
--    ORDER BY ordinal_position;
-- ═══════════════════════════════════════════════════════════════════════════
