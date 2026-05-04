-- ═══════════════════════════════════════════════════════════════════════════
-- ChantierPro — Système multi-agents IA (logs + notifications + toggles)
-- À coller dans Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════════════════
-- 2 tables :
--   agent_logs       — historique brut des exécutions agent (1 ligne par
--                      détection, pour audit + rejouer)
--   notifications    — items affichés à l'utilisateur (issus des agents)
--
-- Toggle on/off par agent : colonne entreprises.agents_enabled (jsonb).
-- Défaut = tout activé. Si la clé manque, l'agent considère 'true'.
--
-- Insert via service_role uniquement (les endpoints /api/agent-* tournent
-- en cron Vercel et utilisent SUPABASE_SERVICE_ROLE_KEY).
-- Update / Delete : owner pour notifications (marquer lu, archiver).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. agent_logs (audit brut) ────────────────────────────────────────────
drop table if exists public.agent_logs cascade;

create table public.agent_logs (
  id          bigint generated always as identity primary key,
  agent_id    text not null check (agent_id in ('devis','chantier','comptabilite','planning')),
  user_id     uuid references auth.users(id) on delete cascade,
  type        text not null,                -- 'detection' | 'run_summary' | 'error'
  message     text not null,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index agent_logs_user_idx on public.agent_logs(user_id, created_at desc);
create index agent_logs_agent_idx on public.agent_logs(agent_id, created_at desc);

alter table public.agent_logs enable row level security;

create policy agent_logs_select_own on public.agent_logs
  for select to authenticated
  using (auth.uid() = user_id);

-- INSERT bloqué pour les utilisateurs (seul service_role peut insérer)
-- → on n'ajoute PAS de policy insert, donc anon/authenticated sont rejetés
-- par défaut.

-- ─── 2. notifications (items utilisateur) ──────────────────────────────────
drop table if exists public.notifications cascade;

create table public.notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  agent_id    text check (agent_id in ('devis','chantier','comptabilite','planning')),
  titre       text not null,
  message     text not null,
  type        text not null default 'info'
                check (type in ('info','warning','urgent','success')),
  data        jsonb not null default '{}'::jsonb,  -- ex: {chantier_id, devis_id…}
  lu          boolean not null default false,
  created_at  timestamptz not null default now()
);
create index notif_user_unread_idx on public.notifications(user_id, lu, created_at desc);
create index notif_agent_idx on public.notifications(agent_id, created_at desc);

alter table public.notifications enable row level security;

create policy notif_select_own on public.notifications
  for select to authenticated
  using (auth.uid() = user_id);

-- UPDATE owner-only (pour marquer comme lu)
create policy notif_update_own on public.notifications
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- DELETE owner-only (archiver une notif)
create policy notif_delete_own on public.notifications
  for delete to authenticated
  using (auth.uid() = user_id);

-- ─── 3. entreprises.agents_enabled (toggle on/off par agent) ──────────────
alter table public.entreprises
  add column if not exists agents_enabled jsonb not null
  default '{"devis":true,"chantier":true,"comptabilite":true,"planning":true}'::jsonb;

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :
--   select count(*) from public.agent_logs;
--   select count(*) from public.notifications;
--   select user_id, agents_enabled from public.entreprises limit 5;
-- ═══════════════════════════════════════════════════════════════════════════
