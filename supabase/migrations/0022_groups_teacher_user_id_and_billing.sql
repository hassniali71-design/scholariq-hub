-- Migration 0022: groups.teacher_user_id + Student billing mode + monthly_closings
--
-- Section 0: `teacher_user_id` is the secondary join key between `groups` and
-- `teachers`. `groups.teacher_id` (legacy) carries the client-minted id; on
-- Supabase bootstrap, the server replaces the Teacher record with a
-- server-minted id and the old Group rows become orphaned. Storing the
-- `user_id` (the login identifier) is invariant across the bootstrap and
-- gives a belt-and-suspenders join.
--
-- Section 1.21: Student billing mode. Defaults to 'monthly' so existing data
-- is preserved. `due_day_of_month` is only meaningful for monthly billing;
-- null when billing_mode = 'per_session' (then the due date is derived from
-- the group's weekday).
--
-- Section 1.14: `monthly_closings` snapshot table for the "إغلاق شهري"
-- feature on the owner treasury page.

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

comment on column public.groups.teacher_user_id is
  'Secondary join key to teachers.user_id (login identifier). Survives client/server id divergence on Supabase bootstrap. See plan 1788550279310 §0 cause A.';
comment on column public.students.billing_mode is
  'monthly = charged on a fixed day each month; per_session = charged per attended session (due day derived from group weekday).';
comment on column public.students.due_day_of_month is
  'Only used when billing_mode = monthly. Constrained to 1..28 to be valid in every month. Null for per_session billing.';
