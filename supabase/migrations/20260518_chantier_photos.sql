-- ═══════════════════════════════════════════════════════════════════════════
-- ChantierPro — Photos de chantier (upload manuel + caméra ouvrier)
-- À coller dans Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════════════════
-- Table chantier_photos : métadonnées (url, chantier_id, qui a uploadé,
-- quand). Le contenu binaire est stocké dans le bucket Storage 'chantier-
-- photos' (créé en bas de cette migration).
--
-- Path convention dans le bucket :
--   {patron_user_id}/{chantier_id}/{timestamp}_{filename}
-- → permet aux policies RLS Storage d'autoriser uniquement le owner du
--   patron_user_id à lire/écrire dans son sous-dossier.
--
-- RLS table : owner (patron) ou ouvrier invité du même patron peut lire /
-- insérer. Owner uniquement peut supprimer.
-- ═══════════════════════════════════════════════════════════════════════════

drop table if exists public.chantier_photos cascade;

create table public.chantier_photos (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  chantier_id bigint not null,
  url         text not null,
  storage_path text,                              -- chemin dans le bucket (pour DELETE)
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index chantier_photos_user_idx on public.chantier_photos(user_id);
create index chantier_photos_chantier_idx on public.chantier_photos(user_id, chantier_id);

alter table public.chantier_photos enable row level security;

-- SELECT : owner OU ouvrier rattaché à ce patron (entreprises.patron_user_id
-- = user_id de la photo). Permet aux ouvriers de voir leurs photos uploadées
-- depuis le terrain.
create policy chantier_photos_select_own on public.chantier_photos
  for select to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.entreprises e
      where e.user_id = auth.uid() and e.patron_user_id = chantier_photos.user_id
    )
  );

-- INSERT : owner direct OU ouvrier rattaché. created_by doit être l'utilisateur
-- courant (anti-spoof).
create policy chantier_photos_insert_own on public.chantier_photos
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      auth.uid() = user_id
      or exists (
        select 1 from public.entreprises e
        where e.user_id = auth.uid() and e.patron_user_id = chantier_photos.user_id
      )
    )
  );

-- DELETE : owner uniquement (un ouvrier ne peut pas supprimer les photos
-- de son patron — sécurité).
create policy chantier_photos_delete_own on public.chantier_photos
  for delete to authenticated
  using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- STORAGE — bucket 'chantier-photos'
-- ═══════════════════════════════════════════════════════════════════════════
-- Bucket public (les URLs publiques fonctionnent sans auth — utile pour
-- afficher les photos dans les emails ou pour Claude vision via URL).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chantier-photos', 'chantier-photos', true,
  5 * 1024 * 1024, -- 5 MB par fichier
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Policies storage.objects pour ce bucket
-- SELECT : public (bucket public + URLs accessibles partout)
drop policy if exists "chantier_photos_select_public" on storage.objects;
create policy "chantier_photos_select_public" on storage.objects
  for select using (bucket_id = 'chantier-photos');

-- INSERT : authentifié, premier segment du path = patron_user_id de l'uploader.
-- Path attendu : {patron_user_id}/{chantier_id}/{filename}
drop policy if exists "chantier_photos_insert_own" on storage.objects;
create policy "chantier_photos_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chantier-photos'
    and (
      -- Patron : uploade dans son propre dossier
      auth.uid()::text = (storage.foldername(name))[1]
      -- Ouvrier : uploade dans le dossier de son patron (entreprises.patron_user_id)
      or exists (
        select 1 from public.entreprises e
        where e.user_id = auth.uid()
          and e.patron_user_id::text = (storage.foldername(name))[1]
      )
    )
  );

-- DELETE : seul le patron (premier segment du path = auth.uid())
drop policy if exists "chantier_photos_delete_own" on storage.objects;
create policy "chantier_photos_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chantier-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :
--   select * from public.chantier_photos limit 5;
--   select id, name, public from storage.buckets where id='chantier-photos';
--   select policyname, cmd from pg_policies where tablename='objects'
--     and policyname like 'chantier_photos%';
-- ═══════════════════════════════════════════════════════════════════════════
