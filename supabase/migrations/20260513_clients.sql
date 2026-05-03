-- ═══════════════════════════════════════════════════════════════════════════
-- ChantierPro — Migration module Clients
-- À coller dans Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════════════════
-- Schéma plat (différent du pattern jsonb des autres tables) pour permettre
-- les filtres SQL natifs : WHERE nom ILIKE..., ORDER BY, etc. Utile pour
-- l'autocomplete et les requêtes d'historique côté app.
-- ═══════════════════════════════════════════════════════════════════════════

drop table if exists public.clients cascade;

create table public.clients (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  id         bigint      not null,
  nom        text        not null,
  prenom     text,
  email      text,
  telephone  text,
  adresse    text,
  type       text        not null default 'particulier'
              check (type in ('particulier','professionnel')),
  siret      text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index clients_user_idx on public.clients(user_id);
create index clients_nom_idx  on public.clients(user_id, nom);

alter table public.clients enable row level security;

create policy clients_select_own on public.clients
  for select using (auth.uid() = user_id);
create policy clients_insert_own on public.clients
  for insert with check (auth.uid() = user_id);
create policy clients_update_own on public.clients
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy clients_delete_own on public.clients
  for delete using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- Vérification :
--   SELECT count(*) FROM public.clients;
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='clients'
--    ORDER BY ordinal_position;
-- ═══════════════════════════════════════════════════════════════════════════
