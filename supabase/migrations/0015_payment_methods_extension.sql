-- 0015_payment_methods_extension.sql
-- Section 2 (cashier) — extend payments.method CHECK + attendance_records.late_minutes/locked

alter table payments drop constraint if exists payments_method_check;
alter table payments add constraint payments_method_check
  check (method in ('cash', 'wallet', 'instapay', 'bank_transfer', 'fawry'));

alter table attendance_records
  add column if not exists late_minutes integer not null default 0,
  add column if not exists locked boolean not null default false;
