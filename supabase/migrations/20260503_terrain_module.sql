-- ═══════════════════════════════════════════════════════════════════════════
-- ChantierPro — Migration module Terrain (rôles + tables optionnelles)
-- À coller dans Supabase → SQL Editor → Run.
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Colonne role sur entreprises ───────────────────────────────────────
-- "patron" : accès complet (devis, compta, marges, équipe, etc.)
-- "ouvrier" : accès restreint (chantiers + terrain + assistant uniquement)
alter table public.entreprises
  add column if not exists role text default 'patron';

-- Backfill : tous les profils existants deviennent patron par défaut
update public.entreprises set role='patron' where role is null;

-- Contrainte de valeur (idempotente via check séparé)
alter table public.entreprises
  drop constraint if exists entreprises_role_check;
alter table public.entreprises
  add constraint entreprises_role_check
  check (role in ('patron','ouvrier'));

-- ─── 2. Table photos_chantier (option : stockage séparé) ───────────────────
-- L'app stocke actuellement les photos dans chantiers_v2.data.terrain.photos
-- (jsonb base64). Cette table est prête pour une future migration vers du
-- stockage Supabase Storage si la taille devient problématique.
create table if not exists public.photos_chantier (
  id          bigserial primary key,
  chantier_id bigint not null,
  user_id     uuid   not null references auth.users(id) on delete cascade,
  image_base64 text,
  storage_path text,           -- alternative Storage à utiliser plus tard
  legende     text,
  prise_par   text,            -- nom de l'auteur
  created_at  timestamptz not null default now()
);
create index if not exists photos_chantier_user_idx on public.photos_chantier(user_id);
create index if not exists photos_chantier_chantier_idx on public.photos_chantier(user_id, chantier_id);

alter table public.photos_chantier enable row level security;

drop policy if exists photos_select_own on public.photos_chantier;
create policy photos_select_own on public.photos_chantier
  for select using (auth.uid() = user_id);

drop policy if exists photos_insert_own on public.photos_chantier;
create policy photos_insert_own on public.photos_chantier
  for insert with check (auth.uid() = user_id);

drop policy if exists photos_update_own on public.photos_chantier;
create policy photos_update_own on public.photos_chantier
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists photos_delete_own on public.photos_chantier;
create policy photos_delete_own on public.photos_chantier
  for delete using (auth.uid() = user_id);

-- ─── 3. Table notes_terrain (option : stockage séparé) ─────────────────────
create table if not exists public.notes_terrain (
  id          bigserial primary key,
  chantier_id bigint not null,
  user_id     uuid   not null references auth.users(id) on delete cascade,
  contenu     text,
  auteur_nom  text,
  created_at  timestamptz not null default now()
);
create index if not exists notes_terrain_user_idx on public.notes_terrain(user_id);
create index if not exists notes_terrain_chantier_idx on public.notes_terrain(user_id, chantier_id);

alter table public.notes_terrain enable row level security;

drop policy if exists notes_select_own on public.notes_terrain;
create policy notes_select_own on public.notes_terrain
  for select using (auth.uid() = user_id);

drop policy if exists notes_insert_own on public.notes_terrain;
create policy notes_insert_own on public.notes_terrain
  for insert with check (auth.uid() = user_id);

drop policy if exists notes_update_own on public.notes_terrain;
create policy notes_update_own on public.notes_terrain
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists notes_delete_own on public.notes_terrain;
create policy notes_delete_own on public.notes_terrain
  for delete using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- Vérifications
-- ═══════════════════════════════════════════════════════════════════════════
-- SELECT user_id, role FROM public.entreprises;
-- SELECT tablename FROM pg_tables WHERE schemaname='public'
--   AND tablename IN ('photos_chantier','notes_terrain');

-- ═══════════════════════════════════════════════════════════════════════════
-- Pour basculer un user en mode ouvrier (à exécuter manuellement) :
--   UPDATE public.entreprises SET role='ouvrier' WHERE user_id='<uuid>';
-- ═══════════════════════════════════════════════════════════════════════════
