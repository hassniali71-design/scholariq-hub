-- PLATFORM_CLIENT_MANAGEMENT_SPEC.md §1 — per-client subscription lifecycle (joined/expiry/
-- active-paused) for the platform admin's "كل العملاء" screen, plus a last-login timestamp on
-- `accounts` so §3-4 ("آخر نشاط") can be rolled up per center without a separate activity log
-- table (small dataset, cheap to compute in the server function — see fetchClients).

alter table centers add column if not exists joined_at timestamptz;
alter table centers add column if not exists expires_at timestamptz;
alter table centers add column if not exists status text not null default 'active' check (status in ('active', 'paused'));

-- §1 backfill: existing centers already have a real `created_at` from migration 0001's
-- `default now()` at insert time, so every current row (including the two isolation-test
-- tenants and "platform") uses that as `joined_at` — the "no real date, use now()" fallback
-- in the spec never actually triggers here, but stays as the coalesce for safety.
update centers set joined_at = coalesce(joined_at, created_at, now()) where joined_at is null;
update centers set expires_at = coalesce(expires_at, joined_at + interval '1 year') where expires_at is null;

alter table centers alter column joined_at set not null;
alter table centers alter column joined_at set default now();
alter table centers alter column expires_at set not null;

alter table accounts add column if not exists last_login_at timestamptz;
