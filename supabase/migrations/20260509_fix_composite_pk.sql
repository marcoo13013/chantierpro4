-- ═══════════════════════════════════════════════════════════════════════════
-- ChantierPro — HOTFIX clé primaire composite (user_id, id)
-- ═══════════════════════════════════════════════════════════════════════════
-- Bug : useSupaSync utilise upsert(... { onConflict: "user_id,id" }) mais
-- les tables (salaries, chantiers_v2, devis, soustraitants) ont peut-être
-- été créées avec une PK différente (ex: PK sur id seulement) lors d'un
-- déploiement antérieur — CREATE TABLE IF NOT EXISTS de la migration
-- 20260502 ignore alors la clause "primary key (user_id, id)".
--
-- Erreur typique constatée :
--   42P10: there is no unique or exclusion constraint matching the
--          ON CONFLICT specification
--
-- Fix : pour chaque table, on inspecte la PK courante. Si elle n'est pas
-- exactement (user_id, id), on la drop et on la recrée correctement.
--
-- ⚠ Préalable destructif : si la table a des doublons (user_id, id) ils
-- doivent être nettoyés AVANT (script déduplique en gardant le plus récent).
--
-- À coller dans Supabase → SQL Editor → Run. Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  tbl text;
  current_pk text;
  pkname text;
  dup_count int;
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
      -- 2a) Déduplique si nécessaire — garde la ligne la plus récente
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

      -- 2b) Drop l'ancienne PK
      if pkname is not null then
        execute format('alter table public.%I drop constraint %I', tbl, pkname);
      end if;

      -- 2c) Crée la PK composite correcte
      execute format('alter table public.%I add primary key (user_id, id)', tbl);
      raise notice '  → PK reconstruite : (user_id, id)';
    else
      raise notice '  → OK, PK déjà correcte';
    end if;
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Vérification après exécution :
--   SELECT tc.table_name, string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position) as pk
--     FROM information_schema.table_constraints tc
--     JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
--    WHERE tc.table_schema='public' AND tc.constraint_type='PRIMARY KEY'
--      AND tc.table_name IN ('salaries','chantiers_v2','devis','soustraitants')
--    GROUP BY tc.table_name;
-- → doit retourner 'user_id,id' pour chacune des 4 tables.
-- ═══════════════════════════════════════════════════════════════════════════
