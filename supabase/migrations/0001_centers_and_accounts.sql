-- SUPABASE_MIGRATION_SPEC.md §1-2 — centers (tenants) + accounts (login/session layer).
--
-- Primary keys are TEXT, not native `uuid`. The app's `UUID` TS type (src/types/index.ts)
-- is a plain string alias, not a real UUID format constraint, and every existing seed id
-- ("st-1", "tc-1", "cl-1", "acc-owner"...) plus every runtime id generator in data-store.ts
-- and auth.ts (`` `acc-${Date.now()}` ``, `` `TCH-${2001 + i}` ``, `` `sess-${Date.now()}` ``)
-- produces non-UUID strings. Switching to native `uuid` would require rewriting every id
-- generator across the app just to satisfy a column type, which contradicts §5's "no UI
-- rebuild" and §4's "match every seed value exactly" — so this migration keeps ids as TEXT
-- to preserve 100% fidelity with the existing app instead of the literal "UUID" wording.

create table if not exists centers (
  id text primary key,
  name text not null,
  branch text not null,
  created_at timestamptz not null default now()
);

create table if not exists accounts (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  role text not null check (role in ('owner', 'staff', 'teacher', 'student', 'parent', 'visitor')),
  full_name text not null,
  phone text,
  -- Owner: email. Teacher/Staff: code (e.g. TCH-2001). Student/Parent: student code. Visitor: invite code.
  identifier text not null unique,
  -- Owner / Teacher / Staff only — null for student/parent/visitor (matches auth.ts's Account shape).
  password text,
  created_at timestamptz not null default now()
);

create index if not exists idx_accounts_center_id on accounts (center_id);
create index if not exists idx_accounts_identifier on accounts (identifier);
