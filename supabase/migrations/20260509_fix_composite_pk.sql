-- ═══════════════════════════════════════════════════════════════════════════
-- ChantierPro — HOTFIX clé primaire composite (user_id, id) — v2 CASCADE
-- ═══════════════════════════════════════════════════════════════════════════
-- Bug : useSupaSync utilise upsert(... { onConflict: "user_id,id" }) mais
-- les tables (salaries, chantiers_v2, devis, soustraitants) ont parfois été
-- créées avec une PK différente (ex: PK sur id seulement) → erreur 42P10.
--
-- Bug supplémentaire constaté : des tables externes (planning_affectations,
-- checklist_chantier…) référencent salaries.id via FK. Drop simple impossible :
--   2BP01: cannot drop constraint salaries_pkey because other objects depend on it
--
-- Fix v2 : DROP CONSTRAINT ... CASCADE → supprime aussi les FK dépendantes.
-- Les FK ne sont PAS recréées car la PK composite (user_id, id) ne permet
-- plus de référencer salaries.id seul (deux patrons peuvent avoir id=1 pour
-- leurs templates respectifs). Si tu utilises planning_affectations ou
-- checklist_chantier, ajoute une colonne user_id côté ces tables et recrée
-- la FK en composite : foreign key (user_id, salarie_id) references salaries.
--
-- À coller dans Supabase → SQL Editor → Run. Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  tbl text;
  current_pk text;
  pkname text;
  dup_count int;
  dropped_fks text;
begin
  foreach tbl in array array['salaries','chantiers_v2','devis','soustraitants']
  loop
    -- 1) PK courante (colonnes ordonnées par position)
    select string_agg(kcu.column_name,',' order by kcu.ordinal_position),
           tc.constraint_name
      into current_pk, pkname
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name
       and tc.table_schema     = kcu.table_schema
     where tc.table_schema='public'
       and tc.table_name=tbl
       and tc.constraint_type='PRIMARY KEY'
     group by tc.constraint_name;

    raise notice 'Table % : PK actuelle = % (nom: %)', tbl, coalesce(current_pk,'AUCUNE'), coalesce(pkname,'-');

    -- 2) Si la PK n'est pas exactement (user_id, id), on la corrige
    if current_pk is distinct from 'user_id,id' then
      -- 2a) Liste les FK qui pointent vers cette PK pour log explicite
      select string_agg(distinct fk.conname || ' (' ||
                        (select relname from pg_class where oid = fk.conrelid) || ')', ', ')
        into dropped_fks
        from pg_constraint fk
        join pg_constraint pk on fk.confrelid = pk.conrelid and pk.contype = 'p'
       where fk.contype = 'f'
         and pk.conname = pkname;

      if dropped_fks is not null then
        raise notice '  ⚠ FK dépendantes qui vont être DROP : %', dropped_fks;
      end if;

      -- 2b) Déduplique si nécessaire — garde la ligne la plus récente
      execute format(
        'with ranked as (
           select ctid, row_number() over (
             partition by user_id, id order by coalesce(updated_at, created_at, now()) desc
           ) as rn
           from public.%I
         )
         delete from public.%I
         where ctid in (select ctid from ranked where rn > 1)',
        tbl, tbl
      );
      get diagnostics dup_count = row_count;
      if dup_count > 0 then
        raise notice '  → % doublon(s) (user_id,id) supprimé(s) sur %', dup_count, tbl;
      end if;

      -- 2c) Drop l'ancienne PK avec CASCADE → supprime aussi les FK dépendantes
      if pkname is not null then
        execute format('alter table public.%I drop constraint %I cascade', tbl, pkname);
      end if;

      -- 2d) Crée la PK composite correcte
      execute format('alter table public.%I add primary key (user_id, id)', tbl);
      raise notice '  → PK reconstruite : (user_id, id)';
    else
      raise notice '  → OK, PK déjà correcte';
    end if;
  end loop;

  raise notice '════════════════════════════════════════════════════════════';
  raise notice 'Si des FK ont été DROP CASCADE, elles sont définitivement';
  raise notice 'supprimées. ChantierPro continuera à fonctionner — les liens';
  raise notice 'salarié↔chantier sont gérés au niveau JSONB côté app.';
  raise notice '════════════════════════════════════════════════════════════';
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Vérification 1 : PK correctes
--   SELECT tc.table_name,
--          string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position) as pk
--     FROM information_schema.table_constraints tc
--     JOIN information_schema.key_column_usage kcu
--       ON tc.constraint_name = kcu.constraint_name
--    WHERE tc.table_schema='public'
--      AND tc.constraint_type='PRIMARY KEY'
--      AND tc.table_name IN ('salaries','chantiers_v2','devis','soustraitants')
--    GROUP BY tc.table_name;
-- → doit retourner 'user_id,id' pour les 4 tables.
--
-- Vérification 2 : FK supprimées (si tu utilisais planning_affectations etc.)
--   SELECT conname, conrelid::regclass FROM pg_constraint
--    WHERE contype='f' AND confrelid='public.salaries'::regclass;
-- → si vide ou réduit, OK. Si tu as encore besoin de ces FK, ajoute la
--   colonne user_id côté table dépendante puis recrée en composite :
--     alter table public.planning_affectations
--       add column if not exists user_id uuid;
--     update public.planning_affectations pa
--        set user_id = (select user_id from public.salaries s where s.id = pa.salarie_id limit 1)
--      where user_id is null;
--     alter table public.planning_affectations
--       add constraint planning_affectations_salarie_id_fkey
--       foreign key (user_id, salarie_id) references public.salaries(user_id, id)
--       on delete cascade;
-- ═══════════════════════════════════════════════════════════════════════════
