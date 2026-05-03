-- ═══════════════════════════════════════════════════════════════════════════
-- ChantierPro — Migration module Fournisseurs
-- À coller dans Supabase → SQL Editor → Run.
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════
-- Crée 3 tables :
--   • fournisseurs            → fiches (nom, email, SIRET, IBAN, catégorie…)
--   • commandes_fournisseur   → bons de commande (BC-YYYY-NNN)
--   • factures_fournisseur    → factures reçues + lien chantier pour coût réel
-- Toutes suivent le pattern (user_id uuid, id bigint, data jsonb) avec PK
-- composite et RLS owner-only.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Fournisseurs ───────────────────────────────────────────────────────
create table if not exists public.fournisseurs (
  user_id    uuid not null references auth.users(id) on delete cascade,
  id         bigint not null,
  data       jsonb  not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists fournisseurs_user_idx on public.fournisseurs(user_id);
alter table public.fournisseurs enable row level security;
drop policy if exists fournisseurs_select_own on public.fournisseurs;
create policy fournisseurs_select_own on public.fournisseurs
  for select using (auth.uid() = user_id);
drop policy if exists fournisseurs_insert_own on public.fournisseurs;
create policy fournisseurs_insert_own on public.fournisseurs
  for insert with check (auth.uid() = user_id);
drop policy if exists fournisseurs_update_own on public.fournisseurs;
create policy fournisseurs_update_own on public.fournisseurs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists fournisseurs_delete_own on public.fournisseurs;
create policy fournisseurs_delete_own on public.fournisseurs
  for delete using (auth.uid() = user_id);

-- ─── 2. Commandes fournisseur ──────────────────────────────────────────────
create table if not exists public.commandes_fournisseur (
  user_id    uuid not null references auth.users(id) on delete cascade,
  id         bigint not null,
  data       jsonb  not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists commandes_fournisseur_user_idx on public.commandes_fournisseur(user_id);
alter table public.commandes_fournisseur enable row level security;
drop policy if exists commandes_fournisseur_select_own on public.commandes_fournisseur;
create policy commandes_fournisseur_select_own on public.commandes_fournisseur
  for select using (auth.uid() = user_id);
drop policy if exists commandes_fournisseur_insert_own on public.commandes_fournisseur;
create policy commandes_fournisseur_insert_own on public.commandes_fournisseur
  for insert with check (auth.uid() = user_id);
drop policy if exists commandes_fournisseur_update_own on public.commandes_fournisseur;
create policy commandes_fournisseur_update_own on public.commandes_fournisseur
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists commandes_fournisseur_delete_own on public.commandes_fournisseur;
create policy commandes_fournisseur_delete_own on public.commandes_fournisseur
  for delete using (auth.uid() = user_id);

-- ─── 3. Factures fournisseur ───────────────────────────────────────────────
create table if not exists public.factures_fournisseur (
  user_id    uuid not null references auth.users(id) on delete cascade,
  id         bigint not null,
  data       jsonb  not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists factures_fournisseur_user_idx on public.factures_fournisseur(user_id);
alter table public.factures_fournisseur enable row level security;
drop policy if exists factures_fournisseur_select_own on public.factures_fournisseur;
create policy factures_fournisseur_select_own on public.factures_fournisseur
  for select using (auth.uid() = user_id);
drop policy if exists factures_fournisseur_insert_own on public.factures_fournisseur;
create policy factures_fournisseur_insert_own on public.factures_fournisseur
  for insert with check (auth.uid() = user_id);
drop policy if exists factures_fournisseur_update_own on public.factures_fournisseur;
create policy factures_fournisseur_update_own on public.factures_fournisseur
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists factures_fournisseur_delete_own on public.factures_fournisseur;
create policy factures_fournisseur_delete_own on public.factures_fournisseur
  for delete using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- Vérification :
--   SELECT count(*) FROM public.fournisseurs;
--   SELECT count(*) FROM public.commandes_fournisseur;
--   SELECT count(*) FROM public.factures_fournisseur;
-- ═══════════════════════════════════════════════════════════════════════════
