-- ============================================================================
-- Website Editor — 3 NEW tables + 1 NEW private storage bucket (nothing existing is altered)
-- STATUS: NOT APPLIED. Review first, then run once (SQL Editor or apply_migration).
--
--   site_content_drafts     admin only (read + write). Visitors can never see drafts.
--   site_content_published  everyone can READ; only admins can write.
--   site_content_versions   admin only, APPEND-ONLY history (a copy of the published page is kept before every publish / un-publish).
--   bucket "site-drafts"    PRIVATE, admin only. Images uploaded while editing live here (visitors cannot read them);
--                           on Publish the editor copies them into the existing public bucket "project-images" (site/ prefix).
--
-- One row per page key: home | work | brief | contact | global
--   (global = banner / logo / personal photo + social links)
-- Content is a JSON document: {"sections":[{id,type,hidden,data}, ...]} (global: {"assets":{},"links":{}})
-- Publishing = the editor copies the draft row into the published table.
--
-- Safety:
--   * No change to existing tables, policies, auth, or EXISTING storage policies/buckets. The only storage additions are the new
--     private bucket "site-drafts" and three admin-only policies that apply to that bucket alone (bucket_id = 'site-drafts').
--     Published images use the existing public bucket "project-images" (site/ prefix), written by the admin-only policies already there.
--   * Access uses the same public.is_admin() function as projects.
--   * Size/shape limits via CHECK constraints (<=60 sections, <=900KB, known section types only).
--   * The site works without these tables (built-in defaults), so ordering of deploy/apply is not critical.
-- Run it ONCE: CREATE POLICY / ADD CONSTRAINT are not idempotent.
-- ============================================================================

create table public.site_content_drafts (
  key        text primary key,
  content    jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid        default auth.uid(),
  constraint site_content_drafts_key_chk  check (key in ('home','work','brief','contact','global')),
  constraint site_content_drafts_body_chk check (
    jsonb_typeof(content) = 'object'
    and pg_column_size(content) <= 900000
    and (not (content ? 'sections') or (
      jsonb_typeof(content->'sections') = 'array'
      and jsonb_array_length(content->'sections') <= 60
      and not jsonb_path_exists(content->'sections',
        '$[*] ? (@.type() != "object" || @.type.type() != "string" || !(@.type == "profile" || @.type == "about" || @.type == "skills" || @.type == "experience" || @.type == "education" || @.type == "services" || @.type == "projects" || @.type == "gallery" || @.type == "text" || @.type == "contact" || @.type == "custom" || @.type == "core"))')
    ))
  )
);

create table public.site_content_published (
  key          text primary key,
  content      jsonb       not null default '{}'::jsonb,
  published_at timestamptz not null default now(),
  published_by uuid        default auth.uid(),
  constraint site_content_published_key_chk  check (key in ('home','work','brief','contact','global')),
  constraint site_content_published_body_chk check (
    jsonb_typeof(content) = 'object'
    and pg_column_size(content) <= 900000
    and (not (content ? 'sections') or (
      jsonb_typeof(content->'sections') = 'array'
      and jsonb_array_length(content->'sections') <= 60
      and not jsonb_path_exists(content->'sections',
        '$[*] ? (@.type() != "object" || @.type.type() != "string" || !(@.type == "profile" || @.type == "about" || @.type == "skills" || @.type == "experience" || @.type == "education" || @.type == "services" || @.type == "projects" || @.type == "gallery" || @.type == "text" || @.type == "contact" || @.type == "custom" || @.type == "core"))')
    ))
  )
);

-- keep updated_at honest
create or replace function public.site_content_touch() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end $$;
create trigger site_content_drafts_touch before insert or update on public.site_content_drafts
  for each row execute function public.site_content_touch();

alter table public.site_content_drafts    enable row level security;
alter table public.site_content_published enable row level security;

-- grants: anon gets NOTHING on drafts, SELECT only on published
revoke all on public.site_content_drafts    from anon, authenticated;
revoke all on public.site_content_published from anon, authenticated;
grant select, insert, update, delete on public.site_content_drafts    to authenticated;   -- narrowed by RLS to admins
grant select                          on public.site_content_published to anon, authenticated;
grant insert, update, delete          on public.site_content_published to authenticated;  -- narrowed by RLS to admins

-- drafts: admin only
create policy "drafts admin all" on public.site_content_drafts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- published: public read, admin write
create policy "published public read" on public.site_content_published
  for select to anon, authenticated using (true);
create policy "published admin insert" on public.site_content_published
  for insert to authenticated with check (public.is_admin());
create policy "published admin update" on public.site_content_published
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "published admin delete" on public.site_content_published
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Version history: append-only (no UPDATE / DELETE policy or grant exists, so nothing can be altered or lost)
-- ---------------------------------------------------------------------------
create table public.site_content_versions (
  id         uuid primary key default gen_random_uuid(),
  key        text        not null,
  content    jsonb       not null,
  note       text,
  created_at timestamptz not null default now(),
  created_by uuid        default auth.uid(),
  constraint site_content_versions_key_chk  check (key in ('home','work','brief','contact','global')),
  constraint site_content_versions_note_chk check (note is null or char_length(note) <= 200),
  constraint site_content_versions_body_chk check (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 900000)
);
create index site_content_versions_key_idx on public.site_content_versions (key, created_at desc);
alter table public.site_content_versions enable row level security;
revoke all on public.site_content_versions from anon, authenticated;
grant select, insert on public.site_content_versions to authenticated;          -- narrowed to admins by RLS; no update/delete
create policy "versions admin read"   on public.site_content_versions for select to authenticated using (public.is_admin());
create policy "versions admin insert" on public.site_content_versions for insert to authenticated with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Private bucket for draft images (not public: no public URL works, only admin signed URLs)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-drafts', 'site-drafts', false, 8388608, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;
create policy "sdraft admin select" on storage.objects for select to authenticated using (bucket_id = 'site-drafts' and (select public.is_admin()));
create policy "sdraft admin insert" on storage.objects for insert to authenticated with check (bucket_id = 'site-drafts' and (select public.is_admin()));
create policy "sdraft admin update" on storage.objects for update to authenticated using (bucket_id = 'site-drafts' and (select public.is_admin())) with check (bucket_id = 'site-drafts' and (select public.is_admin()));
-- (no delete policy on purpose: draft files are never auto-deleted)

-- Rollback (only if ever needed; removes saved site content, history and the draft bucket policies; NEVER touches projects):
--   drop table public.site_content_versions; drop table public.site_content_published; drop table public.site_content_drafts; drop function public.site_content_touch();
--   drop policy "sdraft admin select" on storage.objects; drop policy "sdraft admin insert" on storage.objects; drop policy "sdraft admin update" on storage.objects;
--   (the bucket "site-drafts" itself is removed from the Storage dashboard once emptied)
