-- ═══════════════════════════════════════════════════════════════════════════
-- ChantierPro — Catalogue d'articles BTP (fournitures unitaires)
-- À coller dans Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════════════════
-- Distinct des OUVRAGES (postes de travail "Pose receveur") qui sont en dur
-- côté frontend. Ici : articles = fournitures unitaires avec référence
-- fournisseur réelle (ex "Bonde siphoïde Ø90 - Point P - 28€").
--
-- 2 modes de propriété :
--   - user_id IS NULL  → catalogue partagé global (seed initial 500 articles,
--                        accessible en lecture à tous les utilisateurs)
--   - user_id = uid    → article personnel (l'utilisateur peut éditer ses prix
--                        ou créer de nouvelles références spécifiques à son
--                        magasin habituel)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.articles_catalogue (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid REFERENCES auth.users(id) ON DELETE CASCADE,
                     -- NULL = catalogue partagé global
  reference          text,                    -- code fournisseur ex: GED-1234
  libelle            text NOT NULL,
  categorie          text NOT NULL,           -- plomberie / sanitaire / élec...
  sous_categorie     text,                    -- bonde / siphon / robinet
  unite              text DEFAULT 'U',        -- U, ml, m2, kg, sac, plaque...
  prix_achat_ht      numeric NOT NULL,
  coefficient_marge  numeric DEFAULT 1.3,     -- coef vente = achat × coef
  fournisseur_default text,                   -- Point P / Gedimat / Brico Dépôt
  conditionnement    text,                    -- "Boîte de 100", "Sac 35kg"
  tva_pct            numeric DEFAULT 20,      -- 20% défaut, 10% rénovation
  actif              boolean DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS articles_user_idx       ON public.articles_catalogue(user_id);
CREATE INDEX IF NOT EXISTS articles_categorie_idx  ON public.articles_catalogue(categorie, sous_categorie);
CREATE INDEX IF NOT EXISTS articles_libelle_gin    ON public.articles_catalogue
  USING gin(to_tsvector('french', libelle));
CREATE INDEX IF NOT EXISTS articles_actif_idx      ON public.articles_catalogue(actif) WHERE actif = true;

-- ─── RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE public.articles_catalogue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS articles_select ON public.articles_catalogue;
CREATE POLICY articles_select ON public.articles_catalogue
  FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS articles_insert ON public.articles_catalogue;
CREATE POLICY articles_insert ON public.articles_catalogue
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS articles_update ON public.articles_catalogue;
CREATE POLICY articles_update ON public.articles_catalogue
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS articles_delete ON public.articles_catalogue;
CREATE POLICY articles_delete ON public.articles_catalogue
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Trigger : updated_at auto
CREATE OR REPLACE FUNCTION public.set_articles_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS articles_updated_at ON public.articles_catalogue;
CREATE TRIGGER articles_updated_at
  BEFORE UPDATE ON public.articles_catalogue
  FOR EACH ROW EXECUTE FUNCTION public.set_articles_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS APRÈS RUN :
--   SELECT count(*) FROM public.articles_catalogue;        -- 0 (avant seed)
--   SELECT polname FROM pg_policies WHERE tablename='articles_catalogue';
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠ APRÈS CETTE MIGRATION : exécuter le SEED dans un second pass :
--   supabase/seeds/articles_catalogue_seed.sql (500 INSERT).
-- ═══════════════════════════════════════════════════════════════════════════
