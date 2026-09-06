-- 0017_paper_credits.sql
-- Section 3 — paper credits & transactions for booklet/print accounting

create table if not exists paper_credits (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  staff_id text not null,
  staff_name text not null,
  total_sheets integer not null,
  unit_price numeric not null,
  issued_at text not null,
  note text,
  created_at text not null
);
create index if not exists idx_paper_credits_center on paper_credits (center_id, staff_id);

create table if not exists paper_transactions (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  staff_id text not null,
  staff_name text not null,
  delta_sheets integer not null,
  reason text not null,
  related_booklet_id text,
  related_sale_id text,
  created_at text not null
);
create index if not exists idx_paper_transactions_staff on paper_transactions (center_id, staff_id, created_at desc);
