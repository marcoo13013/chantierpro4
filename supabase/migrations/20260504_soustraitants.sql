-- ═══════════════════════════════════════════════════════════════════════════
-- ChantierPro — Migration module Sous-traitants
-- À coller dans Supabase → SQL Editor → Run.
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Élargit le check role pour inclure 'soustraitant' ──────────────────
alter table public.entreprises
  drop constraint if exists entreprises_role_check;
alter table public.entreprises
  add constraint entreprises_role_check
  check (role in ('patron','ouvrier','soustraitant'));

-- ─── 2. Table soustraitants (fiches entreprise externes) ───────────────────
-- PK composite (user_id, id) — un sous-traitant appartient à un patron.
create table if not exists public.soustraitants (
  user_id uuid not null references auth.users(id) on delete cascade,
  id      bigint not null,
  data    jsonb  not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists soustraitants_user_idx on public.soustraitants(user_id);

alter table public.soustraitants enable row level security;

drop policy if exists soustraitants_select_own on public.soustraitants;
create policy soustraitants_select_own on public.soustraitants
  for select using (auth.uid() = user_id);

drop policy if exists soustraitants_insert_own on public.soustraitants;
create policy soustraitants_insert_own on public.soustraitants
  for insert with check (auth.uid() = user_id);

drop policy if exists soustraitants_update_own on public.soustraitants;
create policy soustraitants_update_own on public.soustraitants
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists soustraitants_delete_own on public.soustraitants;
create policy soustraitants_delete_own on public.soustraitants
  for delete using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- Vérification :
--   SELECT count(*) FROM public.soustraitants;
-- ═══════════════════════════════════════════════════════════════════════════
