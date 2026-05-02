-- ═══════════════════════════════════════════════════════════════════════════
-- ChantierPro — Migration multi-utilisateurs (devis, chantiers_v2, salaries)
-- À coller telle quelle dans Supabase → SQL Editor → Run.
-- Idempotente : peut être rejouée sans erreur (CREATE IF NOT EXISTS,
-- DROP POLICY IF EXISTS avant CREATE POLICY).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Trigger générique updated_at ───────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── 2. Table devis ────────────────────────────────────────────────────────
create table if not exists public.devis (
  id          bigint not null,
  user_id     uuid   not null references auth.users(id) on delete cascade,
  data        jsonb  not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists devis_user_id_idx on public.devis(user_id);

drop trigger if exists devis_set_updated_at on public.devis;
create trigger devis_set_updated_at
  before update on public.devis
  for each row execute function public.set_updated_at();

alter table public.devis enable row level security;

drop policy if exists devis_select_own on public.devis;
create policy devis_select_own on public.devis
  for select using (auth.uid() = user_id);

drop policy if exists devis_insert_own on public.devis;
create policy devis_insert_own on public.devis
  for insert with check (auth.uid() = user_id);

drop policy if exists devis_update_own on public.devis;
create policy devis_update_own on public.devis
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists devis_delete_own on public.devis;
create policy devis_delete_own on public.devis
  for delete using (auth.uid() = user_id);

-- ─── 3. Table chantiers_v2 ────────────────────────────────────────────────────
create table if not exists public.chantiers_v2 (
  id          bigint not null,
  user_id     uuid   not null references auth.users(id) on delete cascade,
  data        jsonb  not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists chantiers_v2_user_id_idx on public.chantiers_v2(user_id);

drop trigger if exists chantiers_v2_set_updated_at on public.chantiers_v2;
create trigger chantiers_v2_set_updated_at
  before update on public.chantiers_v2
  for each row execute function public.set_updated_at();

alter table public.chantiers_v2 enable row level security;

drop policy if exists chantiers_v2_select_own on public.chantiers_v2;
create policy chantiers_v2_select_own on public.chantiers_v2
  for select using (auth.uid() = user_id);

drop policy if exists chantiers_v2_insert_own on public.chantiers_v2;
create policy chantiers_v2_insert_own on public.chantiers_v2
  for insert with check (auth.uid() = user_id);

drop policy if exists chantiers_v2_update_own on public.chantiers_v2;
create policy chantiers_v2_update_own on public.chantiers_v2
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists chantiers_v2_delete_own on public.chantiers_v2;
create policy chantiers_v2_delete_own on public.chantiers_v2
  for delete using (auth.uid() = user_id);

-- ─── 4. Table salaries ─────────────────────────────────────────────────────
create table if not exists public.salaries (
  id          bigint not null,
  user_id     uuid   not null references auth.users(id) on delete cascade,
  data        jsonb  not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists salaries_user_id_idx on public.salaries(user_id);

drop trigger if exists salaries_set_updated_at on public.salaries;
create trigger salaries_set_updated_at
  before update on public.salaries
  for each row execute function public.set_updated_at();

alter table public.salaries enable row level security;

drop policy if exists salaries_select_own on public.salaries;
create policy salaries_select_own on public.salaries
  for select using (auth.uid() = user_id);

drop policy if exists salaries_insert_own on public.salaries;
create policy salaries_insert_own on public.salaries
  for insert with check (auth.uid() = user_id);

drop policy if exists salaries_update_own on public.salaries;
create policy salaries_update_own on public.salaries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists salaries_delete_own on public.salaries;
create policy salaries_delete_own on public.salaries
  for delete using (auth.uid() = user_id);

-- ─── 5. Table entreprises (profil entreprise par utilisateur) ──────────────
-- Si la table existe déjà avec un schéma proche, les `add column if not exists`
-- ajoutent uniquement ce qui manque sans toucher l'existant.
create table if not exists public.entreprises (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nom        text,
  nom_court  text,
  siret      text,
  statut     text,
  activite   text,
  tel        text,
  email      text,
  adresse    text,
  tva        boolean default true,
  logo       text,
  updated_at timestamptz not null default now()
);

-- Migration de schéma : ajoute les colonnes attendues si la table préexistait
alter table public.entreprises add column if not exists nom        text;
alter table public.entreprises add column if not exists nom_court  text;
alter table public.entreprises add column if not exists siret      text;
alter table public.entreprises add column if not exists statut     text;
alter table public.entreprises add column if not exists activite   text;
alter table public.entreprises add column if not exists tel        text;
alter table public.entreprises add column if not exists email      text;
alter table public.entreprises add column if not exists adresse    text;
alter table public.entreprises add column if not exists tva        boolean default true;
alter table public.entreprises add column if not exists logo       text;
alter table public.entreprises add column if not exists updated_at timestamptz not null default now();

alter table public.entreprises enable row level security;

drop policy if exists entreprises_select_own on public.entreprises;
create policy entreprises_select_own on public.entreprises
  for select using (auth.uid() = user_id);

drop policy if exists entreprises_modify_own on public.entreprises;
create policy entreprises_modify_own on public.entreprises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists entreprises_set_updated_at on public.entreprises;
create trigger entreprises_set_updated_at
  before update on public.entreprises
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- Vérifications rapides
-- ═══════════════════════════════════════════════════════════════════════════
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public'
--   AND tablename IN ('devis','chantiers_v2','salaries');
-- SELECT polname, tablename FROM pg_policies WHERE schemaname='public'
--   AND tablename IN ('devis','chantiers_v2','salaries') ORDER BY tablename, polname;

-- ═══════════════════════════════════════════════════════════════════════════
-- Accès sur invitation uniquement (à faire APRÈS la migration)
-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Supabase Dashboard → Authentication → Sign In / Up → Email :
--    décocher "Enable email signups". Seules les invitations admin
--    pourront créer un compte.
--
-- 2. Pour chaque entrepreneur testeur :
--    Authentication → Users → Invite user → entrer son email pro.
--    Supabase envoie un mail "Confirm your invitation" avec un lien
--    qui ouvre la page set-password puis l'app.
--
-- 3. Côté app : LoginModal affiche maintenant "Demander un accès"
--    (mailto francehabitat.immo@gmail.com) au lieu d'un bouton signup.
--    Les tentatives de connexion non invitées retournent
--    "Invalid login credentials" → message expliquant l'invitation.
