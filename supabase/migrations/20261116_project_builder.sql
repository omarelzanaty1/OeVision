-- ============================================================================
-- Project Builder — additive, backward-compatible extension of public.projects
-- STATUS: NOT APPLIED. Review first, then run once (SQL Editor or apply_migration).
-- Safe by design:
--   * only ADD COLUMN with defaults (existing rows/queries keep working)
--   * no new tables, no policy changes: RLS stays exactly as it is
--       - admin only: insert / update / delete  (policies use public.is_admin())
--       - visitors & clients: read published rows only
--   * table-level grants already cover new columns:
--       anon: SELECT | authenticated: SELECT, INSERT, UPDATE, DELETE
--   * existing gallery_images / cover_image / project_url columns are untouched
-- Run it ONCE: the ADD CONSTRAINT statements are not idempotent.
-- ============================================================================

alter table public.projects
  add column if not exists content_blocks jsonb  not null default '[]'::jsonb,           -- ordered blocks: image | text | grid | embed | divider
  add column if not exists tags           text[] not null default '{}',
  add column if not exists creative_field text,
  add column if not exists client_name    text,
  add column if not exists project_date   date,
  add column if not exists cover_focus    jsonb  not null default '{"x":50,"y":50,"zoom":1}'::jsonb, -- visible part of the cover (non-destructive crop)
  add column if not exists slug           text;                                           -- stable public link: #/work/<slug> (id link keeps working)

alter table public.projects
  add constraint projects_content_blocks_chk check (
    jsonb_typeof(content_blocks) = 'array'
    and jsonb_array_length(content_blocks) <= 300
    and pg_column_size(content_blocks) <= 500000),
  add constraint projects_tags_chk           check (cardinality(tags) <= 30 and pg_column_size(tags) <= 3000),
  add constraint projects_creative_field_chk check (creative_field is null or char_length(creative_field) <= 120),
  add constraint projects_client_name_chk    check (client_name is null or char_length(client_name) <= 200),
  add constraint projects_cover_focus_chk    check (jsonb_typeof(cover_focus) = 'object' and pg_column_size(cover_focus) <= 200),
  add constraint projects_slug_chk           check (slug is null or (char_length(slug) between 1 and 80 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'));

create unique index if not exists projects_slug_key on public.projects (slug) where slug is not null;

-- Rollback (only if ever needed; drops builder data):
--   drop index if exists public.projects_slug_key;
--   alter table public.projects drop column content_blocks, drop column tags, drop column creative_field,
--     drop column client_name, drop column project_date, drop column cover_focus, drop column slug;
