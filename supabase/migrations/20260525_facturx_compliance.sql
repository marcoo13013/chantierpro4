-- ═══════════════════════════════════════════════════════════════════════════
-- ChantierPro — Migration conformité Factur-X (réforme française Sept 2026)
-- À coller dans Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════════════════
-- Ajoute les champs nécessaires à la génération de factures Factur-X
-- conformes à la norme EN 16931 (profil BASIC WL) :
--
--   entreprises (émetteur de la facture)
--     - tva_intra    : N° TVA intracommunautaire (FR + 11 chiffres)
--     - iban         : IBAN pour le paiement (BT-84)
--     - bic          : BIC/SWIFT (BT-86, optionnel mais recommandé)
--     - code_postal  : décomposition adresse (BT-38)
--     - ville        : décomposition adresse (BT-37)
--     - pays         : code ISO pays (BT-40, default "FR")
--
--   clients (acheteur)
--     - tva_intra    : N° TVA intracommunautaire si professionnel
--     - pays         : code ISO pays (default "FR")
--     (siret + code_postal + ville déjà présents via migrations précédentes)
--
-- Nullable partout : un artisan peut générer un PDF même incomplet, mais
-- l'onglet "Conformité" en Paramètres affiche un avertissement si manquants.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── ENTREPRISES (émetteur des factures) ───────────────────────────────────
ALTER TABLE public.entreprises
  ADD COLUMN IF NOT EXISTS tva_intra   text,
  ADD COLUMN IF NOT EXISTS iban        text,
  ADD COLUMN IF NOT EXISTS bic         text,
  ADD COLUMN IF NOT EXISTS code_postal text,
  ADD COLUMN IF NOT EXISTS ville       text,
  ADD COLUMN IF NOT EXISTS pays        text DEFAULT 'FR';

-- ─── CLIENTS (acheteur des factures) ───────────────────────────────────────
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS tva_intra text,
  ADD COLUMN IF NOT EXISTS pays      text DEFAULT 'FR';

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS POST-MIGRATION :
--   SELECT column_name, data_type
--     FROM information_schema.columns
--    WHERE table_schema='public'
--      AND table_name IN ('entreprises','clients')
--      AND column_name IN ('tva_intra','iban','bic','code_postal','ville','pays')
--    ORDER BY table_name, column_name;
--
-- Aucune autre table touchée. Les factures (table devis avec data.type='facture')
-- restent en JSONB — les nouveaux champs (date_echeance, reference_commande)
-- seront simplement ajoutés au payload JSON, pas besoin de migration.
-- ═══════════════════════════════════════════════════════════════════════════
