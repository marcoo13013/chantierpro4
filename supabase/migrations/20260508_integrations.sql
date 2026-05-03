-- ═══════════════════════════════════════════════════════════════════════════
-- ChantierPro — Stockage des tokens d'intégrations (Qonto, Pennylane…)
-- À coller dans Supabase → SQL Editor → Run. Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.entreprises
  add column if not exists integrations jsonb default '{}'::jsonb;

-- Vérification :
--   SELECT user_id, integrations FROM public.entreprises;
