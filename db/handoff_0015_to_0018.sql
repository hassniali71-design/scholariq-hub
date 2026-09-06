-- 0015_payment_methods_extension.sql
-- Section 2 (cashier) â€” extend payments.method CHECK + attendance_records.late_minutes/locked

alter table payments drop constraint if exists payments_method_check;
alter table payments add constraint payments_method_check
  check (method in ('cash', 'wallet', 'instapay', 'bank_transfer', 'fawry'));

alter table attendance_records
  add column if not exists late_minutes integer not null default 0,
  add column if not exists locked boolean not null default false;
-- 0016_booklets_extension.sql
-- Section 3 â€” extend booklets with kind, page_count, printed, paper_per_unit

alter table booklets
  add column if not exists kind text not null default 'booklet'
    check (kind in ('book', 'booklet', 'exam')),
  add column if not exists page_count integer not null default 0,
  add column if not exists printed integer not null default 0,
  add column if not exists paper_per_unit integer not null default 1;
-- 0017_paper_credits.sql
-- Section 3 â€” paper credits & transactions for booklet/print accounting

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
-- 0018_booklet_sales.sql
-- Section 3 â€” sales of booklets/books/exams to students

create table if not exists booklet_sales (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  student_id text not null references students (id) on delete cascade,
  student_name text not null,
  student_code text not null,
  booklet_id text not null references booklets (id) on delete restrict,
  booklet_title text not null,
  quantity integer not null,
  unit_price numeric not null,
  total_amount numeric not null,
  paper_consumed integer not null,
  sold_by text not null,
  sold_at text not null
);
create index if not exists idx_booklet_sales_center on booklet_sales (center_id, sold_at desc);
create index if not exists idx_booklet_sales_student on booklet_sales (center_id, student_id);
