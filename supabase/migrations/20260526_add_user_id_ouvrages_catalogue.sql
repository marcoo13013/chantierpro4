-- ═══════════════════════════════════════════════════════════════════════════
-- ChantierPro — Ajout user_id + RLS à ouvrages_catalogue
-- À coller dans Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════════════════
-- Contexte : la table ouvrages_catalogue existe depuis longtemps côté Supabase
-- (chargée par useOuvragesBibliotheque dans src/lib/ouvrages.js) et contient
-- les ouvrages globaux Artiprix / Batiprix (user_id IS NULL = lecture publique
-- pour tous les utilisateurs authentifiés).
--
-- Cette migration ajoute la possibilité pour chaque utilisateur d'avoir SES
-- propres ouvrages persos (source = "Personnel"), importés via le wizard
-- /import ou créés manuellement depuis la Bibliothèque.
--
-- Pattern aligné sur articles_catalogue (migration 20260524) :
--   - user_id NULL → ouvrage partagé global (Artiprix/Batiprix existants)
--   - user_id = uid → ouvrage personnel (lecture+écriture par le propriétaire)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.ouvrages_catalogue
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ouvrages_catalogue_user_id
  ON public.ouvrages_catalogue(user_id);

ALTER TABLE public.ouvrages_catalogue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ouvrages_catalogue_select ON public.ouvrages_catalogue;
CREATE POLICY ouvrages_catalogue_select ON public.ouvrages_catalogue
  FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS ouvrages_catalogue_insert ON public.ouvrages_catalogue;
CREATE POLICY ouvrages_catalogue_insert ON public.ouvrages_catalogue
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ouvrages_catalogue_update ON public.ouvrages_catalogue;
CREATE POLICY ouvrages_catalogue_update ON public.ouvrages_catalogue
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ouvrages_catalogue_delete ON public.ouvrages_catalogue;
CREATE POLICY ouvrages_catalogue_delete ON public.ouvrages_catalogue
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS POST-MIGRATION :
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='ouvrages_catalogue'
--      AND column_name='user_id';
--   SELECT polname FROM pg_policies
--    WHERE schemaname='public' AND tablename='ouvrages_catalogue'
--    ORDER BY polname;
-- ═══════════════════════════════════════════════════════════════════════════
