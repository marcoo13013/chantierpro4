-- ═══════════════════════════════════════════════════════════════════════════
-- ChantierPro — Mode admin + page prospect
-- À coller dans Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════════════════
-- 3 nouveautés :
--   1. table profiles : 1 row par user avec rôle ('user'|'admin')
--      Trigger AUTO insert profile à chaque création auth.users.
--      Backfill : crée profile pour les users existants.
--      Marco (francehabitat.immo@gmail.com) = admin.
--   2. table prospects : leads de la page /demo publique.
--   3. table audit_log : trace toutes les impersonations admin.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Table profiles ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text,
  role       text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS : un user voit son propre profile + un admin voit tous les profiles.
DROP POLICY IF EXISTS profiles_select_self_or_admin ON public.profiles;
CREATE POLICY profiles_select_self_or_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid() AND p2.role = 'admin'
    )
  );

-- Update : self uniquement (les admins ne devraient pas modifier le rôle
-- des autres via l'app — passe par SQL Editor pour ça).
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Insert : géré par trigger uniquement (pas via app)
DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
CREATE POLICY profiles_insert_self ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- ─── 2. Trigger auto-création profile à chaque signup ────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    CASE WHEN NEW.email = 'francehabitat.immo@gmail.com' THEN 'admin' ELSE 'user' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 3. Backfill : crée profiles pour users existants ────────────────────
INSERT INTO public.profiles (id, email, role)
SELECT
  u.id,
  u.email,
  CASE WHEN u.email = 'francehabitat.immo@gmail.com' THEN 'admin' ELSE 'user' END
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- Force Marco en admin si déjà présent (au cas où)
UPDATE public.profiles
   SET role = 'admin'
 WHERE email = 'francehabitat.immo@gmail.com';

-- ─── 4. Table prospects (leads page /demo) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.prospects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_entreprise  text NOT NULL,
  email           text NOT NULL,
  telephone       text,
  logiciel_actuel text,
  volume_clients  text,
  statut          text NOT NULL DEFAULT 'nouveau'
                  CHECK (statut IN ('nouveau', 'contacte', 'converti', 'perdu')),
  notes           text,
  source          text DEFAULT 'demo',
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
                  -- user_id null tant que pas converti en compte
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prospects_statut_idx ON public.prospects(statut);
CREATE INDEX IF NOT EXISTS prospects_email_idx ON public.prospects(email);

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

-- RLS : seuls les admins peuvent lire/modifier les prospects.
-- L'insert public (depuis page /demo non authentifiée) passe par l'API
-- backend avec service_role, pas via le client direct.
DROP POLICY IF EXISTS prospects_admin_only ON public.prospects;
CREATE POLICY prospects_admin_only ON public.prospects
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ─── 5. Table audit_log (impersonations admin) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action         text NOT NULL,
                 -- ex: 'impersonate.start', 'impersonate.end', 'prospect.convert'
  metadata       jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_admin_idx ON public.audit_log(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_target_idx ON public.audit_log(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON public.audit_log(action, created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- RLS : admins seulement
DROP POLICY IF EXISTS audit_log_admin_only ON public.audit_log;
CREATE POLICY audit_log_admin_only ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- L'insert se fait depuis l'API backend avec service_role, pas via client.

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :
--   SELECT id, email, role FROM public.profiles ORDER BY created_at DESC;
--   SELECT count(*) FROM public.prospects;
--   SELECT polname FROM pg_policies WHERE tablename IN ('profiles','prospects','audit_log');
-- ═══════════════════════════════════════════════════════════════════════════
