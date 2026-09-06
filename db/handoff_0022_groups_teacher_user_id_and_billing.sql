-- Migration 0022 handoff: bundled version of 0022_groups_teacher_user_id_and_billing.sql
-- This is a verbatim copy for environments where the incremental file is harder to apply.

alter table public.groups
  add column if not exists teacher_user_id text null;

create index if not exists groups_teacher_user_id_idx
  on public.groups (teacher_user_id)
  where teacher_user_id is not null;

alter table public.students
  add column if not exists billing_mode text not null default 'monthly'
    check (billing_mode in ('monthly', 'per_session'));

alter table public.students
  add column if not exists due_day_of_month integer null
    check (due_day_of_month is null or (due_day_of_month between 1 and 28));

create table if not exists public.monthly_closings (
  id text primary key,
  center_id text not null references public.centers (id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  revenue numeric(12, 2) not null default 0,
  expenses numeric(12, 2) not null default 0,
  salaries numeric(12, 2) not null default 0,
  net numeric(12, 2) not null default 0,
  closed_at timestamptz not null default now(),
  closed_by text null references public.accounts (id) on delete set null,
  unique (center_id, year, month)
);

create index if not exists monthly_closings_center_year_idx
  on public.monthly_closings (center_id, year desc, month desc);
