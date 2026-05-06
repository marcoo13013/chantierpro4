-- ═══════════════════════════════════════════════════════════════════════════
-- ChantierPro — Fix infinite recursion RLS profiles
-- À coller dans Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════════════════
-- Bug : "infinite recursion detected in policy for relation profiles"
--
-- Cause : la policy profiles_select_self_or_admin fait un SELECT sur profiles
-- dans son USING clause pour vérifier si auth.uid() est admin. Postgres ré-applique
-- la policy à ce SELECT interne → récursion infinie.
--
-- Cascade : prospects_admin_only et audit_log_admin_only utilisent aussi
-- EXISTS (SELECT FROM profiles ...) — quand on lit ces tables, la sous-query
-- déclenche la policy profiles, qui boucle. On fixe les 3 d'un coup.
--
-- Fix : fonction is_admin(uid) SECURITY DEFINER. La fonction s'exécute avec
-- les droits du créateur (postgres role) qui bypass la RLS, donc le SELECT
-- interne ne ré-applique pas la policy → pas de récursion.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Fonction is_admin (SECURITY DEFINER) ────────────────────────────
-- search_path explicite pour éviter qu'un attaquant override "profiles" via
-- une table dans son propre schéma. STABLE = pas d'effet de bord, optimisable.
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
-- Aux anon NON — la fonction n'a aucun usage côté public.
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;

-- ─── 2. Recrée la policy profiles (la coupable principale) ──────────────
-- USING : self OU admin (via fonction qui bypass RLS).
DROP POLICY IF EXISTS profiles_select_self_or_admin ON public.profiles;
CREATE POLICY profiles_select_self_or_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id OR public.is_admin(auth.uid())
  );

-- ─── 3. Recrée la policy prospects (cascade — utilisait EXISTS profiles) ─
DROP POLICY IF EXISTS prospects_admin_only ON public.prospects;
CREATE POLICY prospects_admin_only ON public.prospects
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ─── 4. Recrée la policy audit_log (cascade idem) ───────────────────────
DROP POLICY IF EXISTS audit_log_admin_only ON public.audit_log;
CREATE POLICY audit_log_admin_only ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS APRÈS RUN :
--
-- 1. Test fonction (en tant que postgres ou via admin) :
--      SELECT public.is_admin('TON_UUID_ADMIN');  -- doit retourner true
--      SELECT public.is_admin('UUID_USER_NORMAL'); -- doit retourner false
--
-- 2. Test SELECT sur profiles (en tant qu'admin authentifié — via app) :
--      SELECT count(*) FROM public.profiles;
--      → doit retourner le total des profiles (pas seulement le sien)
--      → AUCUNE erreur "infinite recursion"
--
-- 3. Test SELECT sur profiles (en tant qu'user normal authentifié) :
--      SELECT count(*) FROM public.profiles;
--      → doit retourner 1 (son propre profile uniquement)
--
-- 4. Liste des policies actives :
--      SELECT polname, tablename FROM pg_policies
--       WHERE tablename IN ('profiles','prospects','audit_log')
--       ORDER BY tablename, polname;
-- ═══════════════════════════════════════════════════════════════════════════
