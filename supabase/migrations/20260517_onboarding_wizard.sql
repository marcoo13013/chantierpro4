-- ═══════════════════════════════════════════════════════════════════════════
-- ChantierPro — Wizard onboarding (5 étapes guidées après SIRET)
-- À coller dans Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════════════════
-- Ajoute une colonne `wizard_step` sur entreprises pour tracker l'étape
-- atteinte du wizard guidé qui se déclenche après l'onboarding SIRET.
-- Valeurs :
--   0 (défaut) : pas commencé → wizard s'auto-affiche au login
--   1..4       : étape en cours (badge 'Guide X/4' dans la sidebar)
--   5          : terminé, plus de badge
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.entreprises
  add column if not exists wizard_step int not null default 0;

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :
--   select user_id, role, onboarding_done, wizard_step
--   from public.entreprises order by created_at desc limit 5;
-- ═══════════════════════════════════════════════════════════════════════════
