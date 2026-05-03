-- ═══════════════════════════════════════════════════════════════════════════
-- ChantierPro — Migration module Terrain (rôles + tables optionnelles)
-- À coller dans Supabase → SQL Editor → Run.
-- Idempotente — défensive : ajoute user_id si table préexistait sans.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Colonne role sur entreprises ───────────────────────────────────────
-- "patron" : accès complet (devis, compta, marges, équipe, etc.)
-- "ouvrier" : accès restreint (chantiers + terrain + assistant uniquement)
alter table public.entreprises
  add column if not exists role text default 'patron';

update public.entreprises set role='patron' where role is null;

alter table public.entreprises
  drop constraint if exists entreprises_role_check;
alter table public.entreprises
  add constraint entreprises_role_check
  check (role in ('patron','ouvrier'));

-- ─── 2. Table photos_chantier ──────────────────────────────────────────────
create table if not exists public.photos_chantier (
  id           bigserial primary key,
  chantier_id  bigint not null,
  user_id      uuid   not null references auth.users(id) on delete cascade,
  image_base64 text,
  storage_path text,
  legende      text,
  prise_par    text,
  created_at   timestamptz not null default now()
);

-- ⚠ DÉFENSIF : si la table existait déjà avec un schéma incomplet (cas
-- d'une exécution précédente partielle), on ajoute les colonnes manquantes.
alter table public.photos_chantier add column if not exists chantier_id  bigint;
alter table public.photos_chantier add column if not exists user_id      uuid;
alter table public.photos_chantier add column if not exists image_base64 text;
alter table public.photos_chantier add column if not exists storage_path text;
alter table public.photos_chantier add column if not exists legende      text;
alter table public.photos_chantier add column if not exists prise_par    text;
alter table public.photos_chantier add column if not exists created_at   timestamptz not null default now();

-- Si des lignes orphelines existent (user_id NULL), on les supprime (sinon
-- impossible de poser la contrainte NOT NULL). Sans données, rien à faire.
delete from public.photos_chantier where user_id is null;

-- Force NOT NULL + FK si pas encore en place
alter table public.photos_chantier alter column user_id set not null;
do $$ begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'photos_chantier' and c.contype = 'f'
      and pg_get_constraintdef(c.oid) like '%user_id%auth.users%'
  ) then
    alter table public.photos_chantier
      add constraint photos_chantier_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

create index if not exists photos_chantier_user_idx     on public.photos_chantier(user_id);
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

-- ─── 3. Table notes_terrain ────────────────────────────────────────────────
create table if not exists public.notes_terrain (
  id          bigserial primary key,
  chantier_id bigint not null,
  user_id     uuid   not null references auth.users(id) on delete cascade,
  contenu     text,
  auteur_nom  text,
  created_at  timestamptz not null default now()
);

-- ⚠ DÉFENSIF idem
alter table public.notes_terrain add column if not exists chantier_id bigint;
alter table public.notes_terrain add column if not exists user_id     uuid;
alter table public.notes_terrain add column if not exists contenu     text;
alter table public.notes_terrain add column if not exists auteur_nom  text;
alter table public.notes_terrain add column if not exists created_at  timestamptz not null default now();

delete from public.notes_terrain where user_id is null;

alter table public.notes_terrain alter column user_id set not null;
do $$ begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'notes_terrain' and c.contype = 'f'
      and pg_get_constraintdef(c.oid) like '%user_id%auth.users%'
  ) then
    alter table public.notes_terrain
      add constraint notes_terrain_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

create index if not exists notes_terrain_user_idx     on public.notes_terrain(user_id);
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
-- Vérifications après exécution :
--   SELECT user_id, role FROM public.entreprises;
--   SELECT column_name FROM information_schema.columns
--     WHERE table_schema='public' AND table_name='photos_chantier';
--   SELECT column_name FROM information_schema.columns
--     WHERE table_schema='public' AND table_name='notes_terrain';
-- ═══════════════════════════════════════════════════════════════════════════
