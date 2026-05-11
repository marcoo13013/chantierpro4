-- ═══════════════════════════════════════════════════════════════════════════
-- ChantierPro — Ajout préférence communication aux clients
-- À coller dans Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════════════════
-- Permet à chaque client d'opter pour ou contre les notifications mail
-- automatiques envoyées par ChantierPro (confirmation de chantier après
-- acceptation devis — cf flow acceptation Commit 4).
--
-- 2 valeurs autorisées :
--   - 'mail'  → notifications envoyées (défaut)
--   - 'rien'  → client opt-out, ChantierPro n'envoie aucun mail automatique
--
-- (Le SMS, initialement prévu via Twilio, a été retiré du sprint — la
-- contrainte ne mentionne donc que 'mail' / 'rien'.)
--
-- Idempotent : DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT → ré-exécutable
-- sans erreur si la migration a déjà été appliquée.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS preference_communication text DEFAULT 'mail';

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_preference_communication_check;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_preference_communication_check
  CHECK (preference_communication IN ('mail', 'rien'));

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION POST-MIGRATION :
--   SELECT column_name, data_type, column_default
--     FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='clients'
--      AND column_name='preference_communication';
--
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = 'public.clients'::regclass
--      AND conname = 'clients_preference_communication_check';
-- ═══════════════════════════════════════════════════════════════════════════
