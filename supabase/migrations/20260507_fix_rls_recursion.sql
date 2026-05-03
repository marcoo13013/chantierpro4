-- ═══════════════════════════════════════════════════════════════════════════
-- ChantierPro — HOTFIX RLS récursion infinie sur entreprises
-- ═══════════════════════════════════════════════════════════════════════════
-- Bug : la migration 20260505_invitation_ouvrier crée une policy SELECT sur
-- `entreprises` qui fait un EXISTS sur `entreprises` elle-même. Avec RLS
-- activée, la sous-requête déclenche la même policy → récursion infinie →
-- PostgreSQL renvoie "infinite recursion detected in policy" → 500 sur
-- toutes les requêtes qui touchent entreprises directement OU via les
-- subqueries des policies de chantiers_v2/salaries/soustraitants.
--
-- Fix : remplacer les EXISTS par un appel à une fonction SECURITY DEFINER
-- qui contourne RLS pour résoudre patron_user_id du user courant. Plus de
-- récursion, et les patrons normaux (auth.uid() = user_id) gardent leur
-- accès via la 1ʳᵉ branche du OR.
--
-- À coller dans Supabase → SQL Editor → Run. Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Fonction helper SECURITY DEFINER ──────────────────────────────────
-- Renvoie le patron_user_id du user courant s'il est ouvrier/soustraitant,
-- sinon NULL. Bypass RLS sur entreprises pour éviter la récursion.
create or replace function public.current_patron_user_id()
returns uuid
language sql
security definer
stable
as $$
  select e.patron_user_id
    from public.entreprises e
   where e.user_id = auth.uid()
     and e.role in ('ouvrier','soustraitant')
     and e.patron_user_id is not null
   limit 1;
$$;
grant execute on function public.current_patron_user_id() to authenticated;

-- ─── 2. Recréation des policies SELECT sans EXISTS récursif ───────────────

-- entreprises : casse la récursion. Patron lit ses lignes via auth.uid()=
-- user_id (1ʳᵉ branche), ouvrier lit la ligne du patron via la fonction.
drop policy if exists entreprises_select_own       on public.entreprises;
drop policy if exists entreprises_select_ouvrier   on public.entreprises;
create policy entreprises_select_ouvrier on public.entreprises
  for select using (
    auth.uid() = user_id
    or user_id = public.current_patron_user_id()
  );

-- chantiers_v2
drop policy if exists chantiers_v2_select_own      on public.chantiers_v2;
drop policy if exists chantiers_v2_select_ouvrier  on public.chantiers_v2;
create policy chantiers_v2_select_ouvrier on public.chantiers_v2
  for select using (
    auth.uid() = user_id
    or user_id = public.current_patron_user_id()
  );

-- salaries
drop policy if exists salaries_select_own          on public.salaries;
drop policy if exists salaries_select_ouvrier      on public.salaries;
create policy salaries_select_ouvrier on public.salaries
  for select using (
    auth.uid() = user_id
    or user_id = public.current_patron_user_id()
  );

-- soustraitants
drop policy if exists soustraitants_select_own     on public.soustraitants;
drop policy if exists soustraitants_select_ouvrier on public.soustraitants;
create policy soustraitants_select_ouvrier on public.soustraitants
  for select using (
    auth.uid() = user_id
    or user_id = public.current_patron_user_id()
  );

-- ─── 3. Sanity : s'assurer que les INSERT/UPDATE/DELETE pour son user
-- sont toujours en place (au cas où elles auraient été nettoyées par
-- un drop précédent). Idempotent : drop + recreate.

-- entreprises : own writes
drop policy if exists entreprises_insert_own       on public.entreprises;
create policy entreprises_insert_own on public.entreprises
  for insert with check (auth.uid() = user_id);
drop policy if exists entreprises_update_own       on public.entreprises;
create policy entreprises_update_own on public.entreprises
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists entreprises_delete_own       on public.entreprises;
create policy entreprises_delete_own on public.entreprises
  for delete using (auth.uid() = user_id);

-- chantiers_v2 : own writes
drop policy if exists chantiers_v2_insert_own      on public.chantiers_v2;
create policy chantiers_v2_insert_own on public.chantiers_v2
  for insert with check (auth.uid() = user_id);
drop policy if exists chantiers_v2_update_own      on public.chantiers_v2;
create policy chantiers_v2_update_own on public.chantiers_v2
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists chantiers_v2_delete_own      on public.chantiers_v2;
create policy chantiers_v2_delete_own on public.chantiers_v2
  for delete using (auth.uid() = user_id);

-- salaries : own writes
drop policy if exists salaries_insert_own          on public.salaries;
create policy salaries_insert_own on public.salaries
  for insert with check (auth.uid() = user_id);
drop policy if exists salaries_update_own          on public.salaries;
create policy salaries_update_own on public.salaries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists salaries_delete_own          on public.salaries;
create policy salaries_delete_own on public.salaries
  for delete using (auth.uid() = user_id);

-- soustraitants : own writes
drop policy if exists soustraitants_insert_own     on public.soustraitants;
create policy soustraitants_insert_own on public.soustraitants
  for insert with check (auth.uid() = user_id);
drop policy if exists soustraitants_update_own     on public.soustraitants;
create policy soustraitants_update_own on public.soustraitants
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists soustraitants_delete_own     on public.soustraitants;
create policy soustraitants_delete_own on public.soustraitants
  for delete using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- Vérifications après exécution :
--   SELECT * FROM public.entreprises;            -- doit retourner les lignes
--   SELECT * FROM public.chantiers_v2;           -- doit retourner les lignes
--   SELECT public.current_patron_user_id();      -- NULL si patron, uuid si ouvrier
-- ═══════════════════════════════════════════════════════════════════════════
