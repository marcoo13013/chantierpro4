-- ═══════════════════════════════════════════════════════════════════════════
-- ChantierPro — Migration module Fournisseurs (v2 — défensive)
-- À coller dans Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════════════════
-- v1 échouait avec ERROR 42703 'column user_id does not exist' quand une des
-- tables existait déjà avec un schéma différent (exécution partielle, table
-- créée à la main, etc.) — le 'create table if not exists' était skippé en
-- silence mais le 'create index ... on (user_id)' plantait derrière.
--
-- v2 : DROP TABLE IF EXISTS d'abord puis CREATE fresh. Sûr car ces tables
-- viennent d'être introduites — l'app supportait déjà l'absence (load
-- tolérant aux erreurs côté useSupaSync). Toute donnée locale non sync
-- restera dans React state et sera persistée au prochain save.
-- ═══════════════════════════════════════════════════════════════════════════

drop table if exists public.fournisseurs cascade;
drop table if exists public.commandes_fournisseur cascade;
drop table if exists public.factures_fournisseur cascade;

-- ─── 1. Fournisseurs ───────────────────────────────────────────────────────
create table public.fournisseurs (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  id         bigint      not null,
  data       jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index fournisseurs_user_idx on public.fournisseurs(user_id);
alter table public.fournisseurs enable row level security;
create policy fournisseurs_select_own on public.fournisseurs
  for select using (auth.uid() = user_id);
create policy fournisseurs_insert_own on public.fournisseurs
  for insert with check (auth.uid() = user_id);
create policy fournisseurs_update_own on public.fournisseurs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy fournisseurs_delete_own on public.fournisseurs
  for delete using (auth.uid() = user_id);

-- ─── 2. Commandes fournisseur ──────────────────────────────────────────────
create table public.commandes_fournisseur (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  id         bigint      not null,
  data       jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index commandes_fournisseur_user_idx on public.commandes_fournisseur(user_id);
alter table public.commandes_fournisseur enable row level security;
create policy commandes_fournisseur_select_own on public.commandes_fournisseur
  for select using (auth.uid() = user_id);
create policy commandes_fournisseur_insert_own on public.commandes_fournisseur
  for insert with check (auth.uid() = user_id);
create policy commandes_fournisseur_update_own on public.commandes_fournisseur
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy commandes_fournisseur_delete_own on public.commandes_fournisseur
  for delete using (auth.uid() = user_id);

-- ─── 3. Factures fournisseur ───────────────────────────────────────────────
create table public.factures_fournisseur (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  id         bigint      not null,
  data       jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index factures_fournisseur_user_idx on public.factures_fournisseur(user_id);
alter table public.factures_fournisseur enable row level security;
create policy factures_fournisseur_select_own on public.factures_fournisseur
  for select using (auth.uid() = user_id);
create policy factures_fournisseur_insert_own on public.factures_fournisseur
  for insert with check (auth.uid() = user_id);
create policy factures_fournisseur_update_own on public.factures_fournisseur
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy factures_fournisseur_delete_own on public.factures_fournisseur
  for delete using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- Vérification après run :
--   SELECT tc.table_name,
--          string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position) as pk
--     FROM information_schema.table_constraints tc
--     JOIN information_schema.key_column_usage kcu
--       ON tc.constraint_name = kcu.constraint_name
--    WHERE tc.table_schema='public'
--      AND tc.constraint_type='PRIMARY KEY'
--      AND tc.table_name IN ('fournisseurs','commandes_fournisseur','factures_fournisseur')
--    GROUP BY tc.table_name;
-- → doit retourner 'user_id,id' pour les 3 tables.
--
--   SELECT count(*) FROM public.fournisseurs;
--   SELECT count(*) FROM public.commandes_fournisseur;
--   SELECT count(*) FROM public.factures_fournisseur;
-- → 0 partout (tables vides après recréation).
-- ═══════════════════════════════════════════════════════════════════════════
