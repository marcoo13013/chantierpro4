-- ═══════════════════════════════════════════════════════════════════════════
-- ChantierPro — Hotfix contrainte UNIQUE sur entreprises.user_id
-- ═══════════════════════════════════════════════════════════════════════════
-- Bug : la table entreprises existe avec PK sur (id) seul (schéma hérité
-- d'une version antérieure). Aucune contrainte UNIQUE n'existe sur user_id.
-- L'upsert dans /api/invite-ouvrier.js utilise on_conflict=user_id ce qui
-- requiert obligatoirement une contrainte UNIQUE (ou PK) sur user_id côté
-- PostgreSQL pour fonctionner.
--
-- Erreur typique côté API :
--   42P10 / 23505 / "no unique or exclusion constraint matching"
--
-- Fix : ajout d'une contrainte UNIQUE sur user_id (idempotent). Si des
-- doublons existent (rare mais possible), on les déduplique d'abord en
-- gardant la ligne la plus récente.
--
-- À coller dans Supabase → SQL Editor → Run. Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  has_constraint boolean;
  dup_count int;
  pk_cols text;
begin
  -- 1) Diagnostic — affiche la PK courante pour info
  select string_agg(kcu.column_name,',' order by kcu.ordinal_position)
    into pk_cols
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
   where tc.table_schema='public'
     and tc.table_name='entreprises'
     and tc.constraint_type='PRIMARY KEY';
  raise notice 'entreprises : PK actuelle = %', coalesce(pk_cols,'AUCUNE');

  -- 2) Vérifie si une contrainte UNIQUE ou PK existe déjà sur user_id seul
  select exists(
    select 1
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name
       and tc.table_schema     = kcu.table_schema
     where tc.table_schema='public'
       and tc.table_name='entreprises'
       and kcu.column_name='user_id'
       and tc.constraint_type in ('PRIMARY KEY','UNIQUE')
       and (
         select count(*) from information_schema.key_column_usage k2
          where k2.constraint_name = tc.constraint_name
            and k2.table_schema     = tc.table_schema
       ) = 1
  ) into has_constraint;

  if has_constraint then
    raise notice 'entreprises : contrainte unique sur user_id déjà présente — rien à faire';
    return;
  end if;

  -- 3) Déduplique par user_id (garde la ligne la plus récente)
  with ranked as (
    select ctid, row_number() over (
      partition by user_id
      order by coalesce(updated_at, created_at, '1970-01-01'::timestamptz) desc nulls last
    ) as rn
    from public.entreprises
  )
  delete from public.entreprises
   where ctid in (select ctid from ranked where rn > 1);
  get diagnostics dup_count = row_count;
  if dup_count > 0 then
    raise notice 'entreprises : % doublon(s) user_id supprimé(s) (gardé la ligne la plus récente)', dup_count;
  end if;

  -- 4) Ajoute la contrainte UNIQUE sur user_id
  alter table public.entreprises
    add constraint entreprises_user_id_key unique (user_id);
  raise notice 'entreprises : ✓ contrainte UNIQUE entreprises_user_id_key (user_id) ajoutée';
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Vérification après exécution :
--
--   SELECT tc.constraint_name, tc.constraint_type,
--          string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position) as cols
--     FROM information_schema.table_constraints tc
--     JOIN information_schema.key_column_usage kcu
--       ON tc.constraint_name = kcu.constraint_name
--    WHERE tc.table_schema='public' AND tc.table_name='entreprises'
--      AND tc.constraint_type IN ('PRIMARY KEY','UNIQUE')
--    GROUP BY tc.constraint_name, tc.constraint_type
--    ORDER BY tc.constraint_type;
--
-- → doit lister une PRIMARY KEY (sur id ou user_id) ET une UNIQUE sur
--   (user_id) — la seconde permettant à on_conflict=user_id de fonctionner.
--
-- Test direct de l'upsert :
--   INSERT INTO public.entreprises (user_id, nom)
--     VALUES (auth.uid(), 'TEST')
--     ON CONFLICT (user_id) DO UPDATE SET nom = excluded.nom;
-- → doit s'exécuter sans erreur "no unique constraint matching".
-- ═══════════════════════════════════════════════════════════════════════════
