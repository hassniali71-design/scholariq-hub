-- SUPABASE_MIGRATION_SPEC.md §11-أ/ب — per-client visual identity + a dedicated login link.
-- Both nullable: existing centers get backfilled by a follow-up script (not this migration,
-- which stays pure DDL), and the app falls back to the navy default / no dedicated link when
-- either is unset rather than requiring it.

alter table centers add column if not exists accent_color text;
alter table centers add column if not exists slug text;

-- Partial unique index (not a plain unique constraint) so multiple NULL slugs stay legal
-- during the backfill window instead of erroring the migration.
create unique index if not exists idx_centers_slug on centers (slug) where slug is not null;
