-- ═══════════════════════════════════════════════════════════════════════════
-- ChantierPro — Persistance du flag onboarding_done sur entreprises
-- Évite que le wizard d'onboarding s'affiche à chaque refresh quand le
-- profil existe déjà côté serveur. À coller dans Supabase → SQL Editor → Run.
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.entreprises
  add column if not exists onboarding_done boolean default false;

-- Backfill : tous les profils existants avec un nom non-vide sont considérés
-- comme onboardés (sinon ils n'auraient pas pu être créés).
update public.entreprises
   set onboarding_done = true
 where coalesce(nom,'') <> ''
   and onboarding_done is distinct from true;

-- Vérification :
--   SELECT user_id, nom, onboarding_done FROM public.entreprises;
