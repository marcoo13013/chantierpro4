-- ═══════════════════════════════════════════════════════════════════════════
-- ChantierPro — Module Support : champs structurés par type de ticket
-- À coller dans Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════════════════
-- Ajoute une colonne `metadata` JSONB sur tickets pour stocker les champs
-- type-spécifiques saisis dans les formulaires guidés. Les champs `titre`
-- et `priorite` continuent d'exister mais sont DÉRIVÉS automatiquement
-- côté serveur à partir des metadata (cf. /api/submit-ticket.js).
--
-- Schéma metadata par type (côté front) :
--
--   bug : {
--     page: 'Devis'|'Chantiers'|'Facturation'|'Équipe'|'Planning'
--          |'Comptabilité'|'Mobile'|'Connexion'|'Autre',
--     appareil: 'iPhone'|'Android'|'PC Windows'|'PC Mac',
--     gravite: 'Bloquant'|'Gênant'|'Mineur',
--   }
--
--   feature : {
--     module: 'Devis'|'Chantiers'|'Facturation'|'Équipe'|'Mobile'|'Autre',
--     priorite_utilisateur: 'Indispensable'|'Utile'|'Agréable à avoir',
--   }
--
--   recommandation : {} (juste description)
--   autre          : {} (juste description)
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.tickets
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Index GIN pour permettre des filtres futurs type metadata->>'page'='Devis'
create index if not exists tickets_metadata_idx
  on public.tickets using gin (metadata);

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :
--   select id, type, titre, metadata from public.tickets order by id desc limit 5;
-- ═══════════════════════════════════════════════════════════════════════════
