-- ═══════════════════════════════════════════════════════════════════════════
-- ChantierPro — Module Support & Tickets (Phase 1)
-- À coller dans Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════════════════
-- Tables :
--   tickets         — un ticket par demande utilisateur (bug/feature/etc.)
--   roadmap         — items publics avec votes (visibles par tous)
--   announcements   — nouveautés affichées au login (Phase 4)
--   faq             — base de connaissances (lue par l'agent IA — Phase 3)
--
-- RLS : admin = email JWT === 'francehabitat.immo@gmail.com'.
--   - tickets   : owner ou admin (insert ouvert à tous, y compris anon)
--   - roadmap   : public read, admin write
--   - announcements : idem roadmap
--   - faq           : idem roadmap
--
-- Vote : RPC `vote_item(item_table, item_id, voter_id)` — anti-doublons via
-- array `voters` (text[]) qui stocke user_id::text ou email pour les anon.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Helper admin ──────────────────────────────────────────────────────────
-- Renvoie true si le JWT contient l'email admin. Utilisable dans les
-- policies. STABLE pour permettre à Postgres d'optimiser.
create or replace function public.is_support_admin()
  returns boolean
  language sql
  stable
  as $$
    select coalesce(auth.jwt() ->> 'email', '') = 'francehabitat.immo@gmail.com'
  $$;

-- ─── Helper updated_at trigger (DRY) ───────────────────────────────────────
create or replace function public.tg_set_updated_at()
  returns trigger
  language plpgsql
  as $$
  begin
    new.updated_at = now();
    return new;
  end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- TICKETS
-- ═══════════════════════════════════════════════════════════════════════════
drop table if exists public.tickets cascade;

create table public.tickets (
  id              bigint generated always as identity primary key,
  user_id         uuid references auth.users(id) on delete set null,
  email           text not null,
  type            text not null check (type in ('bug','feature','recommandation','autre')),
  titre           text not null,
  description     text not null,
  priorite        text not null default 'normale'
                    check (priorite in ('basse','normale','haute','urgente')),
  statut          text not null default 'ouvert'
                    check (statut in ('ouvert','en_cours','resolu','refuse')),
  reponse_admin   text,
  reponse_par     text check (reponse_par in ('admin','ia')),
  reponse_at      timestamptz,
  votes           int not null default 0,
  voters          text[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index tickets_user_idx on public.tickets(user_id);
create index tickets_statut_idx on public.tickets(statut);
create index tickets_email_idx on public.tickets(email);
create index tickets_created_idx on public.tickets(created_at desc);

create trigger tickets_updated_at
  before update on public.tickets
  for each row execute function public.tg_set_updated_at();

alter table public.tickets enable row level security;

-- INSERT : ouvert à tous (formulaire public + patrons connectés)
create policy tickets_insert_anyone on public.tickets
  for insert
  to anon, authenticated
  with check (true);

-- SELECT : owner (user_id) ou admin
create policy tickets_select_own_or_admin on public.tickets
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_support_admin());

-- UPDATE : admin uniquement (répondre, changer statut)
create policy tickets_update_admin on public.tickets
  for update
  to authenticated
  using (public.is_support_admin())
  with check (public.is_support_admin());

-- DELETE : admin uniquement
create policy tickets_delete_admin on public.tickets
  for delete
  to authenticated
  using (public.is_support_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- ROADMAP
-- ═══════════════════════════════════════════════════════════════════════════
drop table if exists public.roadmap cascade;

create table public.roadmap (
  id          bigint generated always as identity primary key,
  titre       text not null,
  description text,
  type        text not null check (type in ('bug_fix','feature','improvement')),
  statut      text not null default 'planifie'
                check (statut in ('planifie','en_cours','livre','annule')),
  votes       int not null default 0,
  voters      text[] not null default '{}',
  livre_le    date,
  ordre       int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index roadmap_statut_idx on public.roadmap(statut);
create index roadmap_ordre_idx on public.roadmap(ordre);

create trigger roadmap_updated_at
  before update on public.roadmap
  for each row execute function public.tg_set_updated_at();

alter table public.roadmap enable row level security;

-- SELECT : public (anon + authenticated)
create policy roadmap_select_all on public.roadmap
  for select
  to anon, authenticated
  using (true);

create policy roadmap_insert_admin on public.roadmap
  for insert to authenticated
  with check (public.is_support_admin());

create policy roadmap_update_admin on public.roadmap
  for update to authenticated
  using (public.is_support_admin()) with check (public.is_support_admin());

create policy roadmap_delete_admin on public.roadmap
  for delete to authenticated
  using (public.is_support_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- ANNOUNCEMENTS (notifications "Nouveautés" — utilisé en Phase 4)
-- ═══════════════════════════════════════════════════════════════════════════
drop table if exists public.announcements cascade;

create table public.announcements (
  id          bigint generated always as identity primary key,
  titre       text not null,
  description text,
  icone       text default '✨',
  url         text,
  type        text default 'feature' check (type in ('feature','bug_fix','improvement','info')),
  publie      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index announcements_publie_idx on public.announcements(publie, created_at desc);

alter table public.announcements enable row level security;

create policy announcements_select_all on public.announcements
  for select to anon, authenticated using (publie = true or public.is_support_admin());

create policy announcements_insert_admin on public.announcements
  for insert to authenticated with check (public.is_support_admin());

create policy announcements_update_admin on public.announcements
  for update to authenticated
  using (public.is_support_admin()) with check (public.is_support_admin());

create policy announcements_delete_admin on public.announcements
  for delete to authenticated
  using (public.is_support_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- FAQ (base de connaissances — utilisée par l'agent IA en Phase 3)
-- ═══════════════════════════════════════════════════════════════════════════
drop table if exists public.faq cascade;

create table public.faq (
  id          bigint generated always as identity primary key,
  question    text not null,
  reponse     text not null,
  keywords    text[] not null default '{}',
  ordre       int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index faq_active_idx on public.faq(active, ordre);

create trigger faq_updated_at
  before update on public.faq
  for each row execute function public.tg_set_updated_at();

alter table public.faq enable row level security;

create policy faq_select_active on public.faq
  for select to anon, authenticated using (active = true or public.is_support_admin());

create policy faq_insert_admin on public.faq
  for insert to authenticated with check (public.is_support_admin());

create policy faq_update_admin on public.faq
  for update to authenticated
  using (public.is_support_admin()) with check (public.is_support_admin());

create policy faq_delete_admin on public.faq
  for delete to authenticated
  using (public.is_support_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- RPC : voter sur un ticket ou un item de roadmap (anti-doublons)
-- ═══════════════════════════════════════════════════════════════════════════
-- voter_id : auth.uid()::text pour les connectés, email pour les anon.
-- Idempotent : si voter_id déjà dans voters[], n'incrémente pas.
create or replace function public.vote_item(
  p_table   text,
  p_item_id bigint,
  p_voter   text
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count int;
begin
  if p_voter is null or p_voter = '' then
    raise exception 'voter_id required';
  end if;

  if p_table = 'tickets' then
    update public.tickets
       set votes  = votes + 1,
           voters = array_append(voters, p_voter)
     where id = p_item_id
       and not (p_voter = any(voters))
     returning votes into new_count;
  elsif p_table = 'roadmap' then
    update public.roadmap
       set votes  = votes + 1,
           voters = array_append(voters, p_voter)
     where id = p_item_id
       and not (p_voter = any(voters))
     returning votes into new_count;
  else
    raise exception 'invalid table: %', p_table;
  end if;

  -- Si déjà voté, renvoie le total actuel sans incrémenter
  if new_count is null then
    if p_table = 'tickets' then
      select votes into new_count from public.tickets where id = p_item_id;
    else
      select votes into new_count from public.roadmap where id = p_item_id;
    end if;
  end if;

  return coalesce(new_count, 0);
end;
$$;

grant execute on function public.vote_item to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED — FAQ initiale (l'admin pourra la compléter depuis le dashboard)
-- ═══════════════════════════════════════════════════════════════════════════
insert into public.faq (question, reponse, keywords, ordre) values
  ('Comment créer un devis avec l''IA ?',
   'Cliquez sur "Devis Rapide IA" dans la sidebar. Décrivez vos travaux en quelques phrases (ex: "rénovation salle de bain 8m² avec faïence et carrelage"). L''IA génère automatiquement un devis structuré avec lignes, fournitures et heures de main-d''œuvre que vous pouvez ensuite ajuster.',
   array['devis','ia','créer','rapide','assistant'], 1),

  ('Comment envoyer un devis à signer électroniquement ?',
   'Sur un devis avec statut "Accepté", cliquez sur ✍️ Signature. Saisissez l''email du client : il reçoit un lien sécurisé pour signer. La signature est sauvegardée et insérée dans le PDF final.',
   array['signature','signer','électronique','client','envoyer'], 2),

  ('Comment ajouter un ouvrier à mon équipe ?',
   'Allez dans Équipe → Salariés → "Inviter un ouvrier". Saisissez l''email : l''ouvrier reçoit un lien d''invitation pour rejoindre votre équipe. Une fois connecté, il accède aux modules Chantiers et Terrain.',
   array['ouvrier','salarié','invitation','équipe','inviter'], 3),

  ('Comment convertir un devis en chantier ?',
   'Sur un devis "Accepté", cliquez sur "→ Chantier" (ou "🏗 Chantier" sur mobile). Le chantier est créé avec les lignes du devis converties en postes et un planning initial avec une phase par lot.',
   array['convertir','chantier','devis','accepté'], 4),

  ('Comment fonctionne le calcul de marge ?',
   'La marge d''un chantier = (Devis HT − Coût total réel) / Devis HT × 100. Le coût total inclut les heures pointées × taux horaire chargé, les fournitures réelles et les sous-traitants. Visible dans la fiche chantier.',
   array['marge','calcul','rentabilité','coût'], 5);

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED — Roadmap initiale (livré récemment + à venir)
-- ═══════════════════════════════════════════════════════════════════════════
insert into public.roadmap (titre, description, type, statut, livre_le, ordre) values
  ('Signature électronique des devis',
   'Envoi d''un lien de signature au client, capture de la signature et insertion dans le PDF final.',
   'feature', 'livre', current_date - 3, 1),

  ('Module Clients avec autocomplete',
   'Fiche client unifiée, recherche par nom, création inline depuis le devis.',
   'feature', 'livre', current_date - 5, 2),

  ('Pointages Supabase pour ouvriers',
   'Synchronisation cloud des pointages terrain pour suivi temps réel des heures.',
   'feature', 'livre', current_date - 1, 3),

  ('Module Support & Tickets',
   'Système de support client avec tickets, roadmap publique et agent IA pour les questions fréquentes.',
   'feature', 'en_cours', null, 4);

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION (à coller dans le SQL editor connecté avec ton compte admin) :
--
--   -- Doit renvoyer true SEULEMENT si tu es connecté en tant que
--   -- francehabitat.immo@gmail.com :
--   select public.is_support_admin();
--
--   -- Compte des tables :
--   select 'tickets' as t, count(*) from public.tickets union all
--   select 'roadmap', count(*) from public.roadmap union all
--   select 'announcements', count(*) from public.announcements union all
--   select 'faq', count(*) from public.faq;
--
--   -- Test d'un vote anonyme (depuis psql ou sql editor anon) :
--   select public.vote_item('roadmap', 1, 'test@example.com');
-- ═══════════════════════════════════════════════════════════════════════════
