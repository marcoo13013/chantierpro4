-- ═══════════════════════════════════════════════════════════════════════════
-- ChantierPro — Absences ouvriers (sprint planning #3)
-- À coller dans Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════════════════
-- Table dédiée car :
--   - Périodes peuvent se chevaucher avec planning → besoin de filtres SQL
--     natifs (date_debut, date_fin) plutôt qu'un jsonb embarqué dans salaries.
--   - RLS différenciée : patron full, ouvrier voit ses propres absences.
--
-- Schéma de motifs : 5 valeurs alignées avec le code RH français.
--   maladie / conges_payes / rtt / accident_travail / autre
-- ═══════════════════════════════════════════════════════════════════════════

drop table if exists public.ouvrier_absences cascade;

create table public.ouvrier_absences (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,  -- patron owner
  ouvrier_id  text not null,                  -- UUID string du salarié (cf data jsonb)
  date_debut  date not null,
  date_fin    date not null,
  motif       text not null check (motif in ('maladie','conges_payes','rtt','accident_travail','autre')),
  commentaire text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  check (date_fin >= date_debut)
);
create index abs_user_idx on public.ouvrier_absences(user_id);
create index abs_ouvrier_idx on public.ouvrier_absences(user_id, ouvrier_id);
create index abs_dates_idx on public.ouvrier_absences(user_id, date_debut, date_fin);

alter table public.ouvrier_absences enable row level security;

-- Patron (auth.uid() = user_id) : SELECT/INSERT/UPDATE/DELETE complet
create policy abs_select_own on public.ouvrier_absences
  for select to authenticated using (auth.uid() = user_id);

create policy abs_insert_own on public.ouvrier_absences
  for insert to authenticated
  with check (auth.uid() = user_id and created_by = auth.uid());

create policy abs_update_own on public.ouvrier_absences
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy abs_delete_own on public.ouvrier_absences
  for delete to authenticated using (auth.uid() = user_id);

-- Ouvrier rattaché : voit les absences de SON patron (pour son calendrier
-- dans VueOuvrierTerrain — il n'écrit jamais, lecture seule)
create policy abs_select_ouvrier on public.ouvrier_absences
  for select to authenticated
  using (
    exists (
      select 1 from public.entreprises e
      where e.user_id = auth.uid()
        and e.patron_user_id = ouvrier_absences.user_id
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :
--   select count(*) from public.ouvrier_absences;
--   select policyname, cmd from pg_policies where tablename='ouvrier_absences';
-- ═══════════════════════════════════════════════════════════════════════════
