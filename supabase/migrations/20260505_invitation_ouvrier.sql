-- ═══════════════════════════════════════════════════════════════════════════
-- ChantierPro — Invitation auto-match ouvrier (et sous-traitant)
-- Quand un user se connecte, on cherche son email dans les salaries.email
-- de tous les patrons. S'il y a un match, on lui crée un profil 'ouvrier'
-- lié à ce patron, et il peut lire les données du patron via RLS.
-- À coller dans Supabase → SQL Editor → Run.
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Colonne patron_user_id sur entreprises ─────────────────────────────
alter table public.entreprises
  add column if not exists patron_user_id uuid references auth.users(id);
create index if not exists entreprises_patron_user_idx
  on public.entreprises(patron_user_id);

-- ─── 2. RPC : trouve le patron qui a invité ce user (par email) ────────────
-- SECURITY DEFINER → contourne RLS pour scanner les salaries de tous les
-- patrons, mais ne renvoie qu'un seul uuid (pas les données).
-- Match insensible à la casse, exclut le user lui-même (un patron ne peut
-- pas devenir son propre ouvrier).
create or replace function public.find_patron_by_email(p_email text)
returns uuid
language sql
security definer
stable
as $$
  select s.user_id
  from public.salaries s
  where lower(coalesce(s.data->>'email','')) = lower(p_email)
    and s.user_id <> auth.uid()
  limit 1;
$$;
grant execute on function public.find_patron_by_email(text) to authenticated;

-- Idem pour les sous-traitants (un sous-traitant peut être invité de la
-- même façon : le patron met l'email dans la fiche soustraitant).
create or replace function public.find_patron_by_email_st(p_email text)
returns uuid
language sql
security definer
stable
as $$
  select s.user_id
  from public.soustraitants s
  where lower(coalesce(s.data->>'email','')) = lower(p_email)
    and s.user_id <> auth.uid()
  limit 1;
$$;
grant execute on function public.find_patron_by_email_st(text) to authenticated;

-- ─── 3. RLS étendue : ouvrier/soustraitant peut READ les données du patron
-- On remplace les policies SELECT existantes par une version qui accepte
-- aussi auth.uid() comme ouvrier/sous-traitant lié.

-- chantiers_v2
drop policy if exists chantiers_v2_select_own on public.chantiers_v2;
drop policy if exists chantiers_v2_select_ouvrier on public.chantiers_v2;
create policy chantiers_v2_select_ouvrier on public.chantiers_v2
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.entreprises e
      where e.user_id = auth.uid()
        and e.role in ('ouvrier','soustraitant')
        and e.patron_user_id = chantiers_v2.user_id
    )
  );

-- salaries
drop policy if exists salaries_select_own on public.salaries;
drop policy if exists salaries_select_ouvrier on public.salaries;
create policy salaries_select_ouvrier on public.salaries
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.entreprises e
      where e.user_id = auth.uid()
        and e.role in ('ouvrier','soustraitant')
        and e.patron_user_id = salaries.user_id
    )
  );

-- soustraitants
drop policy if exists soustraitants_select_own on public.soustraitants;
drop policy if exists soustraitants_select_ouvrier on public.soustraitants;
create policy soustraitants_select_ouvrier on public.soustraitants
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.entreprises e
      where e.user_id = auth.uid()
        and e.role in ('ouvrier','soustraitant')
        and e.patron_user_id = soustraitants.user_id
    )
  );

-- entreprises : un ouvrier doit pouvoir lire le profil du patron (logo, nom)
drop policy if exists entreprises_select_own on public.entreprises;
drop policy if exists entreprises_select_ouvrier on public.entreprises;
create policy entreprises_select_ouvrier on public.entreprises
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.entreprises e2
      where e2.user_id = auth.uid()
        and e2.role in ('ouvrier','soustraitant')
        and e2.patron_user_id = entreprises.user_id
    )
  );

-- devis : pas d'accès ouvrier (les devis sont confidentiels patron)
-- → on garde la policy d'origine (auth.uid() = user_id seulement)

-- ═══════════════════════════════════════════════════════════════════════════
-- Vérifications :
--   SELECT public.find_patron_by_email('test@example.com');
--   SELECT user_id, role, patron_user_id FROM public.entreprises;
-- ═══════════════════════════════════════════════════════════════════════════
