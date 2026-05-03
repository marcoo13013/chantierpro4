-- ═══════════════════════════════════════════════════════════════════════════
-- ChantierPro — Hotfix RPC find_patron_by_email + find_patron_by_email_st
-- ═══════════════════════════════════════════════════════════════════════════
-- Bug : la fonction excluait s.user_id <> auth.uid() ce qui renvoie NULL
-- silencieusement si auth.uid() est lui-même NULL (cas SQL Editor en tant
-- que service_role). PostgreSQL en logique trois-valeurs : "x <> NULL" ≡
-- NULL ≡ filter out. Résultat : la fonction renvoyait toujours NULL en
-- contexte de test direct, et certains contextes app (race init session)
-- pouvaient aussi échouer.
--
-- Fix :
-- - Tolérance auth.uid() NULL : si pas authentifié (test SQL Editor ou
--   admin RPC), on ne filtre plus le user lui-même → retourne quand même
--   un résultat (utile pour debug)
-- - Tolérance p_email NULL/vide : coalesce sur p_email aussi pour ne pas
--   matcher une ligne dont data.email serait vide
-- - Exclusion email vide explicite (s.data->>'email' <> '')
--
-- À coller dans Supabase → SQL Editor → Run. Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.find_patron_by_email(p_email text)
returns uuid
language sql
security definer
stable
as $$
  select s.user_id
    from public.salaries s
   where lower(coalesce(s.data->>'email','')) = lower(coalesce(p_email,''))
     and coalesce(s.data->>'email','') <> ''      -- évite match sur emails vides
     and (auth.uid() is null or s.user_id <> auth.uid())
   order by (s.created_at) asc nulls last           -- déterministe : 1ʳᵉ entrée gagnante
   limit 1;
$$;
grant execute on function public.find_patron_by_email(text) to authenticated;
grant execute on function public.find_patron_by_email(text) to anon;

create or replace function public.find_patron_by_email_st(p_email text)
returns uuid
language sql
security definer
stable
as $$
  select s.user_id
    from public.soustraitants s
   where lower(coalesce(s.data->>'email','')) = lower(coalesce(p_email,''))
     and coalesce(s.data->>'email','') <> ''
     and (auth.uid() is null or s.user_id <> auth.uid())
   order by (s.created_at) asc nulls last
   limit 1;
$$;
grant execute on function public.find_patron_by_email_st(text) to authenticated;
grant execute on function public.find_patron_by_email_st(text) to anon;

-- ═══════════════════════════════════════════════════════════════════════════
-- Vérification immédiate dans le SQL Editor (devrait retourner un UUID) :
--
--   SELECT public.find_patron_by_email('marcoo13013+ouvrier@gmail.com');
--
-- Si NULL malgré tout → la ligne salaries n'a pas l'email en data.email.
-- Lance pour vérifier ce qui est stocké :
--
--   SELECT user_id, id, data->>'email' as email, data->>'nom' as nom
--     FROM public.salaries
--    WHERE lower(coalesce(data->>'email','')) = lower('marcoo13013+ouvrier@gmail.com');
--
-- → si vide : il faut re-saver la fiche salarié côté app patron
--   (Équipe → ✏️ Modifier → ✓ Enregistrer) pour forcer le upsert avec
--   l'email correctement rempli dans data.email
-- ═══════════════════════════════════════════════════════════════════════════
