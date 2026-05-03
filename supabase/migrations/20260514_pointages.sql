-- ═══════════════════════════════════════════════════════════════════════════
-- ChantierPro — Migration table Pointages (heures travaillées par ouvrier)
-- À coller dans Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════════════════
-- Remplace le stockage localStorage utilisé par VueOuvrierTerrain pour les
-- pointages d'arrivée/départ. Avantages :
--   • Persistance multi-device (l'ouvrier change de tel → ses heures suivent)
--   • Le patron peut consulter les pointages depuis sa vue Équipe
--   • Audit trail (created_at, updated_at)
-- ═══════════════════════════════════════════════════════════════════════════

drop table if exists public.pointages cascade;

create table public.pointages (
  user_id      uuid        not null references auth.users(id) on delete cascade,
  date         date        not null,
  debut        timestamptz,
  fin          timestamptz,
  total_heures numeric(5,2),
  patron_user_id uuid,    -- pour permettre au patron de consulter via RLS étendue
  chantier_id  bigint,    -- chantier sur lequel l'ouvrier a pointé (optionnel)
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_id, date)
);
create index pointages_user_idx on public.pointages(user_id);
create index pointages_patron_idx on public.pointages(patron_user_id);
create index pointages_date_idx on public.pointages(date);

alter table public.pointages enable row level security;

-- L'ouvrier lit/écrit ses propres pointages
create policy pointages_select_own on public.pointages
  for select using (auth.uid() = user_id);
create policy pointages_insert_own on public.pointages
  for insert with check (auth.uid() = user_id);
create policy pointages_update_own on public.pointages
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy pointages_delete_own on public.pointages
  for delete using (auth.uid() = user_id);

-- Le patron lit les pointages de ses ouvriers (via patron_user_id)
create policy pointages_select_patron on public.pointages
  for select using (auth.uid() = patron_user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- Vérification :
--   SELECT count(*) FROM public.pointages;
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='pointages'
--    ORDER BY ordinal_position;
-- ═══════════════════════════════════════════════════════════════════════════
